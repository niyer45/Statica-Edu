import { describe, expect, it } from 'vitest'
import { AXIAL_DERIVED, axialChallenge, worksheetFixture } from '../../test/fixtures/axial'
import { torsionChallenge } from '../../test/fixtures/torsion'
import { AXIAL_GUIDED_PLAN } from '../evaluation/guided/axial'
import { guidedProgress, observations, type GuidedPlan } from '../evaluation/guided/plan'
import type { AxialDesign } from '../geometry/axial/design'
import type { AxialEdit } from '../geometry/axial/edit'
import { axialModel, axialPersistence, axialReducer, type AxialAction, type AxialSession } from './axialModel'
import { initSessionWith } from './engine'
import { modelFor, requireModel, UnregisteredModelError } from './models'
import { deserializeSessionV2, serializeSessionV2 } from './persistence'
import { axialRuntime, runtimeFor, runtimeForJson, torsionRuntime } from './runtimes'
import { torsionModel } from './torsionModel'

// Stress and Strain I through the model-generic engine (task 72; MM-10, MM-13, MM-15, MM-18,
// MM-19, MM-26).

const ch = axialChallenge()
const T0 = '2026-10-19T10:00:00.000Z'

function fresh(mode: 'guided' | 'parametric' = 'parametric'): AxialSession {
  const r = initSessionWith(axialModel, ch, T0, 'base-1', mode)
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}
const run = (s: AxialSession, actions: AxialAction[]) => actions.reduce((acc, a) => axialReducer(acc, a, ch), s)
const edit = (e: AxialEdit): AxialAction => ({ type: 'edit', edit: e })
const toReference: AxialAction[] = [edit({ type: 'setDiameter', valueM: 0.02, mode: 'strict' }), edit({ type: 'setMaterial', materialId: 'aluminium' })]

function looped(): AxialSession {
  return run(fresh(), [
    ...toReference,
    { type: 'setPrediction', direction: 'increase', now: T0 },
    { type: 'runTest', now: T0, id: 'rod-1' },
    { type: 'setReflection', text: 'Aluminium sized for stretch is light enough; steel sized for stress is not.' },
    { type: 'submit', testResultId: 'rod-1', now: T0 },
  ])
}

describe('Stress and Strain I learning loop through the engine', () => {
  it('is registered for dispatch by its exact identity; another version is never substituted', () => {
    expect(modelFor(ch.model)).toBe(axialModel)
    expect(requireModel(ch)).toBe(axialModel)
    expect(modelFor({ id: 'axialTieRod', version: 2 })).toBeUndefined()
    expect(() => requireModel({ model: { id: 'axialTieRod', version: 2 } })).toThrow(UnregisteredModelError)
    expect(axialModel.envelopeVersion).toBe(2)
    expect(runtimeFor(axialModel.ref)).toBe(axialRuntime)
    expect(runtimeFor({ id: 'axialTieRod', version: 2 })).toBeUndefined()
    expect(runtimeForJson({ model: { id: 'axialTieRod', version: 1 } })).toBe(axialRuntime)
  })

  it('stores the worksheet baseline failing stress and mass', () => {
    const base = fresh().history[0]!
    expect(base.analysis.stressPa).toBeCloseTo(worksheetFixture('baseline').expected.stressPa, 6)
    expect(base.failures).toEqual(['stress', 'mass'])
    expect(base.evaluation.status).toBe('notAccepted')
  })

  it('gates the checkpoint, then records an Accepted reference with a scorable elongation outcome', () => {
    const gated = run(fresh(), [...toReference, { type: 'runTest', now: T0, id: 'x' }])
    expect(gated.ui.predictionDialogOpen).toBe(true)
    expect(gated.history).toHaveLength(1)
    const s = looped()
    const r = s.history[1]!
    expect(r.accepted).toBe(true)
    expect(r.predictionOutcome).toEqual({
      metric: 'elongationM',
      scorable: true,
      predicted: 'increase',
      actual: 'increase',
      ratio: expect.closeTo(AXIAL_DERIVED.baselineToReferenceElongationRatio, 12) as unknown as number,
      matched: true,
    })
    expect(s.submission).toMatchObject({ testResultId: 'rod-1', status: 'accepted', efficiency: r.evaluation.efficiency })
  })

  it('rejects an invalid edit without changing the draft', () => {
    const s = fresh()
    for (const e of [edit({ type: 'setDiameter', valueM: 0.031, mode: 'strict' }), edit({ type: 'setMaterial', materialId: 'cork' })]) {
      const bad = axialReducer(s, e, ch)
      expect(bad.draft).toBe(s.draft)
      expect(bad.draftErrors.length).toBeGreaterThan(0)
    }
  })

  it('locks the material in the first Guided step and allows it in Parametric', () => {
    const material = edit({ type: 'setMaterial', materialId: 'titanium' })
    const guided = axialRuntime.reduce(fresh('guided'), material, ch)
    expect(guided.draft.materialId).toBe('steel')
    expect(guided.ui.notice?.message).toBe('Material is locked in this Guided step. Editable now: Diameter.')
    expect(axialRuntime.reduce(fresh('parametric'), material, ch).draft.materialId).toBe('titanium')
  })

  it('reports the guided observations from stored values only', () => {
    const s = run(fresh('guided'), [edit({ type: 'setDiameter', valueM: 0.0145, mode: 'strict' }), { type: 'setPrediction', direction: 'decrease', now: T0 }, { type: 'runTest', now: T0, id: 'g1' }])
    const progress = guidedProgress(AXIAL_GUIDED_PLAN, s.history)
    expect(progress.current).toBe(1)
    type Stored = (typeof s.history)[number]
    expect(observations(AXIAL_GUIDED_PLAN as unknown as GuidedPlan<AxialDesign, Stored>, progress.completions[0]!, s.history)).toEqual([
      { label: 'Axial stress', change: 'decreased' },
      { label: 'Elongation', change: 'decreased' },
      { label: 'Mass', change: 'increased' },
    ])
    expect(AXIAL_GUIDED_PLAN.label('materialId')).toBe('Material')
    expect(AXIAL_GUIDED_PLAN.label('other')).toBe('other')
  })

  it('round-trips a v2 envelope under its own key and refuses other models and versions', () => {
    const s = looped()
    expect(axialRuntime.key(ch)).toBe('ei:session:stress-strain-1:v1')
    const raw = axialRuntime.serialize(s, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: { id: 'axialTieRod', version: 1 } })
    const back = axialRuntime.deserialize(raw, ch)
    expect(back).toEqual({ ok: true, value: s })
    expect(deserializeSessionV2(axialModel, axialPersistence, serializeSessionV2(axialModel.ref, s, T0), ch).ok).toBe(true)
    const t = torsionRuntime.init(torsionChallenge(), T0, 't0', 'parametric')
    if (!t.ok) throw new Error('torsion init')
    expect(axialRuntime.deserialize(torsionRuntime.serialize(t.value, T0), ch).ok).toBe(false)
    expect(axialRuntime.deserialize(serializeSessionV2(torsionModel.ref, s, T0), ch).ok).toBe(false)
  })

  it('rejects a saved session whose stored numbers were tampered with', () => {
    const parsed = JSON.parse(axialRuntime.serialize(looped(), T0)) as { session: { history: { analysis: { stressPa: number } }[] } }
    parsed.session.history[1]!.analysis.stressPa *= 1.01
    expect(axialRuntime.deserialize(JSON.stringify(parsed), ch).ok).toBe(false)
  })

  it('exports and imports v2 design files, refusing other challenges and bad fields', () => {
    const file = axialModel.exportDesign(worksheetFixture('titaniumSlim').design, ch)
    expect(JSON.parse(file)).toMatchObject({ schemaVersion: 2, challengeId: 'stress-strain-1', model: { id: 'axialTieRod', version: 1 } })
    expect(axialModel.importDesign(file, ch)).toEqual({ ok: true, value: { id: 'titaniumSlim', diameterM: 0.015, materialId: 'titanium' } })
    const other = JSON.parse(file) as Record<string, unknown>
    other.challengeId = 'torsion-shaft-1'
    expect(axialModel.importDesign(JSON.stringify(other), ch).ok).toBe(false)
    const bad = JSON.parse(file) as { design: Record<string, unknown> }
    bad.design.materialId = 'cork'
    bad.design.lengthM = 3
    const r = axialModel.importDesign(JSON.stringify(bad), ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.join(' ')).toMatch(/Unexpected key "design.lengthM"/)
  })

  it('turns an analysis invariant failure into a notice without appending a result', () => {
    const broken = { ...ch, forceN: Number.NaN }
    const s = run(fresh(), [edit({ type: 'setDiameter', valueM: 0.014, mode: 'strict' }), { type: 'setPrediction', direction: 'decrease', now: T0 }])
    const after = axialReducer(s, { type: 'runTest', now: T0, id: 'boom' }, broken)
    expect(after.history).toHaveLength(1)
    expect(after.ui.notice?.kind).toBe('error')
  })
})
