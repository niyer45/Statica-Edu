import fc from 'fast-check'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../test/arbitraries'
import { bracketChallenge } from '../../test/fixtures/bracket'
import { fatigueChallenge, worksheetFixture } from '../../test/fixtures/fatigue'
import { assertProperty } from '../../test/pbt'
import { FATIGUE_GUIDED_PLAN } from '../evaluation/guided/fatigue'
import { bracketModel } from './bracketModel'
import { initSessionWith } from './engine'
import { fatigueModel, fatiguePersistence, fatigueReducer, parseFatigueDesign, type FatigueAction, type FatigueSession } from './fatigueModel'
import { exportDesign as exportBeamDesign } from './importExport'
import { modelFor, requireModel } from './models'
import { deserializeSession, deserializeSessionV2, serializeSessionV2 } from './persistence'
import { fatigueRuntime } from './runtimes'

// Fatigue Analysis I through the model-generic engine (task 70; MM-10, MM-13, MM-15, MM-18,
// MM-19, MM-26).

const ch = fatigueChallenge()
const T0 = '2026-10-19T10:00:00.000Z'

function fresh(): FatigueSession {
  const r = initSessionWith(fatigueModel, ch, T0, 'base-1')
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}
const run = (s: FatigueSession, actions: FatigueAction[]) => actions.reduce((acc, a) => fatigueReducer(acc, a, ch), s)
const set = (param: string, valueM: number, mode: 'clamp' | 'strict' = 'strict'): FatigueAction => ({ type: 'edit', edit: { type: 'setParam', param, valueM, mode } })
const finish = (f: string): FatigueAction => ({ type: 'edit', edit: { type: 'setFinish', finish: f } })
const at = (d: unknown, path: string): Record<string, unknown> =>
  (path === '' ? d : path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], d)) as Record<string, unknown>

/** Baseline → reference (predicted), → fitRangeNA (not applicable), → referenceForged (predicted), submit the reference. */
function looped(): FatigueSession {
  return run(fresh(), [
    set('collarDiameterM', 0.034),
    set('neckDiameterM', 0.0245),
    set('filletRadiusM', 0.002),
    finish('machined'),
    { type: 'setPrediction', direction: 'increase', now: T0 },
    { type: 'runTest', now: T0, id: 'fa-1' },
    set('collarDiameterM', 0.06),
    set('neckDiameterM', 0.02),
    set('filletRadiusM', 0.0005),
    { type: 'runTest', now: T0, id: 'fa-2' },
    set('collarDiameterM', 0.034),
    set('neckDiameterM', 0.0245),
    set('filletRadiusM', 0.002),
    finish('asForged'),
    { type: 'setPrediction', direction: 'increase', now: T0 },
    { type: 'runTest', now: T0, id: 'fa-3' },
    { type: 'setReflection', text: 'The sharp forged fillet governed; a rounder machined fillet on a slightly thicker neck with a trimmed collar passed.' },
    { type: 'submit', testResultId: 'fa-1', now: T0 },
  ])
}

describe('fatigue learning loop through the engine', () => {
  it('dispatches only to the fatigue definition by explicit identity', () => {
    expect(fatigueModel.ref).toEqual({ id: 'steppedShaftFatigue', version: 1 })
    expect(fatigueModel.envelopeVersion).toBe(2)
    expect(modelFor(ch.model)).toBe(fatigueModel)
    expect(requireModel(ch)).toBe(fatigueModel)
    expect(modelFor({ id: 'steppedShaftFatigue', version: 2 })).toBeUndefined()
  })

  it('stores the worksheet Baseline, failing fatigue, yield and mass', () => {
    const base = fresh().history[0]!
    expect(base.analysis.fatigueSafetyFactor).toBeCloseTo(worksheetFixture('baseline').expected.nf, 12)
    expect(base.failures).toEqual(['fatigueSafetyFactor', 'yieldSafetyFactor', 'mass'])
  })

  it('gates the checkpoint, then records an Accepted reference with a scorable fatigue-safety-factor outcome', () => {
    const gated = run(fresh(), [set('filletRadiusM', 0.002), { type: 'runTest', now: T0, id: 'x' }])
    expect(gated.ui.predictionDialogOpen).toBe(true)
    expect(gated.history).toHaveLength(1)
    const r = looped().history[1]!
    expect(r.accepted).toBe(true)
    expect(r.predictionOutcome).toEqual({
      metric: 'fatigueSafetyFactor',
      scorable: true,
      predicted: 'increase',
      actual: 'increase',
      ratio: expect.closeTo(1.40168491090465 / 0.622303118562314, 12) as unknown as number,
      matched: true,
    })
  })

  it('records a not-applicable result with every quantity stored and no NaN or null', () => {
    const r = looped().history[2]!
    expect(r.evaluation.status).toBe('modelNotApplicable')
    expect(r.analysis.notApplicableReasons.map((i) => i.code)).toEqual(['KT_FIT_RANGE', 'LOCAL_YIELD', 'LOW_CYCLE'])
    expect(r.analysis.lifeRegime).toBe('lowCycle')
    expect(JSON.stringify(r)).not.toMatch(/NaN|null/)
  })

  it('scores the next checkpoint and records the submission', () => {
    const s = looped()
    expect(s.history[3]!.failures).toEqual(['fatigueSafetyFactor'])
    expect(s.history[3]!.predictionOutcome).toMatchObject({ metric: 'fatigueSafetyFactor', scorable: true, predicted: 'increase', actual: 'increase', matched: true })
    expect(s.submission).toMatchObject({ testResultId: 'fa-1', status: 'accepted' })
  })

  it('rejects out-of-range, step-violating and unknown edits without changing the draft', () => {
    const s = fresh()
    expect(fatigueReducer(s, set('collarDiameterM', 0.07), ch).draftErrors.map((e) => e.code)).toEqual(['ABOVE_MAX'])
    const narrow = fatigueReducer(s, set('collarDiameterM', 0.03), ch)
    const step = fatigueReducer(narrow, set('neckDiameterM', 0.029), ch)
    expect(step.draft).toBe(narrow.draft)
    expect(step.draftErrors.map((e) => e.code)).toEqual(['FILLET_EXCEEDS_STEP'])
    expect(fatigueReducer(s, set('lengthM', 0.1), ch).draftErrors.map((e) => e.code)).toEqual(['UNKNOWN_PARAM'])
    expect(fatigueReducer(s, finish('polished'), ch).draftErrors.map((e) => e.code)).toEqual(['FINISH_NOT_ALLOWED'])
  })

  it('tracks draft status and resets to a fresh Baseline (D-51)', () => {
    const s = fatigueReducer(fresh(), finish('ground'), ch)
    expect(s.draftStatus).toBe('draft')
    expect(fatigueReducer(s, finish('asForged'), ch).draftStatus).toBe('tested')
    const reset = fatigueRuntime.reduce(looped(), { type: 'resetDraft', now: T0, id: 'base-2' }, ch)
    expect(reset.history).toHaveLength(1)
    expect(reset.submission).toBeUndefined()
    expect(reset.draft).toEqual({ ...ch.initialDesign })
  })

  it('Guided plan parameters and observed metrics read the stored design and analysis', () => {
    const r = looped().history[1]!
    expect(FATIGUE_GUIDED_PLAN.params(r.designSnapshot)).toEqual({ neckDiameterM: 0.0245, collarDiameterM: 0.034, filletRadiusM: 0.002, surfaceFinish: 'machined' })
    expect(FATIGUE_GUIDED_PLAN.label('surfaceFinish')).toBe('Surface finish')
    expect(FATIGUE_GUIDED_PLAN.label('other')).toBe('other')
    for (const [id, m] of Object.entries(FATIGUE_GUIDED_PLAN.metrics)) expect(m.read(r)).toBe(r.analysis[id as keyof typeof r.analysis])
  })

  it('turns a typed invariant error into a notice without appending a result', () => {
    const broken = { ...ch, load: { ...ch.load, armM: Number.POSITIVE_INFINITY } }
    const s = fatigueReducer(fatigueReducer(fresh(), set('filletRadiusM', 0.002), broken), { type: 'setPrediction', direction: 'same', now: T0 }, broken)
    const r = fatigueReducer(s, { type: 'runTest', now: T0, id: 'boom' }, broken)
    expect(r.history).toHaveLength(1)
    expect(r.ui.notice?.kind).toBe('error')
  })
})

describe('v2 persistence (MM-18)', () => {
  const restore = (raw: string) => deserializeSessionV2(fatigueModel, fatiguePersistence, raw, ch)

  it('round-trips a full session, including results with and without a predicted life', () => {
    const s = fatigueReducer(looped(), { type: 'cancelPrediction' }, ch)
    const raw = serializeSessionV2(fatigueModel.ref, s, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: { id: 'steppedShaftFatigue', version: 1 }, session: { challengeVersion: 1 } })
    expect(fatigueRuntime.key(ch)).toBe('ei:session:fatigue-analysis-1:v1')
    const r = restore(raw)
    if (!r.ok) throw new Error(r.error)
    expect(JSON.parse(serializeSessionV2(fatigueModel.ref, r.value, T0))).toEqual(JSON.parse(raw))
    expect('predictedLifeCycles' in r.value.history[0]!.analysis).toBe(true)
    expect('predictedLifeCycles' in r.value.history[1]!.analysis).toBe(false)
  })

  it.each([
    ['tampered fatigue factor', (d: unknown) => { const a = at(d, 'session.history.1.analysis'); a.fatigueSafetyFactor = (a.fatigueSafetyFactor as number) * 2 }, 'Saved results differ from recomputed results'],
    ['an invented life on an infinite-life result', (d: unknown) => { at(d, 'session.history.1.analysis').predictedLifeCycles = 1e6 }, 'Saved results differ from recomputed results'],
    ['a removed life on a finite-life result', (d: unknown) => { delete at(d, 'session.history.0.analysis').predictedLifeCycles }, 'Saved results differ from recomputed results'],
    ['a flipped prediction outcome', (d: unknown) => { Object.assign(at(d, 'session.history.3.predictionOutcome'), { actual: 'decrease', matched: false }) }, 'Invalid prediction outcome'],
    ['other model', (d: unknown) => { at(d, 'model').id = 'boltedLBracket' }, 'Saved session belongs to a different model'],
    ['locked material', (d: unknown) => { at(d, 'session.draft').materialId = 'steel' }, undefined],
    ['unknown finish', (d: unknown) => { at(d, 'session.history.1.designSnapshot').surfaceFinish = 'polished' }, undefined],
    ['bracket failure id', (d: unknown) => { at(d, 'session.history.0').failures = ['bendStress'] }, undefined],
  ])('rejects %s all-or-nothing', (_name, mutate, message) => {
    const data = JSON.parse(serializeSessionV2(fatigueModel.ref, looped(), T0))
    mutate(data)
    const r = restore(JSON.stringify(data))
    expect(r.ok).toBe(false)
    if (!r.ok && message) expect(r.error).toBe(message)
  })

  it('never reads a v1 beam save or a bracket save as fatigue, nor a fatigue save as a beam session', () => {
    const beamRaw = readFileSync(new URL('../../test/fixtures/sessions/cantilever-beam-1.v1.json', import.meta.url), 'utf8')
    expect(restore(beamRaw).ok).toBe(false)
    const bracket = initSessionWith(bracketModel, bracketChallenge(), T0, 'b')
    if (!bracket.ok) throw new Error(bracket.error.message)
    expect(restore(serializeSessionV2(bracketModel.ref, bracket.value, T0)).ok).toBe(false)
    expect(deserializeSession(serializeSessionV2(fatigueModel.ref, looped(), T0), bundledChallenge()).ok).toBe(false)
  })
})

describe('v2 design files (MM-19)', () => {
  const design = looped().history[1]!.designSnapshot

  it('exports with model identity and imports a fresh equal design', () => {
    const text = fatigueModel.exportDesign(design, ch)
    expect(JSON.parse(text)).toMatchObject({ format: 'ei-design', schemaVersion: 2, challengeId: 'fatigue-analysis-1', model: { id: 'steppedShaftFatigue', version: 1 } })
    expect(Object.keys(JSON.parse(text).design)).toEqual(['id', 'neckDiameterM', 'collarDiameterM', 'filletRadiusM', 'surfaceFinish', 'materialId'])
    const r = fatigueModel.importDesign(text, ch)
    if (!r.ok) throw new Error(r.error.join('; '))
    expect(r.value).toEqual(design)
    expect(r.value).not.toBe(design)
  })

  it.each([
    ['another challenge', (d: unknown) => { at(d, '').challengeId = 'mounting-bracket-1' }, 'different challenge'],
    ['another model', (d: unknown) => { at(d, '').model = { id: 'boltedLBracket', version: 1 } }, 'different analysis model'],
    ['locked material', (d: unknown) => { at(d, 'design').materialId = 'steel' }, 'fixed'],
    ['fillet larger than the step', (d: unknown) => { at(d, 'design').filletRadiusM = 0.005 }, 'smaller than the shoulder height'],
    ['unknown finish', (d: unknown) => { at(d, 'design').surfaceFinish = 'polished' }, 'design.surfaceFinish'],
    ['unknown design key', (d: unknown) => { at(d, 'design').lengthM = 0.1 }, 'Unexpected key "design.lengthM"'],
  ])('rejects %s', (_name, mutate, fragment) => {
    const data = JSON.parse(fatigueModel.exportDesign(design, ch))
    mutate(data)
    const r = fatigueModel.importDesign(JSON.stringify(data), ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.join(' ')).toContain(fragment)
  })

  it('lists locked-field reasons first and refuses beam files', () => {
    const r = parseFatigueDesign({ ...design, materialId: 'steel', neckDiameterM: 1 }, ch)
    expect(!r.ok && r.error[0]).toMatch(/^Material is fixed/)
    const beam = bundledChallenge()
    expect(fatigueModel.importDesign(exportBeamDesign(beam.initialDesign, beam), ch).ok).toBe(false)
  })

  it('imports a design as the draft; a failed import leaves the session unchanged', () => {
    const other = { ...design, surfaceFinish: 'ground' as const }
    const s = fatigueReducer(looped(), { type: 'importDesign', json: fatigueModel.exportDesign(other, ch) }, ch)
    expect(s.draft).toEqual(other)
    const same = looped()
    expect(fatigueReducer(same, { type: 'importDesign', json: '{' }, ch)).toBe(same)
  })
})

// Feature: multi-model-architecture, Property 1: engine invariants hold for a non-beam model
describe('engine invariants for fatigue action sequences', () => {
  const arbAction: fc.Arbitrary<FatigueAction> = fc.oneof(
    fc
      .record({
        param: fc.constantFrom('neckDiameterM', 'collarDiameterM', 'filletRadiusM'),
        valueM: fc.oneof(fc.double({ min: 0, max: 0.08, noNaN: true }), fc.constantFrom(0.02, 0.0245, 0.034, 0.045, 0.06, 0.0005, 0.002, 0.005)),
        mode: fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict'),
      })
      .map((edit): FatigueAction => ({ type: 'edit', edit: { type: 'setParam', ...edit } })),
    fc.constantFrom('ground', 'machined', 'asForged').map(finish),
    fc.constantFrom<'increase' | 'decrease' | 'same'>('increase', 'decrease', 'same').map((direction) => ({ type: 'setPrediction' as const, direction, now: T0 })),
    fc.nat(99).map((n) => ({ type: 'runTest' as const, now: T0, id: `t-${n}` })),
  )

  it('keeps history append-only, drafts valid, checkpoints predicted and reduction pure', () => {
    assertProperty(
      fc.property(fc.array(arbAction, { maxLength: 25 }), (actions) => {
        let s = fresh()
        for (const a of actions) {
          const before = s
          const frozen = JSON.stringify(before)
          const next = fatigueReducer(before, a, ch)
          expect(JSON.stringify(before)).toBe(frozen)
          expect(next.history.slice(0, before.history.length)).toEqual(before.history)
          expect(fatigueModel.validateDesign(next.draft, ch)).toEqual([])
          for (const r of next.history) {
            if (ch.predictionPolicy.requiredOnIterations.includes(r.iteration)) expect(r.predictionOutcome).toBeDefined()
            expect(r.accepted).toBe(r.evaluation.status === 'accepted')
            if (r.predictionOutcome !== undefined) expect(r.predictionOutcome.scorable).toBe(true)
          }
          s = next
        }
      }),
    )
  })
})
