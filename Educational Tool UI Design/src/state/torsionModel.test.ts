import fc from 'fast-check'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { torsionChallenge, worksheetFixture } from '../../test/fixtures/torsion'
import { assertProperty } from '../../test/pbt'
import { bundledChallenge } from '../../test/arbitraries'
import { scorePredictionByMetric } from '../evaluation/prediction'
import type { TorsionEdit } from '../geometry/torsion/edit'
import { initSessionWith } from './engine'
import { exportDesign as exportBeamDesign } from './importExport'
import { modelFor } from './models'
import { deserializeSession, deserializeSessionV2, serializeSessionV2 } from './persistence'
import { torsionModel, torsionPersistence, torsionReducer, type TorsionAction, type TorsionSession } from './torsionModel'

// Torsion through the model-generic engine (task 34.2; MM-10, MM-13, MM-15, MM-18, MM-19,
// MM-26). Torsion is the first real non-beam model, so it replaces the test-only model MM-27
// allowed; no catalog entry links it (card gating stays with 47.3).

const ch = torsionChallenge()
const T0 = '2026-10-17T10:00:00.000Z'

function fresh(): TorsionSession {
  const r = initSessionWith(torsionModel, ch, T0, 'base-1')
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}
const run = (s: TorsionSession, actions: TorsionAction[]) => actions.reduce((acc, a) => torsionReducer(acc, a, ch), s)
const edit = (e: TorsionEdit): TorsionAction => ({ type: 'edit', edit: e })
/** The object at a dotted path of parsed JSON ('' = root), for targeted corruption. */
const at = (d: unknown, path: string): Record<string, unknown> =>
  (path === '' ? d : path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], d)) as Record<string, unknown>
const toReference: TorsionAction[] = [
  edit({ type: 'setSection', kind: 'tube' }),
  edit({ type: 'setParam', param: 'outerDiameterM', valueM: 0.05, mode: 'strict' }),
  edit({ type: 'setParam', param: 'innerDiameterM', valueM: 0.044, mode: 'strict' }),
]

/** Baseline → reference with the iteration-1 prediction, then reflection and submission. */
function looped(): TorsionSession {
  return run(fresh(), [
    ...toReference,
    { type: 'setPrediction', direction: 'decrease', now: T0 },
    { type: 'runTest', now: T0, id: 'tor-1' },
    { type: 'setReflection', text: 'The tube moved material outward.' },
    { type: 'submit', testResultId: 'tor-1', now: T0 },
  ])
}

describe('torsion learning loop through the engine', () => {
  it('is registered for dispatch by its explicit identity', () => {
    expect(modelFor(ch.model)).toBe(torsionModel)
  })

  it('stores the worksheet baseline and fails twist only', () => {
    const base = fresh().history[0]!
    expect(base.analysis.twistRad).toBeCloseTo(worksheetFixture('baseline').expected.twistRad, 12)
    expect(base.failures).toEqual(['twist'])
    expect(base.evaluation.status).toBe('notAccepted')
  })

  it('gates the checkpoint, then records an Accepted reference with a scorable twist outcome', () => {
    const gated = run(fresh(), [...toReference, { type: 'runTest', now: T0, id: 'x' }])
    expect(gated.ui.predictionDialogOpen).toBe(true)
    expect(gated.history).toHaveLength(1)
    const s = looped()
    const r = s.history[1]!
    expect(r.accepted).toBe(true)
    expect(r.predictionOutcome).toEqual({ metric: 'twistRad', scorable: true, predicted: 'decrease', actual: 'decrease', ratio: expect.closeTo(0.3237534293881777, 12) as unknown as number, matched: true })
    expect(s.submission).toMatchObject({ testResultId: 'tor-1', status: 'accepted', efficiency: r.evaluation.efficiency })
  })

  it('rejects an invalid edit without changing the draft', () => {
    const s = run(fresh(), [edit({ type: 'setSection', kind: 'tube' })])
    const bad = torsionReducer(s, edit({ type: 'setParam', param: 'innerDiameterM', valueM: 0.0599, mode: 'strict' }), ch)
    expect(bad.draft).toBe(s.draft)
    expect(bad.draftErrors.length).toBeGreaterThan(0)
    expect(bad.draftStatus).toBe(s.draftStatus)
  })

  it('shares restore, delete, compare and reset semantics with the beam', () => {
    let s = looped()
    s = torsionReducer(s, { type: 'restore', testResultId: 'base-1' }, ch)
    expect(s.draft.section.kind).toBe('circle')
    expect(s.draftStatus).toBe('draft')
    s = torsionReducer(s, { type: 'deleteIteration', testResultId: 'tor-1' }, ch)
    expect(s.deletedIterationIds).toEqual(['tor-1'])
    expect(s.submission).toBeUndefined()
    expect(s.history).toHaveLength(2)
    s = torsionReducer(s, { type: 'reset' }, ch)
    expect(s.reflectionAnswer).toBe('')
    expect(s.history).toHaveLength(2)
  })
})

describe('not-scorable predictions (MM-13)', () => {
  const p = { iteration: 1, direction: 'increase' as const, createdAt: T0 }
  it.each([[undefined, 1], [1, undefined], [0, 1], [1, Number.NaN], [1, Infinity]])('prev %s / next %s is not scorable', (prev, next) => {
    expect(scorePredictionByMetric(p, 'm', prev, next)).toEqual({ metric: 'm', scorable: false, predicted: 'increase', reason: 'noFiniteMetric' })
  })
  it('classifies finite ratios with the shared band', () => {
    expect(scorePredictionByMetric(p, 'm', 1, 1.02)).toMatchObject({ scorable: true, actual: 'same', matched: false })
    expect(scorePredictionByMetric(p, 'm', 1, 1.0201)).toMatchObject({ scorable: true, actual: 'increase', matched: true })
  })
})

describe('v2 persistence (MM-18)', () => {
  const restore = (raw: string) => deserializeSessionV2(torsionModel, torsionPersistence, raw, ch)

  it('round-trips a full session including explicit undefined fields', () => {
    const s = torsionReducer(looped(), { type: 'cancelPrediction' }, ch)
    const raw = serializeSessionV2(torsionModel.ref, s, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: { id: 'circularShaftTorsion', version: 1 } })
    const r = restore(raw)
    if (!r.ok) throw new Error(r.error)
    expect(JSON.parse(serializeSessionV2(torsionModel.ref, r.value, T0))).toEqual(JSON.parse(raw))
    expect(Object.prototype.hasOwnProperty.call(r.value, 'pendingPrediction')).toBe(true)
  })

  it.each([
    ['tampered analysis', (d: unknown) => { const a = at(d, 'session.history.1.analysis'); a.twistRad = (a.twistRad as number) * 2 }, 'Saved results differ from recomputed results'],
    ['tampered outcome', (d: unknown) => { at(d, 'session.history.1.predictionOutcome').matched = false }, 'Invalid prediction outcome'],
    ['other model', (d: unknown) => { at(d, 'model').id = 'eulerBernoulliCantileverTipForce' }, 'Saved session belongs to a different model'],
    ['v1 envelope', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'Unsupported saved session version'],
    ['locked length', (d: unknown) => { at(d, 'session.draft').lengthM = 0.9 }, undefined],
    ['beam failure id', (d: unknown) => { at(d, 'session.history.0').failures = ['deflection'] }, undefined],
  ])('rejects %s all-or-nothing', (_name, mutate, message) => {
    const data = JSON.parse(serializeSessionV2(torsionModel.ref, looped(), T0))
    mutate(data)
    const r = restore(JSON.stringify(data))
    expect(r.ok).toBe(false)
    if (!r.ok && message) expect(r.error).toBe(message)
  })

  it('never reads a v1 beam save as torsion, nor a torsion save as a beam session', () => {
    const beamRaw = readFileSync(new URL('../../test/fixtures/sessions/cantilever-beam-1.v1.json', import.meta.url), 'utf8')
    expect(restore(beamRaw).ok).toBe(false)
    expect(deserializeSession(serializeSessionV2(torsionModel.ref, looped(), T0), bundledChallenge()).ok).toBe(false)
  })
})

describe('v2 design files (MM-19)', () => {
  const design = looped().history[1]!.designSnapshot

  it('exports with model identity and imports a fresh equal design', () => {
    const text = torsionModel.exportDesign(design, ch)
    expect(JSON.parse(text)).toMatchObject({ format: 'ei-design', schemaVersion: 2, challengeId: 'torsion-shaft-1', model: { id: 'circularShaftTorsion', version: 1 } })
    const r = torsionModel.importDesign(text, ch)
    if (!r.ok) throw new Error(r.error.join('; '))
    expect(r.value).toEqual(design)
    expect(r.value).not.toBe(design)
  })

  it.each([
    ['another challenge', (d: unknown) => { at(d, '').challengeId = 'cantilever-beam-1' }, 'different challenge'],
    ['another model', (d: unknown) => { at(d, '').model = { id: 'eulerBernoulliCantileverTipForce', version: 1 } }, 'different analysis model'],
    ['v1 version', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'schemaVersion must be 2'],
    ['locked length', (d: unknown) => { at(d, 'design').lengthM = 0.9 }, 'fixed'],
    ['unknown design key', (d: unknown) => { at(d, 'design').torqueNm = 1 }, 'Unexpected key "design.torqueNm"'],
    ['unknown top-level key', (d: unknown) => { at(d, '').extra = 1 }, 'Unexpected key "extra"'],
  ])('rejects %s', (_name, mutate, fragment) => {
    const data = JSON.parse(torsionModel.exportDesign(design, ch))
    mutate(data)
    const r = torsionModel.importDesign(JSON.stringify(data), ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.join(' ')).toContain(fragment)
  })

  it('rejects a beam v1 design file and a forbidden key without reading further', () => {
    const beam = bundledChallenge()
    expect(torsionModel.importDesign(exportBeamDesign(beam.initialDesign, beam), ch).ok).toBe(false)
    const r = torsionModel.importDesign('{"__proto__":{"x":1},"format":"ei-design"}', ch)
    expect(r.ok).toBe(false)
  })

  it('a failed import leaves the session unchanged', () => {
    const s = looped()
    expect(torsionReducer(s, { type: 'importDesign', json: '{' }, ch)).toBe(s)
  })
})

// Feature: multi-model-architecture, Property 1: engine invariants hold for a non-beam model
describe('engine invariants for torsion action sequences', () => {
  const arbEdit: fc.Arbitrary<TorsionAction> = fc.oneof(
    fc.constantFrom<'circle' | 'tube'>('circle', 'tube').map((kind) => edit({ type: 'setSection', kind })),
    fc.record({
      param: fc.constantFrom('diameterM', 'outerDiameterM', 'innerDiameterM'),
      valueM: fc.double({ min: 0, max: 0.08, noNaN: true }),
      mode: fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict'),
    }).map(({ param, valueM, mode }) => edit({ type: 'setParam', param, valueM, mode })),
  )
  const arbAction: fc.Arbitrary<TorsionAction> = fc.oneof(
    arbEdit,
    fc.constantFrom<'increase' | 'decrease' | 'same'>('increase', 'decrease', 'same').map((direction) => ({ type: 'setPrediction' as const, direction, now: T0 })),
    fc.nat(99).map((n) => ({ type: 'runTest' as const, now: T0, id: `t-${n}` })),
    fc.constant({ type: 'reset' as const }),
    fc.constant({ type: 'resetDraft' as const }),
  )

  it('keeps history append-only, drafts valid, checkpoints predicted and reduction pure', () => {
    assertProperty(fc.property(fc.array(arbAction, { maxLength: 25 }), (actions) => {
      let s = fresh()
      for (const a of actions) {
        const before = s
        const frozen = JSON.stringify(before)
        const next = torsionReducer(before, a, ch)
        expect(JSON.stringify(before)).toBe(frozen)
        expect(torsionReducer(before, a, ch)).toEqual(next)
        expect(next.history.slice(0, before.history.length)).toEqual(before.history)
        for (let i = 0; i < before.history.length; i++) expect(next.history[i]).toBe(before.history[i])
        expect(torsionModel.validateDesign(next.draft, ch)).toEqual([])
        for (const r of next.history) {
          if (ch.predictionPolicy.requiredOnIterations.includes(r.iteration)) expect(r.predictionOutcome).toBeDefined()
          expect(r.accepted).toBe(r.evaluation.status === 'accepted')
        }
        s = next
      }
    }))
  })
})
