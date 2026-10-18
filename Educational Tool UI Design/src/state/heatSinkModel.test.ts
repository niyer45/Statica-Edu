import fc from 'fast-check'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../test/arbitraries'
import { HEAT_SINK_DERIVED, heatSinkChallenge, worksheetFixture } from '../../test/fixtures/heatSink'
import { torsionChallenge } from '../../test/fixtures/torsion'
import { assertProperty } from '../../test/pbt'
import { scorePredictionByMetric } from '../evaluation/prediction'
import type { HeatSinkEdit } from '../geometry/heatSink/edit'
import { HeatSinkInvariantError } from '../physics/heatSink/analyze'
import { initSessionWith } from './engine'
import { heatSinkModel, heatSinkPersistence, heatSinkReducer, type HeatSinkAction, type HeatSinkSession } from './heatSinkModel'
import { exportDesign as exportBeamDesign } from './importExport'
import { modelFor, REGISTERED_MODEL_IDS } from './models'
import { deserializeSession, deserializeSessionV2, serializeSessionV2 } from './persistence'
import { torsionModel } from './torsionModel'

// Heat sink through the model-generic engine (task 48.2; MM-10, MM-13, MM-15, MM-18, MM-19).
// The definition is registered for dispatch (48.3); the catalog card stays unavailable until
// owner-approved activation (HSK-16).

const ch = heatSinkChallenge()
const T0 = '2026-10-17T10:00:00.000Z'

function fresh(): HeatSinkSession {
  const r = initSessionWith(heatSinkModel, ch, T0, 'base-1')
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}
const run = (s: HeatSinkSession, actions: HeatSinkAction[]) => actions.reduce((acc, a) => heatSinkReducer(acc, a, ch), s)
const edit = (e: HeatSinkEdit): HeatSinkAction => ({ type: 'edit', edit: e })
const set = (param: string, value: number, mode: 'clamp' | 'strict' = 'strict') => edit({ type: 'setParam', param, value, mode })
/** The object at a dotted path of parsed JSON ('' = root), for targeted corruption. */
const at = (d: unknown, path: string): Record<string, unknown> =>
  (path === '' ? d : path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], d)) as Record<string, unknown>
const toReference: HeatSinkAction[] = [set('finThicknessM', 0.0015), set('finCount', 10), set('finHeightM', 0.035)]

/** Baseline → reference with the iteration-1 prediction, then reflection and submission. */
function looped(): HeatSinkSession {
  return run(fresh(), [
    ...toReference,
    { type: 'setPrediction', direction: 'decrease', now: T0 },
    { type: 'runTest', now: T0, id: 'hs-1' },
    { type: 'setReflection', text: 'More, thinner and taller fins added surface area.' },
    { type: 'submit', testResultId: 'hs-1', now: T0 },
  ])
}

describe('heat sink learning loop through the engine', () => {
  it('declares v2 persistence and the base temperature rise as its primary metric', () => {
    expect(heatSinkModel.ref).toEqual({ id: 'plateFinHeatSink', version: 1 })
    expect(heatSinkModel.envelopeVersion).toBe(2)
    expect(heatSinkModel.primaryMetric).toMatchObject({ id: 'baseTemperatureRiseK', label: 'base temperature rise' })
    expect(Object.isFrozen(heatSinkModel)).toBe(true)
  })

  it('is registered and dispatchable by its exact identity only (48.3, MM-05, MM-07)', () => {
    expect(REGISTERED_MODEL_IDS).toContain('plateFinHeatSink')
    expect(modelFor(ch.model)).toBe(heatSinkModel)
    expect(modelFor({ id: 'plateFinHeatSink', version: 2 })).toBeUndefined()
  })

  it('stores the worksheet baseline and fails baseTemperature, mass and finHeight', () => {
    const base = fresh().history[0]!
    expect(base.analysis.baseTemperatureK).toBeCloseTo(worksheetFixture('baseline').expected.baseTemperatureK, 9)
    expect(base.analysis.massKg).toBeCloseTo(worksheetFixture('baseline').expected.massKg, 12)
    expect(base.failures).toEqual(['baseTemperature', 'mass', 'finHeight'])
    expect(base.evaluation.status).toBe('notAccepted')
  })

  it('gates the checkpoint, then records an Accepted reference with a scorable rise outcome', () => {
    const gated = run(fresh(), [...toReference, { type: 'runTest', now: T0, id: 'x' }])
    expect(gated.ui.predictionDialogOpen).toBe(true)
    expect(gated.history).toHaveLength(1)
    const s = looped()
    const r = s.history[1]!
    expect(r.accepted).toBe(true)
    expect(r.predictionOutcome).toEqual({
      metric: 'baseTemperatureRiseK',
      scorable: true,
      predicted: 'decrease',
      actual: 'decrease',
      ratio: expect.closeTo(HEAT_SINK_DERIVED.baselineToReferenceRiseRatio, 12) as unknown as number,
      matched: true,
    })
    expect(s.submission).toMatchObject({ testResultId: 'hs-1', status: 'accepted', efficiency: r.evaluation.efficiency })
  })

  it('rejects an invalid edit without changing the draft', () => {
    const s = fresh()
    for (const bad of [set('finCount', 1), set('finCount', 20), set('finThicknessM', 0.0032), set('materialId', 1)]) {
      const next = heatSinkReducer(s, bad, ch)
      expect(next.draft).toBe(s.draft)
      expect(next.draftErrors.length).toBeGreaterThan(0)
      expect(next.draftStatus).toBe(s.draftStatus)
    }
  })

  it('turns an analysis invariant failure into a notice without appending a result', () => {
    const broken = { ...ch, heatLoadW: 0 }
    const s = run(fresh(), [set('finCount', 5), { type: 'setPrediction', direction: 'decrease', now: T0 }])
    const r = heatSinkReducer(s, { type: 'runTest', now: T0, id: 'x' }, broken)
    expect(r.history).toHaveLength(1)
    expect(r.ui.notice?.kind).toBe('error')
    expect(r.ui.notice?.message).toContain('baseTemperatureRiseK')
    expect(heatSinkModel.isInvariantError(new HeatSinkInvariantError('f', 0))).toBe(true)
    expect(heatSinkModel.isInvariantError(new Error('other'))).toBe(false)
  })

  it('shares restore, delete, compare and reset semantics with the beam', () => {
    let s = looped()
    s = heatSinkReducer(s, { type: 'restore', testResultId: 'base-1' }, ch)
    expect(s.draft.finCount).toBe(3)
    expect(s.draftStatus).toBe('draft')
    s = heatSinkReducer(s, { type: 'deleteIteration', testResultId: 'hs-1' }, ch)
    expect(s.deletedIterationIds).toEqual(['hs-1'])
    expect(s.submission).toBeUndefined()
    expect(s.history).toHaveLength(2)
    s = heatSinkReducer(s, { type: 'reset' }, ch)
    expect(s.reflectionAnswer).toBe('')
    expect(s.history).toHaveLength(2)
  })
})

describe('not-scorable predictions (MM-13)', () => {
  const p = { iteration: 1, direction: 'decrease' as const, createdAt: T0 }
  const base = fresh().history[0]!

  it('a previous result without a finite positive rise is not scorable', () => {
    const prev = { ...base, analysis: { ...base.analysis, baseTemperatureRiseK: Number.NaN } }
    expect(heatSinkModel.scorePrediction(p, prev, base.analysis)).toEqual({
      metric: 'baseTemperatureRiseK',
      scorable: false,
      predicted: 'decrease',
      reason: 'noFiniteMetric',
    })
    expect(heatSinkModel.scorePrediction(p, base, { ...base.analysis, baseTemperatureRiseK: 0 })).toMatchObject({ scorable: false })
  })

  it('an unchanged rise classifies as same with the shared band', () => {
    expect(heatSinkModel.scorePrediction(p, base, base.analysis)).toMatchObject({ scorable: true, actual: 'same', ratio: 1, matched: false })
    expect(scorePredictionByMetric(p, 'baseTemperatureRiseK', 10, 9.7)).toMatchObject({ scorable: true, actual: 'decrease', matched: true })
  })
})

describe('v2 persistence (MM-18)', () => {
  const restore = (raw: string) => deserializeSessionV2(heatSinkModel, heatSinkPersistence, raw, ch)

  it('round-trips a full session including the stored profile and explicit undefined fields', () => {
    const s = heatSinkReducer(looped(), { type: 'cancelPrediction' }, ch)
    const raw = serializeSessionV2(heatSinkModel.ref, s, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: { id: 'plateFinHeatSink', version: 1 } })
    const r = restore(raw)
    if (!r.ok) throw new Error(r.error)
    expect(JSON.parse(serializeSessionV2(heatSinkModel.ref, r.value, T0))).toEqual(JSON.parse(raw))
    expect(r.value.history[1]!.analysis.finProfile).toHaveLength(5)
    expect(Object.prototype.hasOwnProperty.call(r.value, 'pendingPrediction')).toBe(true)
  })

  it('round-trips heat sink draft error codes', () => {
    const s = run(fresh(), [set('finCount', 20), set('baseWidthM', 1)])
    expect(s.draftErrors.map((e) => e.code)).toEqual(['UNKNOWN_PARAM'])
    const r = restore(serializeSessionV2(heatSinkModel.ref, run(fresh(), [set('finThicknessM', 0.0032)]), T0))
    expect(r.ok && r.value.draftErrors.map((e) => e.code)).toEqual(['OFF_STEP'])
    expect(restore(serializeSessionV2(heatSinkModel.ref, s, T0)).ok).toBe(true)
  })

  it.each([
    ['tampered analysis', (d: unknown) => { const a = at(d, 'session.history.1.analysis'); a.baseTemperatureK = (a.baseTemperatureK as number) + 1 }, 'Saved results differ from recomputed results'],
    ['tampered profile sample', (d: unknown) => { at(d, 'session.history.1.analysis.finProfile.4').temperatureK = 320 }, 'Saved results differ from recomputed results'],
    ['tampered outcome', (d: unknown) => { at(d, 'session.history.1.predictionOutcome').matched = false }, 'Invalid prediction outcome'],
    ['other model', (d: unknown) => { at(d, 'model').id = 'circularShaftTorsion' }, 'Saved session belongs to a different model'],
    ['v1 envelope', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'Unsupported saved session version'],
    ['locked material', (d: unknown) => { at(d, 'session.draft').materialId = 'copper' }, undefined],
    ['merged fins in history', (d: unknown) => { at(d, 'session.history.1.designSnapshot').finCount = 20; at(d, 'session.history.1.designSnapshot').finThicknessM = 0.003 }, undefined],
    ['torsion failure id', (d: unknown) => { at(d, 'session.history.0').failures = ['twist'] }, undefined],
    ['beam draft error code', (d: unknown) => { at(d, 'session').draftErrors = [{ code: 'WALL_TOO_THIN', message: 'x' }] }, undefined],
  ])('rejects %s all-or-nothing', (_name, mutate, message) => {
    const data = JSON.parse(serializeSessionV2(heatSinkModel.ref, looped(), T0))
    mutate(data)
    const r = restore(JSON.stringify(data))
    expect(r.ok).toBe(false)
    if (!r.ok && message) expect(r.error).toBe(message)
  })

  it('never reads a beam or torsion save as heat sink, nor a heat sink save as a beam session', () => {
    const beamRaw = readFileSync(new URL('../../test/fixtures/sessions/cantilever-beam-1.v1.json', import.meta.url), 'utf8')
    expect(restore(beamRaw).ok).toBe(false)
    const torsion = initSessionWith(torsionModel, torsionChallenge(), T0, 'tor-base')
    if (!torsion.ok) throw new Error(torsion.error.message)
    expect(restore(serializeSessionV2(torsionModel.ref, torsion.value, T0)).ok).toBe(false)
    expect(deserializeSession(serializeSessionV2(heatSinkModel.ref, looped(), T0), bundledChallenge()).ok).toBe(false)
  })
})

describe('v2 design files (MM-19)', () => {
  const design = looped().history[1]!.designSnapshot

  it('exports with model identity and imports a fresh equal design', () => {
    const text = heatSinkModel.exportDesign(design, ch)
    expect(JSON.parse(text)).toMatchObject({
      format: 'ei-design',
      schemaVersion: 2,
      challengeId: 'heat-sink-1',
      model: { id: 'plateFinHeatSink', version: 1 },
      design: { finCount: 10, finThicknessM: 0.0015, finHeightM: 0.035, materialId: 'aluminum-educational' },
    })
    expect(Object.keys(JSON.parse(text).design)).toEqual(['id', 'finCount', 'finThicknessM', 'finHeightM', 'materialId'])
    const r = heatSinkModel.importDesign(text, ch)
    if (!r.ok) throw new Error(r.error.join('; '))
    expect(r.value).toEqual(design)
    expect(r.value).not.toBe(design)
  })

  it.each([
    ['another challenge', (d: unknown) => { at(d, '').challengeId = 'torsion-shaft-1' }, 'different challenge'],
    ['another model', (d: unknown) => { at(d, '').model = { id: 'circularShaftTorsion', version: 1 } }, 'different analysis model'],
    ['v1 version', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'schemaVersion must be 2'],
    ['locked material', (d: unknown) => { at(d, 'design').materialId = 'copper' }, 'fixed'],
    ['N = 1', (d: unknown) => { at(d, 'design').finCount = 1 }, 'Fin count must be at least 2'],
    ['merged fins', (d: unknown) => { at(d, 'design').finCount = 20; at(d, 'design').finThicknessM = 0.003 }, 'Fins overlap'],
    ['gap below 1 mm', (d: unknown) => { at(d, 'design').finCount = 20; at(d, 'design').finThicknessM = 0.0025 }, 'too close together'],
    ['non-integer count', (d: unknown) => { at(d, 'design').finCount = 9.5 }, 'whole number'],
    ['off-step height', (d: unknown) => { at(d, 'design').finHeightM = 0.0355 }, 'multiple of 1 mm'],
    ['zero thickness', (d: unknown) => { at(d, 'design').finThicknessM = 0 }, 'design.finThicknessM'],
    ['unknown design key', (d: unknown) => { at(d, 'design').heatLoadW = 1 }, 'Unexpected key "design.heatLoadW"'],
    ['unknown top-level key', (d: unknown) => { at(d, '').extra = 1 }, 'Unexpected key "extra"'],
  ])('rejects %s', (_name, mutate, fragment) => {
    const data = JSON.parse(heatSinkModel.exportDesign(design, ch))
    mutate(data)
    const r = heatSinkModel.importDesign(JSON.stringify(data), ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.join(' ')).toContain(fragment)
  })

  it('lists the locked-field reason first', () => {
    const data = JSON.parse(heatSinkModel.exportDesign(design, ch))
    at(data, 'design').finCount = 1
    at(data, 'design').materialId = 'copper'
    const r = heatSinkModel.importDesign(JSON.stringify(data), ch)
    expect(!r.ok && r.error[0]).toContain('Material is fixed')
  })

  it('rejects a beam v1 design file and a forbidden key without reading further', () => {
    const beam = bundledChallenge()
    expect(heatSinkModel.importDesign(exportBeamDesign(beam.initialDesign, beam), ch).ok).toBe(false)
    expect(heatSinkModel.importDesign('{"__proto__":{"x":1},"format":"ei-design"}', ch).ok).toBe(false)
  })

  it('an import through the reducer replaces the draft; a failed import leaves the session unchanged', () => {
    const s = fresh()
    const imported = heatSinkReducer(s, { type: 'importDesign', json: heatSinkModel.exportDesign(design, ch) }, ch)
    expect(imported.draft).toEqual(design)
    expect(imported.draftStatus).toBe('draft')
    expect(heatSinkReducer(s, { type: 'importDesign', json: '{' }, ch)).toBe(s)
  })
})

// Feature: multi-model-architecture, Property 1: engine invariants hold for a non-beam model
describe('engine invariants for heat sink action sequences', () => {
  const arbEdit: fc.Arbitrary<HeatSinkAction> = fc
    .record({
      param: fc.constantFrom('finCount', 'finThicknessM', 'finHeightM', 'materialId'),
      value: fc.oneof(fc.integer({ min: -1, max: 22 }), fc.double({ min: 0, max: 0.05, noNaN: true }), fc.constant(Number.NaN)),
      mode: fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict'),
    })
    .map(({ param, value, mode }) => set(param, value, mode))
  const arbAction: fc.Arbitrary<HeatSinkAction> = fc.oneof(
    arbEdit,
    fc.constantFrom<'increase' | 'decrease' | 'same'>('increase', 'decrease', 'same').map((direction) => ({ type: 'setPrediction' as const, direction, now: T0 })),
    fc.nat(99).map((n) => ({ type: 'runTest' as const, now: T0, id: `t-${n}` })),
    fc.constant({ type: 'reset' as const }),
    fc.constant({ type: 'resetDraft' as const }),
  )

  it('keeps history append-only, drafts valid, checkpoints predicted and reduction pure', () => {
    assertProperty(
      fc.property(fc.array(arbAction, { maxLength: 25 }), (actions) => {
        let s = fresh()
        for (const a of actions) {
          const before = s
          const frozen = JSON.stringify(before)
          const next = heatSinkReducer(before, a, ch)
          expect(JSON.stringify(before)).toBe(frozen)
          expect(heatSinkReducer(before, a, ch)).toEqual(next)
          expect(next.history.slice(0, before.history.length)).toEqual(before.history)
          for (let i = 0; i < before.history.length; i++) expect(next.history[i]).toBe(before.history[i])
          expect(heatSinkModel.validateDesign(next.draft, ch)).toEqual([])
          for (const r of next.history) {
            if (ch.predictionPolicy.requiredOnIterations.includes(r.iteration)) expect(r.predictionOutcome).toBeDefined()
            expect(r.accepted).toBe(r.evaluation.status === 'accepted')
          }
          s = next
        }
      }),
    )
  })
})
