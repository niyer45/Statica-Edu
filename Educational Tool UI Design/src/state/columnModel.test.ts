import fc from 'fast-check'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../test/arbitraries'
import { column, columnChallenge, solid, tube } from '../../test/fixtures/column'
import { torsionChallenge } from '../../test/fixtures/torsion'
import { assertProperty } from '../../test/pbt'
import { COLUMN_GUIDED_PLAN } from '../evaluation/guided/column'
import { guidedProgress } from '../evaluation/guided/plan'
import { columnModel, columnPersistence, columnReducer, parseColumnDesign, type ColumnAction, type ColumnSession } from './columnModel'
import { initSessionWith } from './engine'
import { exportDesign as exportBeamDesign } from './importExport'
import { modelFor, requireModel } from './models'
import { deserializeSession, deserializeSessionV2, serializeSessionV2 } from './persistence'
import { columnRuntime, runtimeFor } from './runtimes'
import { torsionModel } from './torsionModel'

// Column Buckling I through the model-generic engine (task 68; MM-10, MM-13, MM-15, MM-18, MM-19,
// MM-26, D-49).

const ch = columnChallenge()
const T0 = '2026-10-19T10:00:00.000Z'

function fresh(mode?: 'guided' | 'parametric'): ColumnSession {
  const r = initSessionWith(columnModel, ch, T0, 'base-1', mode)
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}
const run = (s: ColumnSession, actions: ColumnAction[], reduce = columnReducer) => actions.reduce((acc, a) => reduce(acc, a, ch), s)
const set = (param: string, valueM: number, mode: 'clamp' | 'strict' = 'strict'): ColumnAction => ({ type: 'edit', edit: { type: 'setParam', param, valueM, mode } })
const kind = (k: 'solid' | 'tube'): ColumnAction => ({ type: 'edit', edit: { type: 'setSection', kind: k } })
const at = (d: unknown, path: string): Record<string, unknown> =>
  (path === '' ? d : path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], d)) as Record<string, unknown>

/** Baseline → reference tube (predicted), → stocky tube (not applicable), → solid 30 (predicted), submit the reference. */
function looped(): ColumnSession {
  return run(fresh(), [
    kind('tube'),
    set('outerDiameterM', 0.06),
    set('wallThicknessM', 0.002),
    { type: 'setPrediction', direction: 'increase', now: T0 },
    { type: 'runTest', now: T0, id: 'c-1' },
    set('outerDiameterM', 0.08),
    { type: 'runTest', now: T0, id: 'c-2' },
    kind('solid'),
    set('diameterM', 0.03),
    { type: 'setPrediction', direction: 'decrease', now: T0 },
    { type: 'runTest', now: T0, id: 'c-3' },
    { type: 'setReflection', text: 'The solid bar buckled at low stress; the wide thin tube put its material far from the center.' },
    { type: 'submit', testResultId: 'c-1', now: T0 },
  ])
}

describe('column learning loop through the engine', () => {
  it('dispatches only to the column definition by explicit identity', () => {
    expect(columnModel.ref).toEqual(ch.model)
    expect(columnModel.ref).toEqual({ id: 'eulerColumnBuckling', version: 1 })
    expect(columnModel.envelopeVersion).toBe(2)
    expect(modelFor(ch.model)).toBe(columnModel)
    expect(requireModel(ch)).toBe(columnModel)
    expect(modelFor({ id: 'eulerColumnBuckling', version: 2 })).toBeUndefined()
    expect(runtimeFor(ch.model)).toBe(columnRuntime)
    expect(columnRuntime.key(ch)).toBe('ei:session:column-buckling-1:v1')
  })

  it('records the loop: an Accepted reference, a not-applicable stocky tube and scored predictions', () => {
    const s = looped()
    expect(s.history.map((r) => r.evaluation.status)).toEqual(['notAccepted', 'accepted', 'modelNotApplicable', 'notAccepted'])
    expect(s.history[1]!.predictionOutcome).toMatchObject({ predicted: 'increase', actual: 'increase', matched: true, scorable: true })
    expect(s.history[3]!.predictionOutcome).toMatchObject({ predicted: 'decrease', actual: 'decrease', matched: true })
    expect(s.submission?.testResultId).toBe('c-1')
  })

  it('a rejected edit keeps the draft and reports the errors', () => {
    const s = run(fresh(), [set('diameterM', 0.2)])
    expect(s.draft).toEqual(fresh().draft)
    expect(s.draftErrors.map((e) => e.code)).toEqual(['ABOVE_MAX'])
  })
})

describe('Guided locks (D-49)', () => {
  const reduce = columnRuntime.reduce
  it('step 1 unlocks only the solid diameter; a locked edit is refused with a notice', () => {
    const s = run(fresh('guided'), [kind('tube')], reduce)
    expect(s.draft.section.kind).toBe('solid')
    expect(s.ui.notice?.message).toBe('Section type is locked in this Guided step. Editable now: Diameter.')
    const grown = run(fresh('guided'), [set('diameterM', 0.03), { type: 'setPrediction', direction: 'increase', now: T0 }, { type: 'runTest', now: T0, id: 'g1' }], reduce)
    expect(guidedProgress(COLUMN_GUIDED_PLAN, grown.history).current).toBe(1)
  })

  it('walks all five steps to an Accepted tube', () => {
    const s = run(
      fresh('guided'),
      [
        set('diameterM', 0.03),
        { type: 'setPrediction', direction: 'increase', now: T0 },
        { type: 'runTest', now: T0, id: 'g1' },
        kind('tube'),
        { type: 'runTest', now: T0, id: 'g2' },
        set('wallThicknessM', 0.002),
        { type: 'setPrediction', direction: 'decrease', now: T0 },
        { type: 'runTest', now: T0, id: 'g3' },
        set('outerDiameterM', 0.055),
        { type: 'runTest', now: T0, id: 'g4' },
        set('outerDiameterM', 0.06),
        { type: 'runTest', now: T0, id: 'g5' },
      ],
      reduce,
    )
    expect(s.history).toHaveLength(6)
    expect(s.history[4]!.evaluation.failures).toEqual(['buckling'])
    expect(s.history[5]!.evaluation.status).toBe('accepted')
    expect(guidedProgress(COLUMN_GUIDED_PLAN, s.history)).toMatchObject({ current: 5, complete: true })
  })

  it('Parametric is never locked', () => {
    const s = run(fresh('parametric'), [kind('tube'), set('outerDiameterM', 0.06)], reduce)
    expect(s.draft.section).toEqual(tube(0.06, 0.003))
  })
})

describe('v2 persistence (MM-18)', () => {
  const restore = (raw: string) => deserializeSessionV2(columnModel, columnPersistence, raw, ch)

  it('round-trips a full session with a not-applicable result', () => {
    const s = columnReducer(looped(), { type: 'cancelPrediction' }, ch)
    const raw = serializeSessionV2(columnModel.ref, s, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: { id: 'eulerColumnBuckling', version: 1 }, session: { challengeVersion: 1 } })
    const r = restore(raw)
    if (!r.ok) throw new Error(r.error)
    expect(JSON.parse(serializeSessionV2(columnModel.ref, r.value, T0))).toEqual(JSON.parse(raw))
    expect(r.value.history[2]!.evaluation.status).toBe('modelNotApplicable')
  })

  it.each([
    ['tampered analysis', (d: unknown) => { const a = at(d, 'session.history.1.analysis'); a.criticalLoadN = (a.criticalLoadN as number) * 2 }, 'Saved results differ from recomputed results'],
    ['a dropped constraint sense', (d: unknown) => { delete at(d, 'session.history.1.evaluation.constraints.0').sense }, 'Saved results differ from recomputed results'],
    ['other model', (d: unknown) => { at(d, 'model').id = 'circularShaftTorsion' }, 'Saved session belongs to a different model'],
    ['v1 envelope', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'Unsupported saved session version'],
    ['locked length', (d: unknown) => { at(d, 'session.draft').lengthM = 3 }, undefined],
    ['out-of-range snapshot', (d: unknown) => { at(d, 'session.history.1.designSnapshot.section').outerDiameterM = 0.2 }, undefined],
    ['torsion failure id', (d: unknown) => { at(d, 'session.history.0').failures = ['twist'] }, undefined],
  ])('rejects %s all-or-nothing', (_name, mutate, message) => {
    const data = JSON.parse(serializeSessionV2(columnModel.ref, looped(), T0))
    mutate(data)
    const r = restore(JSON.stringify(data))
    expect(r.ok).toBe(false)
    if (!r.ok && message) expect(r.error).toBe(message)
  })

  it('never reads a v1 beam save or a torsion save as a column, nor a column save as a beam session', () => {
    const beamRaw = readFileSync(new URL('../../test/fixtures/sessions/cantilever-beam-1.v1.json', import.meta.url), 'utf8')
    expect(restore(beamRaw).ok).toBe(false)
    const torsion = initSessionWith(torsionModel, torsionChallenge(), T0, 't')
    if (!torsion.ok) throw new Error(torsion.error.message)
    expect(restore(serializeSessionV2(torsionModel.ref, torsion.value, T0)).ok).toBe(false)
    expect(deserializeSession(serializeSessionV2(columnModel.ref, looped(), T0), bundledChallenge()).ok).toBe(false)
  })
})

describe('v2 design files (MM-19)', () => {
  const design = column('reference', tube(0.06, 0.002))

  it('exports with model identity and imports a fresh equal design', () => {
    const text = columnModel.exportDesign(design, ch)
    expect(JSON.parse(text)).toMatchObject({ format: 'ei-design', schemaVersion: 2, challengeId: 'column-buckling-1', model: { id: 'eulerColumnBuckling', version: 1 } })
    const r = columnModel.importDesign(text, ch)
    if (!r.ok) throw new Error(r.error.join('; '))
    expect(r.value).toEqual(design)
    expect(r.value).not.toBe(design)
  })

  it.each([
    ['another challenge', (d: unknown) => { at(d, '').challengeId = 'torsion-shaft-1' }, 'different challenge'],
    ['another model', (d: unknown) => { at(d, '').model = { id: 'circularShaftTorsion', version: 1 } }, 'different analysis model'],
    ['locked material', (d: unknown) => { at(d, 'design').materialId = 'steel' }, 'fixed'],
    ['out-of-range wall', (d: unknown) => { at(d, 'design.section').wallThicknessM = 0.01 }, 'Wall thickness must be at most 6 mm'],
    ['an inner diameter instead of a wall', (d: unknown) => { at(d, 'design.section').innerDiameterM = 0.056 }, 'Unexpected key "design.section.innerDiameterM"'],
  ])('rejects %s', (_name, mutate, fragment) => {
    const data = JSON.parse(columnModel.exportDesign(design, ch))
    mutate(data)
    const r = columnModel.importDesign(JSON.stringify(data), ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.join(' ')).toContain(fragment)
  })

  it('lists locked-field reasons first and refuses beam files', () => {
    const r = parseColumnDesign({ ...design, materialId: 'steel', section: solid(1) }, ch)
    expect(!r.ok && r.error[0]).toMatch(/^Material is fixed/)
    const beam = bundledChallenge()
    expect(columnModel.importDesign(exportBeamDesign(beam.initialDesign, beam), ch).ok).toBe(false)
  })
})

// Feature: multi-model-architecture, Property 1: engine invariants hold for a non-beam model
describe('engine invariants for column action sequences', () => {
  const arbAction: fc.Arbitrary<ColumnAction> = fc.oneof(
    fc.constantFrom<'solid' | 'tube'>('solid', 'tube').map(kind),
    fc
      .tuple(fc.constantFrom('diameterM', 'outerDiameterM', 'wallThicknessM'), fc.double({ min: 0, max: 0.1, noNaN: true }), fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict'))
      .map(([p, v, m]) => set(p, v, m)),
    fc.constantFrom<'increase' | 'decrease' | 'same'>('increase', 'decrease', 'same').map((direction) => ({ type: 'setPrediction' as const, direction, now: T0 })),
    fc.nat(99).map((n) => ({ type: 'runTest' as const, now: T0, id: `t-${n}` })),
  )

  it('keeps history append-only, drafts valid, checkpoints predicted and outcomes scorable', () => {
    assertProperty(
      fc.property(fc.array(arbAction, { maxLength: 25 }), (actions) => {
        let s = fresh()
        for (const a of actions) {
          const before = s
          const frozen = JSON.stringify(before)
          const next = columnReducer(before, a, ch)
          expect(JSON.stringify(before)).toBe(frozen)
          expect(next.history.slice(0, before.history.length)).toEqual(before.history)
          expect(columnModel.validateDesign(next.draft, ch)).toEqual([])
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
