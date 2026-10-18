import fc from 'fast-check'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BRACKET_DERIVED, bracketChallenge, worksheetFixture } from '../../test/fixtures/bracket'
import { torsionChallenge } from '../../test/fixtures/torsion'
import { assertProperty } from '../../test/pbt'
import { bundledChallenge } from '../../test/arbitraries'
import type { BracketEdit } from '../geometry/bracket/edit'
import { bracketModel, bracketPersistence, bracketReducer, parseBracketDesign, type BracketAction, type BracketSession } from './bracketModel'
import { initSessionWith } from './engine'
import { exportDesign as exportBeamDesign } from './importExport'
import { modelFor, requireModel } from './models'
import { deserializeSession, deserializeSessionV2, serializeSessionV2 } from './persistence'
import { torsionModel } from './torsionModel'

// Mounting Bracket I through the model-generic engine (task 46.2; MBR-08, MBR-09, MM-10, MM-13,
// MM-15, MM-18, MM-19, MM-26). Registered for dispatch in 46.3; the definition is not linked from
// the catalog or bundled registry until owner-approved activation.

const ch = bracketChallenge()
const T0 = '2026-10-17T10:00:00.000Z'

function fresh(): BracketSession {
  const r = initSessionWith(bracketModel, ch, T0, 'base-1')
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}
const run = (s: BracketSession, actions: BracketAction[]) => actions.reduce((acc, a) => bracketReducer(acc, a, ch), s)
const set = (param: string, valueM: number, mode: 'clamp' | 'strict' = 'strict'): BracketAction => ({ type: 'edit', edit: { type: 'setParam', param, valueM, mode } })
/** The object at a dotted path of parsed JSON ('' = root), for targeted corruption. */
const at = (d: unknown, path: string): Record<string, unknown> =>
  (path === '' ? d : path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], d)) as Record<string, unknown>

/** Baseline → reference (predicted), → fitShallowNA (Kt fit undefined), → filletOnly (predicted, not scorable). */
function looped(): BracketSession {
  return run(fresh(), [
    set('stepLocationM', 0.175),
    set('filletRadiusM', 0.003),
    { type: 'setPrediction', direction: 'decrease', now: T0 },
    { type: 'runTest', now: T0, id: 'br-1' },
    set('stepLocationM', 0.15),
    set('armDepthM', 0.0295),
    set('filletRadiusM', 0.005),
    { type: 'runTest', now: T0, id: 'br-2' },
    set('armDepthM', 0.02),
    set('filletRadiusM', 0.0025),
    { type: 'setPrediction', direction: 'increase', now: T0 },
    { type: 'runTest', now: T0, id: 'br-3' },
    { type: 'setReflection', text: 'The sharp fillet at the step governed; a softer fillet fixed it.' },
    { type: 'submit', testResultId: 'br-3', now: T0 },
  ])
}

describe('bracket learning loop through the engine', () => {
  it('dispatches only to the bracket definition by explicit identity, never substituting another model', () => {
    expect(bracketModel.ref).toEqual(ch.model)
    expect(bracketModel.envelopeVersion).toBe(2)
    // Registered in 46.3: dispatch resolves the exact identity only (MM-05, MM-07).
    expect(modelFor(ch.model)).toBe(bracketModel)
    expect(requireModel(ch)).toBe(bracketModel)
    expect(modelFor({ id: 'steppedBarBracket', version: 2 })).toBeUndefined()
    expect(modelFor(ch.model)).not.toBe(torsionModel)
  })

  it('stores the worksheet baseline and fails peak stress only (step governs)', () => {
    const base = fresh().history[0]!
    expect(base.analysis.peakStressPa).toBeCloseTo(worksheetFixture('baseline').expected.peakStressPa as number, 6)
    expect(base.analysis.peakLocation).toBe('step')
    expect(base.failures).toEqual(['peakStress'])
    expect(base.evaluation.status).toBe('notAccepted')
  })

  it('gates the checkpoint, then records an Accepted reference with a scorable peak-stress outcome', () => {
    const gated = run(fresh(), [set('filletRadiusM', 0.003), { type: 'runTest', now: T0, id: 'x' }])
    expect(gated.ui.predictionDialogOpen).toBe(true)
    expect(gated.history).toHaveLength(1)
    const r = looped().history[1]!
    expect(r.accepted).toBe(true)
    expect(r.predictionOutcome).toEqual({
      metric: 'peakStressPa',
      scorable: true,
      predicted: 'decrease',
      actual: 'decrease',
      ratio: expect.closeTo(BRACKET_DERIVED.baselineToReferencePeakRatio, 12) as unknown as number,
      matched: true,
    })
  })

  it('records a not-applicable result with the peak stress absent (MM-10)', () => {
    const r = looped().history[2]!
    expect(r.prediction).toBeUndefined()
    expect(r.evaluation.status).toBe('modelNotApplicable')
    expect(r.failures).toEqual(['peakStress', 'mass', 'applicability'])
    expect('peakStressPa' in r.analysis).toBe(false)
    expect('ktStep' in r.analysis).toBe(false)
    expect(r.analysis.stepNominalStressPa).toBeGreaterThan(0)
    expect(JSON.stringify(r)).not.toMatch(/NaN|null/)
  })

  it('records the next checkpoint as not scorable because the previous result has no peak stress (MM-13)', () => {
    const s = looped()
    const r = s.history[3]!
    expect(r.accepted).toBe(true)
    expect(r.predictionOutcome).toEqual({ metric: 'peakStressPa', scorable: false, predicted: 'increase', reason: 'noFiniteMetric' })
    expect(s.submission).toMatchObject({ testResultId: 'br-3', status: 'accepted', efficiency: r.evaluation.efficiency })
  })

  it('rejects an edit that would make d > D without changing the draft', () => {
    const s = fresh()
    const bad = bracketReducer(s, set('armDepthM', 0.031, 'clamp'), ch)
    expect(bad.draft).toBe(s.draft)
    expect(bad.draftErrors.map((e) => e.code)).toEqual(['ARM_DEEPER_THAN_ROOT'])
    expect(bad.draftStatus).toBe(s.draftStatus)
    const unknown = bracketReducer(s, set('lengthM', 0.4), ch)
    expect(unknown.draft).toBe(s.draft)
    expect(unknown.draftErrors.map((e) => e.code)).toEqual(['UNKNOWN_PARAM'])
  })

  it('rejects an invalid draft before analysis on runTest (MBR-17)', () => {
    const s = fresh()
    const forced: BracketSession = { ...s, draft: { ...s.draft, armDepthM: 0.04 } }
    const r = bracketReducer(forced, { type: 'runTest', now: T0, id: 'never' }, ch)
    expect(r.history).toBe(forced.history)
    expect(r.draftErrors.map((e) => e.code)).toEqual(['ARM_DEEPER_THAN_ROOT'])
  })

  it('accepts a valid edit and tracks draft status', () => {
    const s = bracketReducer(fresh(), set('filletRadiusM', 0.002), ch)
    expect(s.draft.filletRadiusM).toBe(0.002)
    expect(s.draftStatus).toBe('draft')
    expect(bracketReducer(s, set('filletRadiusM', 0.001), ch).draftStatus).toBe('tested')
  })

  it('shares restore, delete, compare and reset semantics with the other models', () => {
    let s = looped()
    s = bracketReducer(s, { type: 'restore', testResultId: 'br-2' }, ch)
    expect(s.draft.armDepthM).toBe(0.0295)
    expect(s.draft.id).toBe('baseline:restored:1')
    s = bracketReducer(s, { type: 'deleteIteration', testResultId: 'br-3' }, ch)
    expect(s.deletedIterationIds).toEqual(['br-3'])
    expect(s.submission).toBeUndefined()
    s = bracketReducer(s, { type: 'reset' }, ch)
    expect(s.reflectionAnswer).toBe('')
    expect(s.history).toHaveLength(4)
  })

  it('ignores an unknown action', () => {
    const s = fresh()
    expect(bracketReducer(s, { type: 'nope' } as unknown as BracketAction, ch)).toBe(s)
  })

  it('turns a typed invariant error into a notice without appending a result', () => {
    const broken = { ...ch, load: { ...ch.load, forceN: Number.POSITIVE_INFINITY } }
    const s = bracketReducer(bracketReducer(fresh(), set('filletRadiusM', 0.002), broken), { type: 'setPrediction', direction: 'same', now: T0 }, broken)
    const r = bracketReducer(s, { type: 'runTest', now: T0, id: 'boom' }, broken)
    expect(r.history).toHaveLength(1)
    expect(r.ui.notice?.kind).toBe('error')
    expect(r.ui.notice?.message).toMatch(/rootMomentNm/)
  })
})

describe('v2 persistence (MM-18)', () => {
  const restore = (raw: string) => deserializeSessionV2(bracketModel, bracketPersistence, raw, ch)

  it('round-trips a full session with absent quantities and explicit undefined fields', () => {
    const s = bracketReducer(looped(), { type: 'cancelPrediction' }, ch)
    const raw = serializeSessionV2(bracketModel.ref, s, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: { id: 'steppedBarBracket', version: 1 } })
    const r = restore(raw)
    if (!r.ok) throw new Error(r.error)
    expect(JSON.parse(serializeSessionV2(bracketModel.ref, r.value, T0))).toEqual(JSON.parse(raw))
    expect(Object.prototype.hasOwnProperty.call(r.value, 'pendingPrediction')).toBe(true)
    expect('peakStressPa' in r.value.history[2]!.analysis).toBe(false)
  })

  it('round-trips a session with draft errors', () => {
    const s = bracketReducer(looped(), set('armDepthM', 0.04), ch)
    const r = restore(serializeSessionV2(bracketModel.ref, s, T0))
    expect(r.ok && r.value.draftErrors.map((e) => e.code)).toEqual(['ARM_DEEPER_THAN_ROOT'])
  })

  it.each([
    ['tampered analysis', (d: unknown) => { const a = at(d, 'session.history.1.analysis'); a.peakStressPa = (a.peakStressPa as number) * 2 }, 'Saved results differ from recomputed results'],
    ['a null peak stress on the not-applicable result', (d: unknown) => { at(d, 'session.history.2.analysis').peakStressPa = null }, 'Saved results differ from recomputed results'],
    ['an invented peak-stress constraint value', (d: unknown) => { at(d, 'session.history.2.evaluation.constraints.0').value = 1 }, 'Saved results differ from recomputed results'],
    ['a scored not-scorable outcome', (d: unknown) => { Object.assign(at(d, 'session.history.3.predictionOutcome'), { scorable: true, actual: 'increase', ratio: 1.1, matched: true }) }, 'Invalid prediction outcome'],
    ['other model', (d: unknown) => { at(d, 'model').id = 'circularShaftTorsion' }, 'Saved session belongs to a different model'],
    ['v1 envelope', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'Unsupported saved session version'],
    ['locked material', (d: unknown) => { at(d, 'session.draft').materialId = 'steel' }, undefined],
    ['arm deeper than root', (d: unknown) => { at(d, 'session.history.1.designSnapshot').armDepthM = 0.04 }, undefined],
    ['torsion failure id', (d: unknown) => { at(d, 'session.history.0').failures = ['twist'] }, undefined],
    ['unknown draft error code', (d: unknown) => { at(d, 'session').draftErrors = [{ code: 'WALL_TOO_THIN', message: 'x' }] }, undefined],
  ])('rejects %s all-or-nothing', (_name, mutate, message) => {
    const data = JSON.parse(serializeSessionV2(bracketModel.ref, looped(), T0))
    mutate(data)
    const r = restore(JSON.stringify(data))
    expect(r.ok).toBe(false)
    if (!r.ok && message) expect(r.error).toBe(message)
  })

  it('never reads a v1 beam save or a torsion save as bracket, nor a bracket save as a beam session', () => {
    const beamRaw = readFileSync(new URL('../../test/fixtures/sessions/cantilever-beam-1.v1.json', import.meta.url), 'utf8')
    expect(restore(beamRaw).ok).toBe(false)
    const torsion = initSessionWith(torsionModel, torsionChallenge(), T0, 't')
    if (!torsion.ok) throw new Error(torsion.error.message)
    expect(restore(serializeSessionV2(torsionModel.ref, torsion.value, T0)).ok).toBe(false)
    expect(deserializeSession(serializeSessionV2(bracketModel.ref, looped(), T0), bundledChallenge()).ok).toBe(false)
  })
})

describe('v2 design files (MM-19)', () => {
  const design = looped().history[1]!.designSnapshot

  it('exports with model identity and imports a fresh equal design', () => {
    const text = bracketModel.exportDesign(design, ch)
    expect(JSON.parse(text)).toMatchObject({ format: 'ei-design', schemaVersion: 2, challengeId: 'mounting-bracket-1', model: { id: 'steppedBarBracket', version: 1 } })
    expect(Object.keys(JSON.parse(text).design)).toEqual(['id', 'rootDepthM', 'armDepthM', 'stepLocationM', 'filletRadiusM', 'materialId'])
    const r = bracketModel.importDesign(text, ch)
    if (!r.ok) throw new Error(r.error.join('; '))
    expect(r.value).toEqual(design)
    expect(r.value).not.toBe(design)
  })

  it('imports a uniform bar and applies it as the draft', () => {
    const uniform = { ...design, armDepthM: design.rootDepthM }
    const s = bracketReducer(looped(), { type: 'importDesign', json: bracketModel.exportDesign(uniform, ch) }, ch)
    expect(s.draft).toEqual(uniform)
    expect(s.draftStatus).toBe('draft')
  })

  it.each([
    ['another challenge', (d: unknown) => { at(d, '').challengeId = 'torsion-shaft-1' }, 'different challenge'],
    ['another model', (d: unknown) => { at(d, '').model = { id: 'circularShaftTorsion', version: 1 } }, 'different analysis model'],
    ['v1 version', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'schemaVersion must be 2'],
    ['locked material', (d: unknown) => { at(d, 'design').materialId = 'steel' }, 'fixed'],
    ['arm deeper than root', (d: unknown) => { at(d, 'design').armDepthM = 0.04 }, 'Arm depth must not exceed the root depth'],
    ['out-of-range step', (d: unknown) => { at(d, 'design').stepLocationM = 0.29 }, 'Step location must be at most 240 mm'],
    ['unknown design key', (d: unknown) => { at(d, 'design').lengthM = 0.4 }, 'Unexpected key "design.lengthM"'],
    ['missing design key', (d: unknown) => { delete at(d, 'design').filletRadiusM }, 'design.filletRadiusM: Required'],
    ['unknown top-level key', (d: unknown) => { at(d, '').extra = 1 }, 'Unexpected key "extra"'],
  ])('rejects %s', (_name, mutate, fragment) => {
    const data = JSON.parse(bracketModel.exportDesign(design, ch))
    mutate(data)
    const r = bracketModel.importDesign(JSON.stringify(data), ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.join(' ')).toContain(fragment)
  })

  it('lists locked-field reasons first', () => {
    const r = parseBracketDesign({ ...design, materialId: 'steel', filletRadiusM: 1 }, ch)
    expect(!r.ok && r.error[0]).toMatch(/^Material is fixed/)
  })

  it('rejects a beam v1 design file and a forbidden key without reading further', () => {
    const beam = bundledChallenge()
    expect(bracketModel.importDesign(exportBeamDesign(beam.initialDesign, beam), ch).ok).toBe(false)
    expect(bracketModel.importDesign('{"__proto__":{"x":1},"format":"ei-design"}', ch).ok).toBe(false)
  })

  it('a failed import leaves the session unchanged', () => {
    const s = looped()
    expect(bracketReducer(s, { type: 'importDesign', json: '{' }, ch)).toBe(s)
  })
})

// Feature: multi-model-architecture, Property 1: engine invariants hold for a non-beam model
describe('engine invariants for bracket action sequences', () => {
  const arbEdit: fc.Arbitrary<BracketAction> = fc
    .record({
      param: fc.constantFrom('rootDepthM', 'armDepthM', 'stepLocationM', 'filletRadiusM'),
      valueM: fc.oneof(fc.double({ min: 0, max: 0.3, noNaN: true }), fc.constantFrom(0.0295, 0.03, 0.005, 0.0005, 0.06)),
      mode: fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict'),
    })
    .map((edit): BracketAction => ({ type: 'edit', edit: { type: 'setParam', ...edit } satisfies BracketEdit }))
  const arbAction: fc.Arbitrary<BracketAction> = fc.oneof(
    arbEdit,
    fc.constantFrom<'increase' | 'decrease' | 'same'>('increase', 'decrease', 'same').map((direction) => ({ type: 'setPrediction' as const, direction, now: T0 })),
    fc.nat(99).map((n) => ({ type: 'runTest' as const, now: T0, id: `t-${n}` })),
    fc.constant({ type: 'reset' as const }),
  )

  it('keeps history append-only, drafts valid, checkpoints predicted, outcomes consistent and reduction pure', () => {
    assertProperty(fc.property(fc.array(arbAction, { maxLength: 25 }), (actions) => {
      let s = fresh()
      for (const a of actions) {
        const before = s
        const frozen = JSON.stringify(before)
        const next = bracketReducer(before, a, ch)
        expect(JSON.stringify(before)).toBe(frozen)
        expect(bracketReducer(before, a, ch)).toEqual(next)
        expect(next.history.slice(0, before.history.length)).toEqual(before.history)
        for (let i = 0; i < before.history.length; i++) expect(next.history[i]).toBe(before.history[i])
        expect(bracketModel.validateDesign(next.draft, ch)).toEqual([])
        for (const [i, r] of next.history.entries()) {
          if (ch.predictionPolicy.requiredOnIterations.includes(r.iteration)) expect(r.predictionOutcome).toBeDefined()
          expect(r.accepted).toBe(r.evaluation.status === 'accepted')
          if (r.predictionOutcome !== undefined) {
            const prevPeak = next.history[i - 1]!.analysis.peakStressPa
            expect(r.predictionOutcome.scorable).toBe(prevPeak !== undefined && r.analysis.peakStressPa !== undefined)
          }
        }
        s = next
      }
    }))
  })
})
