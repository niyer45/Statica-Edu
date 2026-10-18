import fc from 'fast-check'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bracedFrameChallenge, PREDICTION_FIXTURES, worksheetFixture } from '../../test/fixtures/bracedFrame'
import { torsionChallenge } from '../../test/fixtures/torsion'
import { bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { BracedFrameEdit } from '../geometry/bracedFrame/edit'
import { FRAME_MEMBER_IDS } from '../geometry/bracedFrame/template'
import { initSessionWith } from './engine'
import { exportDesign as exportBeamDesign } from './importExport'
import { modelFor, requireModel } from './models'
import { deserializeSession, deserializeSessionV2, serializeSessionV2 } from './persistence'
import { bracedFrameRuntime, runtimeFor, runtimeForJson } from './runtimes'
import { torsionModel } from './torsionModel'
import {
  bracedFrameModel,
  bracedFramePersistence,
  bracedFrameReducer,
  parseBracedFrameDesign,
  type BracedFrameAction,
  type BracedFrameSession,
} from './bracedFrameModel'

// Braced Frame I through the model-generic engine (task 49.2; MM-10, MM-11, MM-13, MM-15, MM-18,
// MM-19, MM-26). Registered for dispatch since 49.3; no catalog entry links the challenge until
// owner-approved activation.

const ch = bracedFrameChallenge()
const T0 = '2026-10-17T10:00:00.000Z'

function fresh(): BracedFrameSession {
  const r = initSessionWith(bracedFrameModel, ch, T0, 'base-1')
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}
const run = (s: BracedFrameSession, actions: BracedFrameAction[]) => actions.reduce((acc, a) => bracedFrameReducer(acc, a, ch), s)
const edit = (e: BracedFrameEdit): BracedFrameAction => ({ type: 'edit', edit: e })
const toggle = (memberId: string) => edit({ type: 'toggleDiagonal', memberId })
const size = (memberId: string, sectionId: string) => edit({ type: 'setMemberSection', memberId, sectionId })
/** The object at a dotted path of parsed JSON ('' = root), for targeted corruption. */
const at = (d: unknown, path: string): Record<string, unknown> =>
  (path === '' ? d : path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], d)) as Record<string, unknown>

/** Baseline (diag1b + diag2b, all 60) → the reference design, by toggles and resizes. */
const toReference: BracedFrameAction[] = [
  toggle('diag1b'),
  toggle('diag2b'),
  toggle('diag1a'),
  toggle('diag2a'),
  size('col1L', 'CHS48.3x3.2'),
  size('col1R', 'CHS88.9x5.0'),
  size('col2R', 'CHS76.1x4.0'),
  size('beam1', 'CHS76.1x4.0'),
  size('beam2', 'CHS76.1x4.0'),
  size('diag1a', 'CHS76.1x4.0'),
  size('diag2a', 'CHS48.3x3.2'),
]

/**
 * Iteration 1: reference with a scorable prediction. Iteration 2: the upper diagonal removed, a
 * mechanism. Iteration 3 (checkpoint): diagonal restored; the prediction compares against the
 * mechanism, so it is not scorable. Then reflection and submission of iteration 1.
 */
function looped(): BracedFrameSession {
  return run(fresh(), [
    ...toReference,
    { type: 'setPrediction', direction: 'increase', now: T0 },
    { type: 'runTest', now: T0, id: 'bf-1' },
    toggle('diag2a'),
    { type: 'runTest', now: T0, id: 'bf-2' },
    toggle('diag2a'),
    { type: 'setPrediction', direction: 'decrease', now: T0 },
    { type: 'runTest', now: T0, id: 'bf-3' },
    { type: 'setReflection', text: 'The tension diagonals took the sideways load down to the supports.' },
    { type: 'submit', testResultId: 'bf-1', now: T0 },
  ])
}

describe('braced-frame learning loop through the engine', () => {
  it('is registered for dispatch under its exact identity only (49.3, MM-05, MM-07)', () => {
    expect(modelFor(ch.model)).toBe(bracedFrameModel)
    expect(requireModel(ch)).toBe(bracedFrameModel)
    expect(modelFor({ id: 'pinJointedBracedFrame', version: 2 })).toBeUndefined()
    expect(runtimeFor(ch.model)).toBe(bracedFrameRuntime)
    expect(runtimeForJson(JSON.parse(JSON.stringify(ch)))).toBe(bracedFrameRuntime)
    expect(bracedFrameModel.ref).toEqual({ id: 'pinJointedBracedFrame', version: 1 })
    expect(bracedFrameModel.envelopeVersion).toBe(2)
    expect(bracedFrameModel.primaryMetric.label).toBe('roof drift')
  })

  it('stores the worksheet baseline, stable but failing utilization only', () => {
    const base = fresh().history[0]!
    expect(base.analysis.status).toBe('solved')
    expect(base.failures).toEqual(['utilization'])
    expect(base.evaluation.status).toBe('notAccepted')
    expect(base.analysis.massKg).toBeCloseTo(worksheetFixture('baseline').expected.massKg, 9)
  })

  it('gates the checkpoint, then records an Accepted reference with a scorable roof-drift outcome', () => {
    const gated = run(fresh(), [...toReference, { type: 'runTest', now: T0, id: 'x' }])
    expect(gated.ui.predictionDialogOpen).toBe(true)
    expect(gated.history).toHaveLength(1)
    const r = looped().history[1]!
    expect(r.accepted).toBe(true)
    expect(r.predictionOutcome).toEqual({
      metric: 'roofDriftM',
      scorable: true,
      predicted: 'increase',
      actual: 'increase',
      ratio: expect.closeTo(PREDICTION_FIXTURES[0].ratio, 12) as unknown as number,
      matched: true,
    })
  })

  it('stores a mechanism test result without displacements, forces, drift or utilization', () => {
    const r = looped().history[2]!
    expect(r.analysis.status).toBe('mechanism')
    expect(r.evaluation.status).toBe('modelNotApplicable')
    expect(r.accepted).toBe(false)
    expect(r.failures).toEqual(['stability', 'applicability'])
    for (const key of ['displacementsM', 'members', 'reactionsN', 'roofDriftM', 'floorDriftM', 'storeyDriftRatios', 'maxUtilization', 'governingMemberId']) {
      expect(Object.prototype.hasOwnProperty.call(r.analysis, key), key).toBe(false)
    }
    expect(JSON.stringify(r)).not.toMatch(/NaN|null|Infinity/)
    expect(r.prediction).toBeUndefined()
  })

  it('records a not-scorable outcome when the previous result is a mechanism (MM-13)', () => {
    const r = looped().history[3]!
    expect(r.analysis.status).toBe('solved')
    expect(r.predictionOutcome).toEqual({ metric: 'roofDriftM', scorable: false, predicted: 'decrease', reason: 'noFiniteMetric' })
  })

  it('records a not-scorable outcome when the new result is a mechanism (MM-13)', () => {
    const s = run(looped(), [toggle('diag1a'), { type: 'runTest', now: T0, id: 'bf-4' }])
    expect(s.history).toHaveLength(5)
    const p = { iteration: 5, direction: 'same' as const, createdAt: T0 }
    expect(bracedFrameModel.scorePrediction(p, s.history[3]!, s.history[4]!.analysis)).toEqual({ metric: 'roofDriftM', scorable: false, predicted: 'same', reason: 'noFiniteMetric' })
  })

  it('submits with the stored efficiency', () => {
    const s = looped()
    expect(s.submission).toMatchObject({ testResultId: 'bf-1', status: 'accepted', efficiency: s.history[1]!.evaluation.efficiency })
  })

  it('rejects an invalid edit without changing the draft', () => {
    const s = fresh()
    for (const bad of [toggle('col1L'), toggle('diag3a'), size('beam1', 'CHS114.3x6.3')]) {
      const next = bracedFrameReducer(s, bad, ch)
      expect(next.draft).toBe(s.draft)
      expect(next.draftErrors.length).toBeGreaterThan(0)
      expect(next.draftStatus).toBe(s.draftStatus)
    }
  })

  it('shares restore, delete, compare and reset semantics with the other models', () => {
    let s = looped()
    s = bracedFrameReducer(s, { type: 'restore', testResultId: 'bf-2' }, ch)
    expect(s.draft.members.diag2a.present).toBe(false)
    expect(s.draftStatus).toBe('draft')
    s = bracedFrameReducer(s, { type: 'deleteIteration', testResultId: 'bf-1' }, ch)
    expect(s.deletedIterationIds).toEqual(['bf-1'])
    expect(s.submission).toBeUndefined()
    s = bracedFrameReducer(s, { type: 'reset' }, ch)
    expect(s.reflectionAnswer).toBe('')
    expect(s.history).toHaveLength(4)
    expect(s.draft.members.diag1b.present).toBe(true)
  })

  it('draft status ignores the design id and compares every member choice', () => {
    const s = run(fresh(), [toggle('diag1a')])
    expect(s.draftStatus).toBe('draft')
    expect(run(s, [toggle('diag1a')]).draftStatus).toBe('tested')
    expect(bracedFrameModel.sameDesignIgnoringId(ch.initialDesign, { ...ch.initialDesign, id: 'other' })).toBe(true)
    expect(bracedFrameModel.sameDesignIgnoringId(ch.initialDesign, { ...ch.initialDesign, materialId: 'x' })).toBe(false)
  })
})

describe('v2 persistence (MM-18)', () => {
  const restore = (raw: string) => deserializeSessionV2(bracedFrameModel, bracedFramePersistence, raw, ch)

  it('round-trips a session with a mechanism result and a not-scorable outcome', () => {
    const s = bracedFrameReducer(looped(), { type: 'cancelPrediction' }, ch)
    const raw = serializeSessionV2(bracedFrameModel.ref, s, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: { id: 'pinJointedBracedFrame', version: 1 } })
    const r = restore(raw)
    if (!r.ok) throw new Error(r.error)
    expect(JSON.parse(serializeSessionV2(bracedFrameModel.ref, r.value, T0))).toEqual(JSON.parse(raw))
    expect(r.value.history[2]!.analysis.status).toBe('mechanism')
    expect(r.value.history[3]!.predictionOutcome).toMatchObject({ scorable: false })
    expect(Object.prototype.hasOwnProperty.call(r.value, 'pendingPrediction')).toBe(true)
  })

  it.each([
    ['tampered force', (d: unknown) => { const m = at(d, 'session.history.1.analysis.members.beam1'); m.forceN = (m.forceN as number) * 2 }, 'Saved results differ from recomputed results'],
    ['a drift value added to a mechanism', (d: unknown) => { at(d, 'session.history.2.analysis').roofDriftM = 0.01 }, 'Saved results differ from recomputed results'],
    ['a mechanism relabelled as solved', (d: unknown) => { at(d, 'session.history.2.analysis').status = 'solved' }, 'Saved results differ from recomputed results'],
    ['an invented scorable outcome', (d: unknown) => { Object.assign(at(d, 'session.history.3.predictionOutcome'), { scorable: true, actual: 'decrease', ratio: 0.5, matched: true }) }, 'Invalid prediction outcome'],
    ['other model', (d: unknown) => { at(d, 'model').id = 'circularShaftTorsion' }, 'Saved session belongs to a different model'],
    ['v1 envelope', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'Unsupported saved session version'],
    ['locked material', (d: unknown) => { at(d, 'session.draft').materialId = 'aluminium' }, undefined],
    ['present key on a fixed member', (d: unknown) => { at(d, 'session.draft.members.col1L').present = false }, undefined],
    ['torsion failure id', (d: unknown) => { at(d, 'session.history.0').failures = ['twist'] }, undefined],
    ['unknown draft error code', (d: unknown) => { at(d, 'session').draftErrors = [{ code: 'WALL_TOO_THIN', message: 'x' }] }, undefined],
  ])('rejects %s all-or-nothing', (_name, mutate, message) => {
    const data = JSON.parse(serializeSessionV2(bracedFrameModel.ref, looped(), T0))
    mutate(data)
    const r = restore(JSON.stringify(data))
    expect(r.ok).toBe(false)
    if (!r.ok && message) expect(r.error).toBe(message)
  })

  it('accepts draft errors with frame codes', () => {
    const s = bracedFrameReducer(fresh(), toggle('col1L'), ch)
    expect(s.draftErrors.map((e) => e.code)).toEqual(['PRESENT_ON_FIXED_MEMBER'])
    expect(restore(serializeSessionV2(bracedFrameModel.ref, s, T0)).ok).toBe(true)
  })

  it('never reads beam or torsion saves as frame sessions, nor a frame save as a beam session', () => {
    const beamRaw = readFileSync(new URL('../../test/fixtures/sessions/cantilever-beam-1.v1.json', import.meta.url), 'utf8')
    expect(restore(beamRaw).ok).toBe(false)
    const tch = torsionChallenge()
    const t = initSessionWith(torsionModel, tch, T0, 'tor-0')
    if (!t.ok) throw new Error('torsion init failed')
    expect(restore(serializeSessionV2(torsionModel.ref, t.value, T0)).ok).toBe(false)
    expect(deserializeSession(serializeSessionV2(bracedFrameModel.ref, looped(), T0), bundledChallenge()).ok).toBe(false)
  })
})

describe('v2 design files (MM-19)', () => {
  const design = looped().history[1]!.designSnapshot

  it('exports with model identity and imports a fresh equal design', () => {
    const text = bracedFrameModel.exportDesign(design, ch)
    expect(JSON.parse(text)).toMatchObject({ format: 'ei-design', schemaVersion: 2, challengeId: 'braced-frame-1', model: { id: 'pinJointedBracedFrame', version: 1 } })
    expect(Object.keys(JSON.parse(text).design.members)).toEqual([...FRAME_MEMBER_IDS])
    const r = bracedFrameModel.importDesign(text, ch)
    if (!r.ok) throw new Error(r.error.join('; '))
    expect(r.value).toEqual(design)
    expect(r.value).not.toBe(design)
  })

  it('imports a mechanism design: every diagonal combination is valid', () => {
    const mech = looped().history[2]!.designSnapshot
    const r = bracedFrameModel.importDesign(bracedFrameModel.exportDesign(mech, ch), ch)
    expect(r.ok && r.value.members.diag2a.present).toBe(false)
  })

  it.each([
    ['another challenge', (d: unknown) => { at(d, '').challengeId = 'torsion-shaft-1' }, 'different challenge'],
    ['another model', (d: unknown) => { at(d, '').model = { id: 'circularShaftTorsion', version: 1 } }, 'different analysis model'],
    ['another model version', (d: unknown) => { at(d, '').model = { id: 'pinJointedBracedFrame', version: 2 } }, 'different analysis model'],
    ['v1 version', (d: unknown) => { at(d, '').schemaVersion = 1 }, 'schemaVersion must be 2'],
    ['locked material', (d: unknown) => { at(d, 'design').materialId = 'aluminium' }, 'fixed'],
    ['a section outside the catalog', (d: unknown) => { at(d, 'design.members.beam1').sectionId = 'CHS114.3x6.3' }, "not in this challenge's catalog"],
    ['a present key on a fixed member', (d: unknown) => { at(d, 'design.members.col2R').present = true }, 'Unexpected key "design.members.col2R.present"'],
    ['an unknown member', (d: unknown) => { at(d, 'design.members').diag3a = { present: true, sectionId: 'CHS60.3x4.0' } }, 'Unexpected key "design.members.diag3a"'],
    ['a missing member', (d: unknown) => { delete at(d, 'design.members').beam2 }, 'design.members.beam2'],
    ['a non-boolean present', (d: unknown) => { at(d, 'design.members.diag1a').present = 1 }, 'design.members.diag1a.present'],
    ['unknown top-level key', (d: unknown) => { at(d, '').loads = [] }, 'Unexpected key "loads"'],
  ])('rejects %s', (_name, mutate, fragment) => {
    const data = JSON.parse(bracedFrameModel.exportDesign(design, ch))
    mutate(data)
    const r = bracedFrameModel.importDesign(JSON.stringify(data), ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.join(' ')).toContain(fragment)
  })

  it('orders locked-field reasons first', () => {
    const d = JSON.parse(bracedFrameModel.exportDesign(design, ch)).design
    d.materialId = 'x'
    d.members.beam1.sectionId = 'y'
    const r = parseBracedFrameDesign(d, ch)
    expect(!r.ok && r.error[0]).toContain('Material is fixed')
  })

  it('rejects beam and torsion design files and a forbidden key without reading further', () => {
    const beam = bundledChallenge()
    expect(bracedFrameModel.importDesign(exportBeamDesign(beam.initialDesign, beam), ch).ok).toBe(false)
    const tch = torsionChallenge()
    expect(bracedFrameModel.importDesign(torsionModel.exportDesign(tch.initialDesign, tch), ch).ok).toBe(false)
    expect(bracedFrameModel.importDesign('{"__proto__":{"x":1},"format":"ei-design"}', ch).ok).toBe(false)
  })

  it('a failed import leaves the session unchanged; a valid one replaces the draft', () => {
    const s = looped()
    expect(bracedFrameReducer(s, { type: 'importDesign', json: '{' }, ch)).toBe(s)
    const imported = bracedFrameReducer(s, { type: 'importDesign', json: bracedFrameModel.exportDesign(worksheetFixture('mixedLight').design, ch) }, ch)
    expect(imported.draft.members.diag2b).toEqual({ present: true, sectionId: 'CHS88.9x5.0' })
  })
})

// Feature: multi-model-architecture, Property 1: engine invariants hold for a non-beam model
describe('engine invariants for braced-frame action sequences', () => {
  const arbEdit: fc.Arbitrary<BracedFrameAction> = fc.oneof(
    fc.constantFrom(...FRAME_MEMBER_IDS, 'diag3a').map((memberId) => toggle(memberId)),
    fc.tuple(fc.constantFrom(...FRAME_MEMBER_IDS), fc.constantFrom(...ch.sections.map((x) => x.id), 'CHS114.3x6.3')).map(([m, sec]) => size(m, sec)),
  )
  const arbAction: fc.Arbitrary<BracedFrameAction> = fc.oneof(
    arbEdit,
    fc.constantFrom<'increase' | 'decrease' | 'same'>('increase', 'decrease', 'same').map((direction) => ({ type: 'setPrediction' as const, direction, now: T0 })),
    fc.nat(99).map((n) => ({ type: 'runTest' as const, now: T0, id: `t-${n}` })),
    fc.constant({ type: 'reset' as const }),
  )

  it('keeps history append-only, drafts valid, checkpoints predicted, mechanisms unscorable and reduction pure', () => {
    assertProperty(
      fc.property(fc.array(arbAction, { maxLength: 25 }), (actions) => {
        let s = fresh()
        for (const a of actions) {
          const before = s
          const frozen = JSON.stringify(before)
          const next = bracedFrameReducer(before, a, ch)
          expect(JSON.stringify(before)).toBe(frozen)
          expect(bracedFrameReducer(before, a, ch)).toEqual(next)
          expect(next.history.slice(0, before.history.length)).toEqual(before.history)
          for (let i = 0; i < before.history.length; i++) expect(next.history[i]).toBe(before.history[i])
          expect(bracedFrameModel.validateDesign(next.draft, ch)).toEqual([])
          next.history.forEach((r, i) => {
            if (ch.predictionPolicy.requiredOnIterations.includes(r.iteration)) expect(r.predictionOutcome).toBeDefined()
            expect(r.accepted).toBe(r.evaluation.status === 'accepted')
            if (r.analysis.status === 'mechanism') expect(r.accepted).toBe(false)
            const touchesMechanism = r.analysis.status === 'mechanism' || (i > 0 && next.history[i - 1]!.analysis.status === 'mechanism')
            if (r.predictionOutcome !== undefined && touchesMechanism) expect(r.predictionOutcome.scorable).toBe(false)
          })
          s = next
        }
      }),
    )
  })
})
