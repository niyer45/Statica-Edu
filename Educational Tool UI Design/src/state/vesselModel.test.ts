import fc from 'fast-check'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../test/arbitraries'
import { bracketChallenge } from '../../test/fixtures/bracket'
import { vesselChallenge, vesselFixture, VESSEL_DERIVED } from '../../test/fixtures/vessel'
import { assertProperty } from '../../test/pbt'
import type { VesselEdit } from '../geometry/vessel/edit'
import { bracketModel } from './bracketModel'
import { initSessionWith } from './engine'
import { exportDesign as exportBeamDesign } from './importExport'
import { modelFor, requireModel } from './models'
import { deserializeSession, deserializeSessionV2, serializeSessionV2 } from './persistence'
import { runtimeFor, runtimeForJson, vesselRuntime } from './runtimes'
import { vesselModel, vesselPersistence, vesselReducer, parseVesselDesign, type VesselAction, type VesselSession } from './vesselModel'

// Pressure Vessel I through the model-generic engine (task 69; MM-05, MM-10, MM-13, MM-15,
// MM-16, MM-18, MM-19, MM-26).

const ch = vesselChallenge()
const T0 = '2026-10-19T10:00:00.000Z'

function fresh(mode?: 'guided' | 'parametric'): VesselSession {
  const r = initSessionWith(vesselModel, ch, T0, 'base-1', mode)
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}
const run = (s: VesselSession, actions: VesselAction[]) => actions.reduce((acc, a) => vesselReducer(acc, a, ch), s)
const set = (param: string, valueM: number, mode: 'clamp' | 'strict' = 'strict'): VesselAction => ({ type: 'edit', edit: { type: 'setParam', param, valueM, mode } })
/** The object at a dotted path of parsed JSON ('' = root), for targeted corruption. */
const at = (d: unknown, path: string): Record<string, unknown> =>
  (path === '' ? d : path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], d)) as Record<string, unknown>

/** Baseline → reference (predicted), → thick walls (not applicable), → equal heads (predicted), submit the reference. */
function looped(): VesselSession {
  return run(fresh(), [
    set('innerDiameterM', 0.4),
    set('shellLengthM', 0.53),
    set('shellThicknessM', 0.0065),
    set('headThicknessM', 0.0035),
    { type: 'setPrediction', direction: 'decrease', now: T0 },
    { type: 'runTest', now: T0, id: 'pv-1' },
    set('innerDiameterM', 0.2),
    set('shellLengthM', 0.6),
    set('shellThicknessM', 0.012),
    set('headThicknessM', 0.012),
    { type: 'runTest', now: T0, id: 'pv-2' },
    set('innerDiameterM', 0.4),
    set('shellLengthM', 0.53),
    set('shellThicknessM', 0.0065),
    set('headThicknessM', 0.0065),
    { type: 'setPrediction', direction: 'increase', now: T0 },
    { type: 'runTest', now: T0, id: 'pv-3' },
    { type: 'setReflection', text: 'The hoop stress governed the shell; a wider, shorter vessel with thicker walls and thinner heads met every check.' },
    { type: 'submit', testResultId: 'pv-1', now: T0 },
  ])
}

describe('vessel learning loop through the engine', () => {
  it('dispatches only to the vessel definition by explicit identity, never substituting another model', () => {
    expect(vesselModel.ref).toEqual(ch.model)
    expect(vesselModel.ref).toEqual({ id: 'thinWallPressureVessel', version: 1 })
    expect(vesselModel.envelopeVersion).toBe(2)
    expect(modelFor(ch.model)).toBe(vesselModel)
    expect(requireModel(ch)).toBe(vesselModel)
    expect(modelFor({ id: 'thinWallPressureVessel', version: 2 })).toBeUndefined()
    expect(runtimeFor(ch.model)).toBe(vesselRuntime)
    expect(runtimeForJson({ model: { id: 'thinWallPressureVessel', version: 1 } })).toBe(vesselRuntime)
    expect(runtimeForJson({ model: { id: 'thinWallPressureVessel', version: 2 } })).toBeUndefined()
    expect(vesselRuntime.key(ch)).toBe('ei:session:pressure-vessel-1:v1')
  })

  it('stores the worksheet baseline, failing hoop, head, volume and overall length', () => {
    const base = fresh().history[0]!
    expect(base.analysis.hoopStressPa).toBeCloseTo(vesselFixture('baseline').expected.hoopStressPa, 3)
    expect(base.failures).toEqual(['hoopStress', 'headStress', 'volume', 'overallLength'])
    expect(base.evaluation.status).toBe('notAccepted')
  })

  it('gates the checkpoint, then records an Accepted reference with a scorable hoop-stress outcome', () => {
    const gated = run(fresh(), [set('shellThicknessM', 0.003), { type: 'runTest', now: T0, id: 'x' }])
    expect(gated.ui.predictionDialogOpen).toBe(true)
    expect(gated.history).toHaveLength(1)
    const r = looped().history[1]!
    expect(r.accepted).toBe(true)
    expect(r.predictionOutcome).toEqual({
      metric: 'hoopStressPa',
      scorable: true,
      predicted: 'decrease',
      actual: 'decrease',
      ratio: expect.closeTo(VESSEL_DERIVED.baselineToReferenceHoopRatio, 12) as unknown as number,
      matched: true,
    })
  })

  it('records a not-applicable result with every quantity still stored (MM-10)', () => {
    const r = looped().history[2]!
    expect(r.prediction).toBeUndefined()
    expect(r.evaluation.status).toBe('modelNotApplicable')
    expect(r.failures).toEqual(['volume', 'applicability'])
    expect(r.analysis.notApplicableReasons.map((i) => i.code)).toEqual(['THIN_WALL_SHELL', 'THIN_WALL_HEAD'])
    expect(r.analysis.notApplicableReasons[0]!.message).toMatch(/r\/t of at least 10/)
    expect(JSON.stringify(r)).not.toMatch(/NaN|null/)
  })

  it('scores the next checkpoint against the not-applicable result and records the submission', () => {
    const s = looped()
    const r = s.history[3]!
    expect(r.failures).toEqual(['mass'])
    expect(r.predictionOutcome).toMatchObject({ metric: 'hoopStressPa', scorable: true, predicted: 'increase', actual: 'increase', matched: true })
    expect(s.submission).toMatchObject({ testResultId: 'pv-1', status: 'accepted', efficiency: s.history[1]!.evaluation.efficiency })
  })

  it('rejects an out-of-range strict edit or an unknown parameter without changing the draft', () => {
    const s = fresh()
    const bad = vesselReducer(s, set('innerDiameterM', 0.6), ch)
    expect(bad.draft).toBe(s.draft)
    expect(bad.draftErrors.map((e) => e.code)).toEqual(['ABOVE_MAX'])
    const unknown = vesselReducer(s, set('pressurePa', 1e6), ch)
    expect(unknown.draft).toBe(s.draft)
    expect(unknown.draftErrors.map((e) => e.code)).toEqual(['UNKNOWN_PARAM'])
  })

  it('rejects an invalid draft before analysis on runTest', () => {
    const s = fresh()
    const forced: VesselSession = { ...s, draft: { ...s.draft, shellThicknessM: 0.02 } }
    const r = vesselReducer(forced, { type: 'runTest', now: T0, id: 'never' }, ch)
    expect(r.history).toBe(forced.history)
    expect(r.draftErrors.map((e) => e.code)).toEqual(['ABOVE_MAX'])
  })

  it('accepts a valid edit and tracks draft status', () => {
    const s = vesselReducer(fresh(), set('headThicknessM', 0.002), ch)
    expect(s.draft.headThicknessM).toBe(0.002)
    expect(s.draftStatus).toBe('draft')
    expect(vesselReducer(s, set('headThicknessM', 0.0015), ch).draftStatus).toBe('tested')
  })

  it('shares restore, delete and reset-to-baseline semantics with the other models (D-51)', () => {
    let s = looped()
    s = vesselReducer(s, { type: 'restore', testResultId: 'pv-2' }, ch)
    expect(s.draft.shellThicknessM).toBe(0.012)
    s = vesselReducer(s, { type: 'deleteIteration', testResultId: 'pv-1' }, ch)
    expect(s.deletedIterationIds).toEqual(['pv-1'])
    expect(s.submission).toBeUndefined()
    const reset = vesselReducer(s, { type: 'resetDraft', now: T0, id: 'base-2' }, ch)
    expect(reset.history).toHaveLength(1)
    expect(reset.history[0]!.id).toBe('base-2')
    expect(reset.draft).toEqual(ch.initialDesign)
    expect(reset.submission).toBeUndefined()
  })

  it('turns a typed invariant error into a notice without appending a result', () => {
    const broken = { ...ch, pressurePa: Number.POSITIVE_INFINITY }
    const s = vesselReducer(vesselReducer(fresh(), set('headThicknessM', 0.002), broken), { type: 'setPrediction', direction: 'same', now: T0 }, broken)
    const r = vesselReducer(s, { type: 'runTest', now: T0, id: 'boom' }, broken)
    expect(r.history).toHaveLength(1)
    expect(r.ui.notice?.kind).toBe('error')
    expect(r.ui.notice?.message).toMatch(/hoopStressPa/)
  })
})

describe('Guided locks through the runtime (D-49)', () => {
  it('Guided unlocks only the shell thickness first; Parametric edits anything', () => {
    const g = fresh('guided')
    const locked = vesselRuntime.reduce(g, set('innerDiameterM', 0.3), ch)
    expect(locked.draft).toBe(g.draft)
    expect(locked.ui.notice).toEqual({ kind: 'error', message: 'Inner diameter is locked in this Guided step. Editable now: Shell thickness.' })
    expect(vesselRuntime.reduce(g, set('shellThicknessM', 0.003), ch).draft.shellThicknessM).toBe(0.003)
    const p = fresh('parametric')
    expect(vesselRuntime.reduce(p, set('innerDiameterM', 0.3), ch).draft.innerDiameterM).toBe(0.3)
  })
})

describe('v2 persistence (MM-18)', () => {
  const restore = (raw: string) => deserializeSessionV2(vesselModel, vesselPersistence, raw, ch)

  it('round-trips a full session with a not-applicable result', () => {
    const s = vesselReducer(looped(), { type: 'cancelPrediction' }, ch)
    const raw = serializeSessionV2(vesselModel.ref, s, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: { id: 'thinWallPressureVessel', version: 1 }, session: { challengeVersion: 1 } })
    const r = restore(raw)
    if (!r.ok) throw new Error(r.error)
    expect(JSON.parse(serializeSessionV2(vesselModel.ref, r.value, T0))).toEqual(JSON.parse(raw))
    expect(r.value.history[2]!.evaluation.status).toBe('modelNotApplicable')
    expect(vesselRuntime.deserialize(vesselRuntime.serialize(s, T0), ch).ok).toBe(true)
  })

  it('round-trips a session with draft errors', () => {
    const s = vesselReducer(looped(), set('shellLengthM', 2), ch)
    const r = restore(serializeSessionV2(vesselModel.ref, s, T0))
    expect(r.ok && r.value.draftErrors.map((e) => e.code)).toEqual(['ABOVE_MAX'])
  })

  it.each([
    ['tampered analysis', (d: unknown) => { const a = at(d, 'session.history.1.analysis'); a.hoopStressPa = (a.hoopStressPa as number) * 2 }, 'Saved results differ from recomputed results'],
    ['a tampered volume bound', (d: unknown) => { at(d, 'session.history.1.evaluation.constraints.3').bound = 'max' }, 'Saved results differ from recomputed results'],
    ['an invented constraint value', (d: unknown) => { at(d, 'session.history.2.evaluation.constraints.0').value = 1 }, 'Saved results differ from recomputed results'],
    ['a flipped prediction outcome', (d: unknown) => { Object.assign(at(d, 'session.history.3.predictionOutcome'), { actual: 'decrease', matched: false }) }, 'Invalid prediction outcome'],
    ['other model', (d: unknown) => { at(d, 'model').id = 'boltedLBracket' }, 'Saved session belongs to a different model'],
    ['another challenge version', (d: unknown) => { at(d, 'session').challengeVersion = 2 }, 'Saved challenge mismatch'],
    ['v1 envelope', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'Unsupported saved session version'],
    ['locked material', (d: unknown) => { at(d, 'session.draft').materialId = 'steel' }, undefined],
    ['out-of-range snapshot', (d: unknown) => { at(d, 'session.history.1.designSnapshot').innerDiameterM = 0.9 }, undefined],
    ['bracket failure id', (d: unknown) => { at(d, 'session.history.0').failures = ['boltTension'] }, undefined],
  ])('rejects %s all-or-nothing', (_name, mutate, message) => {
    const data = JSON.parse(serializeSessionV2(vesselModel.ref, looped(), T0))
    mutate(data)
    const r = restore(JSON.stringify(data))
    expect(r.ok).toBe(false)
    if (!r.ok && message) expect(r.error).toBe(message)
  })

  it('never reads a v1 beam save or a bracket save as a vessel session, nor a vessel save as a beam session', () => {
    const beamRaw = readFileSync(new URL('../../test/fixtures/sessions/cantilever-beam-1.v1.json', import.meta.url), 'utf8')
    expect(restore(beamRaw).ok).toBe(false)
    const bracket = initSessionWith(bracketModel, bracketChallenge(), T0, 'b')
    if (!bracket.ok) throw new Error(bracket.error.message)
    expect(restore(serializeSessionV2(bracketModel.ref, bracket.value, T0)).ok).toBe(false)
    expect(deserializeSession(serializeSessionV2(vesselModel.ref, looped(), T0), bundledChallenge()).ok).toBe(false)
  })
})

describe('v2 design files (MM-19)', () => {
  const design = looped().history[1]!.designSnapshot

  it('exports with model identity and imports a fresh equal design', () => {
    const text = vesselModel.exportDesign(design, ch)
    expect(JSON.parse(text)).toMatchObject({ format: 'ei-design', schemaVersion: 2, challengeId: 'pressure-vessel-1', model: { id: 'thinWallPressureVessel', version: 1 } })
    expect(Object.keys(JSON.parse(text).design)).toEqual(['id', 'innerDiameterM', 'shellLengthM', 'shellThicknessM', 'headThicknessM', 'materialId'])
    const r = vesselModel.importDesign(text, ch)
    if (!r.ok) throw new Error(r.error.join('; '))
    expect(r.value).toEqual(design)
    expect(r.value).not.toBe(design)
  })

  it('imports a design and applies it as the draft', () => {
    const other = { ...design, headThicknessM: 0.004 }
    const s = vesselReducer(looped(), { type: 'importDesign', json: vesselModel.exportDesign(other, ch) }, ch)
    expect(s.draft).toEqual(other)
    expect(s.draftStatus).toBe('draft')
  })

  it.each([
    ['another challenge', (d: unknown) => { at(d, '').challengeId = 'mounting-bracket-1' }, 'different challenge'],
    ['another model', (d: unknown) => { at(d, '').model = { id: 'boltedLBracket', version: 1 } }, 'different analysis model'],
    ['v1 version', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'schemaVersion must be 2'],
    ['locked material', (d: unknown) => { at(d, 'design').materialId = 'steel' }, 'fixed'],
    ['out-of-range diameter', (d: unknown) => { at(d, 'design').innerDiameterM = 0.6 }, 'Inner diameter must be at most 500 mm'],
    ['unknown design key', (d: unknown) => { at(d, 'design').pressurePa = 1e6 }, 'Unexpected key "design.pressurePa"'],
    ['missing design key', (d: unknown) => { delete at(d, 'design').headThicknessM }, 'design.headThicknessM: Required'],
  ])('rejects %s', (_name, mutate, fragment) => {
    const data = JSON.parse(vesselModel.exportDesign(design, ch))
    mutate(data)
    const r = vesselModel.importDesign(JSON.stringify(data), ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.join(' ')).toContain(fragment)
  })

  it('lists locked-field reasons first', () => {
    const r = parseVesselDesign({ ...design, materialId: 'steel', shellLengthM: 9 }, ch)
    expect(!r.ok && r.error[0]).toMatch(/^Material is fixed/)
  })

  it('rejects a beam v1 design file and a forbidden key', () => {
    const beam = bundledChallenge()
    expect(vesselModel.importDesign(exportBeamDesign(beam.initialDesign, beam), ch).ok).toBe(false)
    expect(vesselModel.importDesign('{"__proto__":{"x":1},"format":"ei-design"}', ch).ok).toBe(false)
  })

  it('a failed import leaves the session unchanged', () => {
    const s = looped()
    expect(vesselReducer(s, { type: 'importDesign', json: '{' }, ch)).toBe(s)
  })
})

// Feature: multi-model-architecture, Property 1: engine invariants hold for a non-beam model
describe('engine invariants for vessel action sequences', () => {
  const arbEdit: fc.Arbitrary<VesselAction> = fc
    .record({
      param: fc.constantFrom('innerDiameterM', 'shellLengthM', 'shellThicknessM', 'headThicknessM'),
      valueM: fc.oneof(fc.double({ min: 0, max: 1.5, noNaN: true }), fc.constantFrom(0.2, 0.5, 0.1, 1.2, 0.001, 0.012, 0.0065, 0.4)),
      mode: fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict'),
    })
    .map((edit): VesselAction => ({ type: 'edit', edit: { type: 'setParam', ...edit } satisfies VesselEdit }))
  const arbAction: fc.Arbitrary<VesselAction> = fc.oneof(
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
        const next = vesselReducer(before, a, ch)
        expect(JSON.stringify(before)).toBe(frozen)
        expect(vesselReducer(before, a, ch)).toEqual(next)
        expect(next.history.slice(0, before.history.length)).toEqual(before.history)
        expect(vesselModel.validateDesign(next.draft, ch)).toEqual([])
        for (const r of next.history) {
          if (ch.predictionPolicy.requiredOnIterations.includes(r.iteration)) expect(r.predictionOutcome).toBeDefined()
          expect(r.accepted).toBe(r.evaluation.status === 'accepted')
          if (r.predictionOutcome !== undefined) expect(r.predictionOutcome.scorable).toBe(true)
        }
        s = next
      }
    }))
  })
})
