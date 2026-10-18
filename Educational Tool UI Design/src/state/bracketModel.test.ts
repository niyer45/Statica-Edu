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

// Mounting Bracket I through the model-generic engine (task 55 L-bracket; MM-10, MM-13, MM-15,
// MM-18, MM-19, MM-26).

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

/** Baseline → reference (predicted), → legSpanNA (not applicable), → oversized (predicted), submit the reference. */
function looped(): BracketSession {
  return run(fresh(), [
    set('thicknessM', 0.007),
    set('widthM', 0.04),
    set('flangeHeightM', 0.08),
    set('innerRadiusM', 0.006),
    { type: 'setPrediction', direction: 'decrease', now: T0 },
    { type: 'runTest', now: T0, id: 'br-1' },
    set('thicknessM', 0.01),
    set('flangeHeightM', 0.05),
    set('innerRadiusM', 0.012),
    { type: 'runTest', now: T0, id: 'br-2' },
    set('thicknessM', 0.008),
    set('widthM', 0.06),
    set('flangeHeightM', 0.1),
    set('innerRadiusM', 0.006),
    { type: 'setPrediction', direction: 'increase', now: T0 },
    { type: 'runTest', now: T0, id: 'br-3' },
    { type: 'setReflection', text: 'The sharp bend and the short flange governed; a thicker, narrower bracket with a taller flange fixed it.' },
    { type: 'submit', testResultId: 'br-1', now: T0 },
  ])
}

describe('bracket learning loop through the engine', () => {
  it('dispatches only to the bracket definition by explicit identity, never substituting another model', () => {
    expect(bracketModel.ref).toEqual(ch.model)
    expect(bracketModel.ref).toEqual({ id: 'boltedLBracket', version: 1 })
    expect(bracketModel.envelopeVersion).toBe(2)
    expect(modelFor(ch.model)).toBe(bracketModel)
    expect(requireModel(ch)).toBe(bracketModel)
    expect(modelFor({ id: 'boltedLBracket', version: 2 })).toBeUndefined()
    expect(modelFor({ id: 'steppedBarBracket', version: 1 })).toBeUndefined()
    expect(modelFor(ch.model)).not.toBe(torsionModel)
  })

  it('stores the worksheet baseline, failing all four numeric checks', () => {
    const base = fresh().history[0]!
    expect(base.analysis.bendStressPa).toBeCloseTo(worksheetFixture('baseline').expected.bendStressPa, 6)
    expect(base.failures).toEqual(['bendStress', 'deflection', 'boltTension', 'mass'])
    expect(base.evaluation.status).toBe('notAccepted')
  })

  it('gates the checkpoint, then records an Accepted reference with a scorable bend-stress outcome', () => {
    const gated = run(fresh(), [set('innerRadiusM', 0.003), { type: 'runTest', now: T0, id: 'x' }])
    expect(gated.ui.predictionDialogOpen).toBe(true)
    expect(gated.history).toHaveLength(1)
    const r = looped().history[1]!
    expect(r.accepted).toBe(true)
    expect(r.predictionOutcome).toEqual({
      metric: 'bendStressPa',
      scorable: true,
      predicted: 'decrease',
      actual: 'decrease',
      ratio: expect.closeTo(BRACKET_DERIVED.baselineToReferenceStressRatio, 12) as unknown as number,
      matched: true,
    })
  })

  it('records a not-applicable result with every quantity still stored (MM-10)', () => {
    const r = looped().history[2]!
    expect(r.prediction).toBeUndefined()
    expect(r.evaluation.status).toBe('modelNotApplicable')
    expect(r.failures).toEqual(['boltTension', 'mass', 'applicability'])
    expect(r.analysis.notApplicableReasons.map((i) => i.code)).toEqual(['LEG_SPAN'])
    expect(JSON.stringify(r)).not.toMatch(/NaN|null/)
  })

  it('scores the next checkpoint against the not-applicable result and records the submission', () => {
    const s = looped()
    const r = s.history[3]!
    expect(r.accepted).toBe(false)
    expect(r.failures).toEqual(['mass'])
    expect(r.predictionOutcome).toMatchObject({ metric: 'bendStressPa', scorable: true, predicted: 'increase', actual: 'increase', matched: true })
    expect(s.submission).toMatchObject({ testResultId: 'br-1', status: 'accepted', efficiency: s.history[1]!.evaluation.efficiency })
  })

  it('rejects an out-of-range strict edit or an unknown parameter without changing the draft', () => {
    const s = fresh()
    const bad = bracketReducer(s, set('flangeHeightM', 0.2), ch)
    expect(bad.draft).toBe(s.draft)
    expect(bad.draftErrors.map((e) => e.code)).toEqual(['ABOVE_MAX'])
    expect(bad.draftStatus).toBe(s.draftStatus)
    const unknown = bracketReducer(s, set('rootDepthM', 0.03), ch)
    expect(unknown.draft).toBe(s.draft)
    expect(unknown.draftErrors.map((e) => e.code)).toEqual(['UNKNOWN_PARAM'])
  })

  it('rejects an invalid draft before analysis on runTest', () => {
    const s = fresh()
    const forced: BracketSession = { ...s, draft: { ...s.draft, widthM: 0.2 } }
    const r = bracketReducer(forced, { type: 'runTest', now: T0, id: 'never' }, ch)
    expect(r.history).toBe(forced.history)
    expect(r.draftErrors.map((e) => e.code)).toEqual(['ABOVE_MAX'])
  })

  it('accepts a valid edit and tracks draft status', () => {
    const s = bracketReducer(fresh(), set('innerRadiusM', 0.002), ch)
    expect(s.draft.innerRadiusM).toBe(0.002)
    expect(s.draftStatus).toBe('draft')
    expect(bracketReducer(s, set('innerRadiusM', 0.001), ch).draftStatus).toBe('tested')
  })

  it('shares restore, delete, compare and reset semantics with the other models', () => {
    let s = looped()
    s = bracketReducer(s, { type: 'restore', testResultId: 'br-2' }, ch)
    expect(s.draft.flangeHeightM).toBe(0.05)
    expect(s.draft.id).toBe('baseline:restored:1')
    s = bracketReducer(s, { type: 'deleteIteration', testResultId: 'br-1' }, ch)
    expect(s.deletedIterationIds).toEqual(['br-1'])
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
    const s = bracketReducer(bracketReducer(fresh(), set('innerRadiusM', 0.002), broken), { type: 'setPrediction', direction: 'same', now: T0 }, broken)
    const r = bracketReducer(s, { type: 'runTest', now: T0, id: 'boom' }, broken)
    expect(r.history).toHaveLength(1)
    expect(r.ui.notice?.kind).toBe('error')
    expect(r.ui.notice?.message).toMatch(/bendMomentNm/)
  })
})

describe('v2 persistence (MM-18)', () => {
  const restore = (raw: string) => deserializeSessionV2(bracketModel, bracketPersistence, raw, ch)

  it('round-trips a full session with a not-applicable result and explicit undefined fields', () => {
    const s = bracketReducer(looped(), { type: 'cancelPrediction' }, ch)
    const raw = serializeSessionV2(bracketModel.ref, s, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: { id: 'boltedLBracket', version: 1 }, session: { challengeVersion: 2 } })
    const r = restore(raw)
    if (!r.ok) throw new Error(r.error)
    expect(JSON.parse(serializeSessionV2(bracketModel.ref, r.value, T0))).toEqual(JSON.parse(raw))
    expect(Object.prototype.hasOwnProperty.call(r.value, 'pendingPrediction')).toBe(true)
    expect(r.value.history[2]!.evaluation.status).toBe('modelNotApplicable')
  })

  it('round-trips a session with draft errors', () => {
    const s = bracketReducer(looped(), set('widthM', 0.2), ch)
    const r = restore(serializeSessionV2(bracketModel.ref, s, T0))
    expect(r.ok && r.value.draftErrors.map((e) => e.code)).toEqual(['ABOVE_MAX'])
  })

  it('rejects a stale stepped-bracket save (challenge version 1) with a notice and never re-scores it (MM-04)', () => {
    // The shape a version-1 Mounting Bracket I save had: stepped-bar model identity, challenge
    // version 1 and stepped-bar design fields (stored under the old key ei:session:mounting-bracket-1:v1).
    const data = JSON.parse(serializeSessionV2(bracketModel.ref, fresh(), T0))
    data.model = { id: 'steppedBarBracket', version: 1 }
    data.session.challengeVersion = 1
    data.session.draft = { id: 'baseline', rootDepthM: 0.03, armDepthM: 0.02, stepLocationM: 0.15, filletRadiusM: 0.001, materialId: 'al-educational' }
    expect(restore(JSON.stringify(data))).toEqual({ ok: false, error: 'Saved session belongs to a different model' })
    // Even relabelled with the new model identity, the old challenge version and fields are refused.
    data.model = bracketModel.ref
    expect(restore(JSON.stringify(data)).ok).toBe(false)
    data.session.draft = fresh().draft
    expect(restore(JSON.stringify(data))).toEqual({ ok: false, error: 'Saved challenge mismatch' })
  })

  it.each([
    ['tampered analysis', (d: unknown) => { const a = at(d, 'session.history.1.analysis'); a.bendStressPa = (a.bendStressPa as number) * 2 }, 'Saved results differ from recomputed results'],
    ['a null bolt tension on the not-applicable result', (d: unknown) => { at(d, 'session.history.2.analysis').boltTensionN = null }, 'Saved results differ from recomputed results'],
    ['an invented constraint value', (d: unknown) => { at(d, 'session.history.2.evaluation.constraints.0').value = 1 }, 'Saved results differ from recomputed results'],
    ['a flipped prediction outcome', (d: unknown) => { Object.assign(at(d, 'session.history.3.predictionOutcome'), { actual: 'decrease', matched: false }) }, 'Invalid prediction outcome'],
    ['other model', (d: unknown) => { at(d, 'model').id = 'circularShaftTorsion' }, 'Saved session belongs to a different model'],
    ['v1 envelope', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'Unsupported saved session version'],
    ['locked material', (d: unknown) => { at(d, 'session.draft').materialId = 'steel' }, undefined],
    ['out-of-range snapshot', (d: unknown) => { at(d, 'session.history.1.designSnapshot').widthM = 0.2 }, undefined],
    ['torsion failure id', (d: unknown) => { at(d, 'session.history.0').failures = ['twist'] }, undefined],
    ['retired draft error code', (d: unknown) => { at(d, 'session').draftErrors = [{ code: 'ARM_DEEPER_THAN_ROOT', message: 'x' }] }, undefined],
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
    expect(JSON.parse(text)).toMatchObject({ format: 'ei-design', schemaVersion: 2, challengeId: 'mounting-bracket-1', model: { id: 'boltedLBracket', version: 1 } })
    expect(Object.keys(JSON.parse(text).design)).toEqual(['id', 'thicknessM', 'widthM', 'flangeHeightM', 'innerRadiusM', 'materialId'])
    const r = bracketModel.importDesign(text, ch)
    if (!r.ok) throw new Error(r.error.join('; '))
    expect(r.value).toEqual(design)
    expect(r.value).not.toBe(design)
  })

  it('imports a design and applies it as the draft', () => {
    const other = { ...design, widthM: 0.05 }
    const s = bracketReducer(looped(), { type: 'importDesign', json: bracketModel.exportDesign(other, ch) }, ch)
    expect(s.draft).toEqual(other)
    expect(s.draftStatus).toBe('draft')
  })

  it('rejects an old stepped-bracket design file with a model-mismatch reason', () => {
    const old = JSON.stringify({
      format: 'ei-design',
      schemaVersion: 2,
      challengeId: 'mounting-bracket-1',
      model: { id: 'steppedBarBracket', version: 1 },
      design: { id: 'x', rootDepthM: 0.03, armDepthM: 0.02, stepLocationM: 0.175, filletRadiusM: 0.003, materialId: 'al-educational' },
    })
    const r = bracketModel.importDesign(old, ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.join(' ')).toContain('different analysis model')
  })

  it.each([
    ['another challenge', (d: unknown) => { at(d, '').challengeId = 'torsion-shaft-1' }, 'different challenge'],
    ['another model', (d: unknown) => { at(d, '').model = { id: 'circularShaftTorsion', version: 1 } }, 'different analysis model'],
    ['v1 version', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'schemaVersion must be 2'],
    ['locked material', (d: unknown) => { at(d, 'design').materialId = 'steel' }, 'fixed'],
    ['out-of-range flange', (d: unknown) => { at(d, 'design').flangeHeightM = 0.29 }, 'Flange height must be at most 150 mm'],
    ['unknown design key', (d: unknown) => { at(d, 'design').rootDepthM = 0.03 }, 'Unexpected key "design.rootDepthM"'],
    ['missing design key', (d: unknown) => { delete at(d, 'design').innerRadiusM }, 'design.innerRadiusM: Required'],
    ['unknown top-level key', (d: unknown) => { at(d, '').extra = 1 }, 'Unexpected key "extra"'],
  ])('rejects %s', (_name, mutate, fragment) => {
    const data = JSON.parse(bracketModel.exportDesign(design, ch))
    mutate(data)
    const r = bracketModel.importDesign(JSON.stringify(data), ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.join(' ')).toContain(fragment)
  })

  it('lists locked-field reasons first', () => {
    const r = parseBracketDesign({ ...design, materialId: 'steel', innerRadiusM: 1 }, ch)
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
      param: fc.constantFrom('thicknessM', 'widthM', 'flangeHeightM', 'innerRadiusM'),
      valueM: fc.oneof(fc.double({ min: 0, max: 0.2, noNaN: true }), fc.constantFrom(0.003, 0.01, 0.04, 0.12, 0.05, 0.15, 0.001, 0.012)),
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
          // The bend stress is always stored, so every checkpoint outcome is scorable.
          if (r.predictionOutcome !== undefined) expect(r.predictionOutcome.scorable, `iteration ${i}`).toBe(true)
        }
        s = next
      }
    }))
  })
})
