import fc from 'fast-check'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../test/arbitraries'
import { VIBRATION_DERIVED, vibrationChallenge, worksheetFixture } from '../../test/fixtures/vibration'
import { torsionChallenge } from '../../test/fixtures/torsion'
import { assertProperty } from '../../test/pbt'
import { scorePredictionByMetric } from '../evaluation/prediction'
import type { VibrationEdit } from '../geometry/vibration/edit'
import { initSessionWith } from './engine'
import { exportDesign as exportBeamDesign } from './importExport'
import { modelFor, requireModel, UnregisteredModelError } from './models'
import { deserializeSession, deserializeSessionV2, serializeSessionV2 } from './persistence'
import { torsionModel } from './torsionModel'
import { vibrationModel, vibrationPersistence, vibrationReducer, type VibrationAction, type VibrationSession } from './vibrationModel'

// Vibration through the model-generic engine (task 50.2; MM-10, MM-13, MM-15, MM-18, MM-19,
// MM-26). The definition is complete but deliberately not registered in state/models.ts and not
// linked from the catalog: registration and card gating belong to 50.3 (VIB-16).

const ch = vibrationChallenge()
const T0 = '2026-10-17T10:00:00.000Z'

function fresh(): VibrationSession {
  const r = initSessionWith(vibrationModel, ch, T0, 'base-1')
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}
const run = (s: VibrationSession, actions: VibrationAction[]) => actions.reduce((acc, a) => vibrationReducer(acc, a, ch), s)
const edit = (e: VibrationEdit): VibrationAction => ({ type: 'edit', edit: e })
/** The object at a dotted path of parsed JSON ('' = root), for targeted corruption. */
const at = (d: unknown, path: string): Record<string, unknown> =>
  (path === '' ? d : path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], d)) as Record<string, unknown>
const toReference: VibrationAction[] = [
  edit({ type: 'setStiffness', valueNPerM: 85000, mode: 'strict' }),
  edit({ type: 'setMaterial', materialId: 'neoprene' }),
]

/** Baseline → reference with the iteration-1 prediction, then reflection and submission. */
function looped(): VibrationSession {
  return run(fresh(), [
    ...toReference,
    { type: 'setPrediction', direction: 'decrease', now: T0 },
    { type: 'runTest', now: T0, id: 'vib-1' },
    { type: 'setReflection', text: 'A softer mount moved the natural frequency well below the band.' },
    { type: 'submit', testResultId: 'vib-1', now: T0 },
  ])
}

describe('vibration learning loop through the engine', () => {
  it('is not registered for dispatch yet: no substitution, an explicit unavailable error (MM-07, VIB-16)', () => {
    expect(modelFor(ch.model)).toBeUndefined()
    expect(() => requireModel(ch)).toThrow(UnregisteredModelError)
    expect(vibrationModel.ref).toEqual({ id: 'sdofBaseIsolation', version: 1 })
    expect(vibrationModel.envelopeVersion).toBe(2)
  })

  it('stores the worksheet baseline with the three resonance failures', () => {
    const base = fresh().history[0]!
    expect(base.analysis.worstInBandTransmissibility).toBeCloseTo(worksheetFixture('baseline').expected.worstInBandTransmissibility, 12)
    expect(base.failures).toEqual(['worstInBandTransmissibility', 'peakTransmissibility', 'relativeDisplacement'])
    expect(base.evaluation.status).toBe('notAccepted')
  })

  it('gates the checkpoint, then records an Accepted reference with a scorable outcome', () => {
    const gated = run(fresh(), [...toReference, { type: 'runTest', now: T0, id: 'x' }])
    expect(gated.ui.predictionDialogOpen).toBe(true)
    expect(gated.history).toHaveLength(1)
    const s = looped()
    const r = s.history[1]!
    expect(r.accepted).toBe(true)
    expect(r.predictionOutcome).toEqual({
      metric: 'worstInBandTransmissibility',
      scorable: true,
      predicted: 'decrease',
      actual: 'decrease',
      ratio: expect.closeTo(VIBRATION_DERIVED.prediction.baselineToReference, 12) as unknown as number,
      matched: true,
    })
    expect(s.submission).toMatchObject({ testResultId: 'vib-1', status: 'accepted', efficiency: r.evaluation.efficiency })
  })

  it('scores more damping at the same stiffness as an increase (reference → dampedReference)', () => {
    let s = run(looped(), [edit({ type: 'setMaterial', materialId: 'butylRubber' }), { type: 'runTest', now: T0, id: 'vib-2' }])
    expect(s.history[2]!.failures).toEqual(['worstInBandTransmissibility'])
    s = run(s, [edit({ type: 'setMaterial', materialId: 'neoprene' }), { type: 'setPrediction', direction: 'increase', now: T0 }, { type: 'runTest', now: T0, id: 'vib-3' }])
    expect(s.history[3]!.predictionOutcome).toMatchObject({ scorable: true, actual: 'decrease', matched: false })
  })

  it('rejects an invalid edit without changing the draft', () => {
    const s = fresh()
    for (const e of [
      edit({ type: 'setStiffness', valueNPerM: 19500, mode: 'strict' }),
      edit({ type: 'setMaterial', materialId: 'cork' }),
    ]) {
      const bad = vibrationReducer(s, e, ch)
      expect(bad.draft).toBe(s.draft)
      expect(bad.draftErrors.length).toBeGreaterThan(0)
      expect(bad.draftStatus).toBe(s.draftStatus)
    }
  })

  it('shares restore, delete, compare and reset semantics with the beam', () => {
    let s = looped()
    s = vibrationReducer(s, { type: 'restore', testResultId: 'base-1' }, ch)
    expect(s.draft.stiffnessNPerM).toBe(1800000)
    expect(s.draftStatus).toBe('draft')
    s = vibrationReducer(s, { type: 'deleteIteration', testResultId: 'vib-1' }, ch)
    expect(s.deletedIterationIds).toEqual(['vib-1'])
    expect(s.submission).toBeUndefined()
    expect(s.history).toHaveLength(2)
    s = vibrationReducer(s, { type: 'reset' }, ch)
    expect(s.reflectionAnswer).toBe('')
    expect(s.history).toHaveLength(2)
  })

  it('turns an analysis invariant failure into a notice without appending a result', () => {
    const broken = { ...ch, mount: { linearStrokeM: 0 } }
    const s = run(fresh(), [edit({ type: 'setStiffness', valueNPerM: 90000, mode: 'strict' }), { type: 'setPrediction', direction: 'decrease', now: T0 }])
    const next = vibrationReducer(s, { type: 'runTest', now: T0, id: 'x' }, broken)
    expect(next.history).toHaveLength(1)
    expect(next.ui.notice?.message).toContain('strokeRatio')
  })
})

describe('not-scorable predictions (MM-13)', () => {
  const p = { iteration: 1, direction: 'decrease' as const, createdAt: T0 }
  const base = fresh().history[0]!

  it.each([[0], [Number.NaN], [Number.POSITIVE_INFINITY], [-1]])('a stored primary metric of %s on either side is not scorable', (v) => {
    const broken = { ...base.analysis, worstInBandTransmissibility: v }
    const expected = { metric: 'worstInBandTransmissibility', scorable: false, predicted: 'decrease', reason: 'noFiniteMetric' }
    expect(vibrationModel.scorePrediction(p, base, broken)).toEqual(expected)
    expect(vibrationModel.scorePrediction(p, { ...base, analysis: broken }, base.analysis)).toEqual(expected)
  })

  it('classifies finite ratios with the shared band', () => {
    expect(scorePredictionByMetric(p, 'm', 1, 0.98)).toMatchObject({ scorable: true, actual: 'same', matched: false })
    expect(scorePredictionByMetric(p, 'm', 1, 0.9799)).toMatchObject({ scorable: true, actual: 'decrease', matched: true })
  })
})

describe('v2 persistence (MM-18)', () => {
  const restore = (raw: string) => deserializeSessionV2(vibrationModel, vibrationPersistence, raw, ch)

  it('round-trips a full session including explicit undefined fields', () => {
    const s = vibrationReducer(looped(), { type: 'cancelPrediction' }, ch)
    const raw = serializeSessionV2(vibrationModel.ref, s, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: { id: 'sdofBaseIsolation', version: 1 } })
    const r = restore(raw)
    if (!r.ok) throw new Error(r.error)
    expect(JSON.parse(serializeSessionV2(vibrationModel.ref, r.value, T0))).toEqual(JSON.parse(raw))
    expect(Object.prototype.hasOwnProperty.call(r.value, 'pendingPrediction')).toBe(true)
  })

  it('round-trips rejected-edit draft errors with vibration codes', () => {
    const s = vibrationReducer(fresh(), edit({ type: 'setMaterial', materialId: 'cork' }), ch)
    expect(s.draftErrors.map((e) => e.code)).toEqual(['MATERIAL_NOT_ALLOWED'])
    const r = restore(serializeSessionV2(vibrationModel.ref, s, T0))
    expect(r.ok && r.value.draftErrors).toEqual(s.draftErrors)
  })

  it.each([
    ['tampered analysis', (d: unknown) => { const a = at(d, 'session.history.1.analysis'); a.worstInBandTransmissibility = (a.worstInBandTransmissibility as number) * 2 }, 'Saved results differ from recomputed results'],
    ['removed isolation efficiency', (d: unknown) => { delete at(d, 'session.history.1.analysis').isolationEfficiency }, 'Saved results differ from recomputed results'],
    ['tampered outcome', (d: unknown) => { at(d, 'session.history.1.predictionOutcome').matched = false }, 'Invalid prediction outcome'],
    ['other model', (d: unknown) => { at(d, 'model').id = 'circularShaftTorsion' }, 'Saved session belongs to a different model'],
    ['other model version', (d: unknown) => { at(d, 'model').version = 2 }, 'Saved session belongs to a different model'],
    ['v1 envelope', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'Unsupported saved session version'],
    ['locked mass on the draft', (d: unknown) => { at(d, 'session.draft').massKg = 40 }, undefined],
    ['out-of-range snapshot', (d: unknown) => { at(d, 'session.history.1.designSnapshot').stiffnessNPerM = 19500 }, undefined],
    ['unlisted material', (d: unknown) => { at(d, 'session.draft').materialId = 'cork' }, undefined],
    ['torsion failure id', (d: unknown) => { at(d, 'session.history.0').failures = ['twist'] }, undefined],
    ['torsion draft error code', (d: unknown) => { at(d, 'session').draftErrors = [{ code: 'WALL_TOO_THIN', message: 'x' }] }, undefined],
  ])('rejects %s all-or-nothing', (_name, mutate, message) => {
    const data = JSON.parse(serializeSessionV2(vibrationModel.ref, looped(), T0))
    mutate(data)
    const r = restore(JSON.stringify(data))
    expect(r.ok).toBe(false)
    if (!r.ok && message) expect(r.error).toBe(message)
  })

  it('never reads a v1 beam save or a torsion save as vibration, nor a vibration save as a beam session', () => {
    const beamRaw = readFileSync(new URL('../../test/fixtures/sessions/cantilever-beam-1.v1.json', import.meta.url), 'utf8')
    expect(restore(beamRaw).ok).toBe(false)
    const tch = torsionChallenge()
    const torsion = initSessionWith(torsionModel, tch, T0, 'tor-base')
    if (!torsion.ok) throw new Error(torsion.error.message)
    expect(restore(serializeSessionV2(torsionModel.ref, torsion.value, T0)).ok).toBe(false)
    expect(deserializeSession(serializeSessionV2(vibrationModel.ref, looped(), T0), bundledChallenge()).ok).toBe(false)
  })
})

describe('v2 design files (MM-19)', () => {
  const design = looped().history[1]!.designSnapshot

  it('exports with model identity and imports a fresh equal design', () => {
    const text = vibrationModel.exportDesign(design, ch)
    expect(JSON.parse(text)).toEqual({
      format: 'ei-design',
      schemaVersion: 2,
      challengeId: 'vibration-isolation-1',
      model: { id: 'sdofBaseIsolation', version: 1 },
      design: { id: design.id, stiffnessNPerM: 85000, materialId: 'neoprene' },
    })
    const r = vibrationModel.importDesign(text, ch)
    if (!r.ok) throw new Error(r.error.join('; '))
    expect(r.value).toEqual(design)
    expect(r.value).not.toBe(design)
  })

  it.each([
    ['another challenge', (d: unknown) => { at(d, '').challengeId = 'torsion-shaft-1' }, 'different challenge'],
    ['another model', (d: unknown) => { at(d, '').model = { id: 'circularShaftTorsion', version: 1 } }, 'different analysis model'],
    ['v1 version', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'schemaVersion must be 2'],
    ['locked mass', (d: unknown) => { at(d, 'design').massKg = 40 }, 'Unexpected key "design.massKg"'],
    ['out-of-range stiffness', (d: unknown) => { at(d, 'design').stiffnessNPerM = 2000500 }, 'at most 2000 kN/m'],
    ['unlisted material', (d: unknown) => { at(d, 'design').materialId = 'cork' }, 'is not available in this challenge'],
    ['non-positive stiffness', (d: unknown) => { at(d, 'design').stiffnessNPerM = 0 }, 'design.stiffnessNPerM'],
    ['unknown top-level key', (d: unknown) => { at(d, '').extra = 1 }, 'Unexpected key "extra"'],
  ])('rejects %s', (_name, mutate, fragment) => {
    const data = JSON.parse(vibrationModel.exportDesign(design, ch))
    mutate(data)
    const r = vibrationModel.importDesign(JSON.stringify(data), ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.join(' ')).toContain(fragment)
  })

  it('rejects beam v1 and torsion v2 design files and a forbidden key without reading further', () => {
    const beam = bundledChallenge()
    expect(vibrationModel.importDesign(exportBeamDesign(beam.initialDesign, beam), ch).ok).toBe(false)
    const tch = torsionChallenge()
    expect(vibrationModel.importDesign(torsionModel.exportDesign(tch.initialDesign, tch), ch).ok).toBe(false)
    expect(vibrationModel.importDesign('{"__proto__":{"x":1},"format":"ei-design"}', ch).ok).toBe(false)
  })

  it('a failed import leaves the session unchanged; a valid one replaces the draft', () => {
    const s = looped()
    expect(vibrationReducer(s, { type: 'importDesign', json: '{' }, ch)).toBe(s)
    const text = vibrationModel.exportDesign({ id: 'imp', stiffnessNPerM: 70000, materialId: 'butylRubber' }, ch)
    const next = vibrationReducer(s, { type: 'importDesign', json: text }, ch)
    expect(next.draft).toEqual({ id: 'imp', stiffnessNPerM: 70000, materialId: 'butylRubber' })
    expect(next.draftStatus).toBe('draft')
  })
})

// Feature: multi-model-architecture, Property 1: engine invariants hold for a non-beam model
describe('engine invariants for vibration action sequences', () => {
  const arbEdit: fc.Arbitrary<VibrationAction> = fc.oneof(
    fc.constantFrom(...ch.materials.map((m) => m.id), 'cork').map((materialId) => edit({ type: 'setMaterial', materialId })),
    fc
      .record({
        valueNPerM: fc.oneof(fc.double({ min: 0, max: 3e6, noNaN: true }), fc.constantFrom(Number.NaN, 19500, 2000500)),
        mode: fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict'),
      })
      .map(({ valueNPerM, mode }) => edit({ type: 'setStiffness', valueNPerM, mode })),
  )
  const arbAction: fc.Arbitrary<VibrationAction> = fc.oneof(
    arbEdit,
    fc.constantFrom<'increase' | 'decrease' | 'same'>('increase', 'decrease', 'same').map((direction) => ({ type: 'setPrediction' as const, direction, now: T0 })),
    fc.nat(99).map((n) => ({ type: 'runTest' as const, now: T0, id: `t-${n}` })),
    fc.constant({ type: 'reset' as const }),
  )

  it('keeps history append-only, drafts valid, checkpoints predicted and reduction pure', () => {
    assertProperty(fc.property(fc.array(arbAction, { maxLength: 25 }), (actions) => {
      let s = fresh()
      for (const a of actions) {
        const before = s
        const frozen = JSON.stringify(before)
        const next = vibrationReducer(before, a, ch)
        expect(JSON.stringify(before)).toBe(frozen)
        expect(vibrationReducer(before, a, ch)).toEqual(next)
        expect(next.history.slice(0, before.history.length)).toEqual(before.history)
        for (let i = 0; i < before.history.length; i++) expect(next.history[i]).toBe(before.history[i])
        expect(vibrationModel.validateDesign(next.draft, ch)).toEqual([])
        for (const r of next.history) {
          if (ch.predictionPolicy.requiredOnIterations.includes(r.iteration)) expect(r.predictionOutcome).toBeDefined()
          expect(r.accepted).toBe(r.evaluation.status === 'accepted')
        }
        s = next
      }
    }))
  })
})
