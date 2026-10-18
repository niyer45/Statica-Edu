import { afterEach, describe, expect, it, vi } from 'vitest'
import { bundledChallengeResult } from '../challenge/content'
import { deepFreeze } from '../challenge/deepFreeze'
import { evaluate } from '../evaluation/evaluate'
import { validateDesign } from '../geometry/validate'
import * as physics from '../physics/analyze'
import { sessionReducer } from './reducer'
import { cloneDesign, initSession, type Action, type SessionState } from './session'

// Task 19.1 examples. Model-based/property sequence suites remain tasks 19.3–19.15.
if (!bundledChallengeResult.ok) throw new Error('Invalid bundled challenge')
const ch = bundledChallengeResult.value
const now = '2026-10-15T20:00:00.000Z'
function fresh(): SessionState {
  const r = initSession(ch, '2026-10-15T19:00:00.000Z', 'base')
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}
const step = (s: SessionState, a: Action) => sessionReducer(s, a, ch)
const predict = (s: SessionState, direction: 'same' | 'increase' | 'decrease' = 'same') => step(s, { type: 'setPrediction', direction, explanation: 'My prediction.', now })
const run = (s: SessionState, id = 'run-1') => step(s, { type: 'runTest', id, now })
// The baseline is an I-section turned 90°: its flange width is the depth that bends, so widening
// it stiffens the beam (36.5 → 40 mm lowers the deflection) and narrowing it does the reverse.
const edit = (s: SessionState, widthM: number) => step(s, { type: 'setParam', param: 'widthM', valueM: widthM, mode: 'strict' })
afterEach(() => vi.restoreAllMocks())

function expectDeepFrozen(value: unknown) {
  if (value === null || typeof value !== 'object') return
  expect(Object.isFrozen(value)).toBe(true)
  Object.values(value).forEach(expectDeepFrozen)
}

describe('prediction checkpoint (19.1)', () => {
  it('opens the dialog at iterations 1 and 3 without changing the draft/history; iteration 2 runs directly', () => {
    const initial = edit(fresh(), 0.04)
    const gated = run(initial)
    expect(gated.ui.predictionDialogOpen).toBe(true)
    expect(gated.history).toBe(initial.history)
    expect(gated.draft).toBe(initial.draft)
    expect(gated.draftStatus).toBe(initial.draftStatus)
    const first = run(predict(gated, 'decrease'))
    expect(first.history).toHaveLength(2)
    const second = run(first, 'run-2')
    expect(second.history).toHaveLength(3)
    expect(second.ui.predictionDialogOpen).toBe(false)
    const third = run(second, 'run-3')
    expect(third.ui.predictionDialogOpen).toBe(true)
    expect(third.history).toBe(second.history)
    expect(run(predict(third), 'run-3').history).toHaveLength(4)
  })

  it('stores the exact injected prediction time and accepts empty or 500-character explanations', () => {
    for (const explanation of [undefined, '', 'x'.repeat(500)]) {
      const initial = fresh()
      const s = step(initial, { type: 'setPrediction', direction: 'increase', explanation, now })
      expect(s.pendingPrediction).toEqual({ iteration: 1, direction: 'increase', ...(explanation === undefined ? {} : { explanation }), createdAt: now })
      expectDeepFrozen(s.pendingPrediction)
      expect(s.history).toBe(initial.history)
      expect(s.draft).toBe(initial.draft)
    }
  })

  it.each([
    { direction: 'invalid', explanation: '' },
    { direction: 'same', explanation: 'x'.repeat(501) },
    { direction: 'same', explanation: 42 },
  ])('rejects invalid confirmation fields without storing a prediction or a test (%j)', (payload) => {
    const initial = predict(fresh())
    const invalid = { type: 'setPrediction', ...payload, now } as unknown as Action
    const s = step(initial, invalid)
    expect(s.pendingPrediction).toBeUndefined()
    expect(s.ui.predictionDialogOpen).toBe(true)
    expect(s.ui.notice?.kind).toBe('error')
    expect(s.ui.notice?.message).toMatch(/direction|explanation/i)
    expect(s.draft).toBe(initial.draft)
    expect(s.history).toBe(initial.history)
  })

  it('cancels without recording a prediction/test or changing the draft', () => {
    const initial = { ...predict(run(fresh())), reflectionAnswer: 'Keep this.' }
    const s = step(initial, { type: 'cancelPrediction' })
    expect(s.pendingPrediction).toBeUndefined()
    expect(s.ui.predictionDialogOpen).toBe(false)
    expect(s.history).toBe(initial.history)
    expect(s.draft).toBe(initial.draft)
    expect(s.reflectionAnswer).toBe(initial.reflectionAnswer)
  })

  it('does not let a stale prediction bypass the next checkpoint', () => {
    const initial = predict(fresh())
    const stale = { ...initial, pendingPrediction: { ...initial.pendingPrediction!, iteration: 99 } }
    const s = run(stale)
    expect(s.history).toBe(initial.history)
    expect(s.ui.predictionDialogOpen).toBe(true)
    expect(s.pendingPrediction).toBeUndefined()
  })
})

describe('runTest snapshots and evaluation (19.1)', () => {
  it('records the solver/evaluation output with injected id/time and clears transient state', () => {
    const edited = predict(edit(fresh(), 0.04), 'decrease')
    const initial: SessionState = { ...edited, draftErrors: [{ code: 'BELOW_MIN', param: 'diameterM', message: 'Old error' }], ui: { predictionDialogOpen: true, notice: { kind: 'error', message: 'Old notice' } } }
    const s = run(initial, 'injected-result-id')
    const result = s.history[1]!
    expect(result).toMatchObject({ id: 'injected-result-id', iteration: 1, timestamp: now })
    expect(result.designSnapshot).toEqual(initial.draft)
    expect(result.designSnapshot).not.toBe(initial.draft)
    expect(result.designSnapshot.section).not.toBe(initial.draft.section)
    const analysis = physics.analyze(initial.draft, ch)
    expect(result.analysis).toEqual(analysis)
    expect(result.evaluation).toEqual(evaluate(initial.draft, analysis, ch))
    expect(result.accepted).toBe(result.evaluation.accepted)
    expect(result.failures).toEqual(result.evaluation.failures)
    expect(result.prediction).toEqual(initial.pendingPrediction)
    expect(result.predictionOutcome).toMatchObject({ predicted: 'decrease', actual: 'decrease', matched: true })
    expect(s.draft).toBe(initial.draft)
    expect(s.draftStatus).toBe('tested')
    expect(s.draftErrors).toEqual([])
    expect(s.pendingPrediction).toBeUndefined()
    expect(s.ui).toEqual({ predictionDialogOpen: false, notice: undefined })
    expect(s.compareSelection).toEqual(['injected-result-id'])
    expect(s.history[0]).toBe(initial.history[0])
    expectDeepFrozen(s.history)
  })

  it('scores against the immediately previous test rather than the baseline, including optional predictions', () => {
    const first = run(predict(edit(fresh(), 0.04), 'decrease'))
    const second = run(predict(edit(first, 0.03), 'increase'), 'run-2')
    const result = second.history[2]!
    expect(result.predictionOutcome?.actual).toBe('increase')
    expect(result.predictionOutcome?.ratio).toBe(result.analysis.tipDeflectionM / first.history[1]!.analysis.tipDeflectionM)
    expect(result.predictionOutcome?.matched).toBe(true)
    expect(result.prediction?.iteration).toBe(2)
  })

  it('omits prediction and outcome fields completely when a prediction is not supplied', () => {
    const first = run(predict(fresh()))
    const second = run(first, 'run-2')
    const result = second.history[2]!
    expect(Object.prototype.hasOwnProperty.call(result, 'prediction')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(result, 'predictionOutcome')).toBe(false)
  })

  it('uses the challenge prediction policy instead of hard-coded checkpoint numbers', () => {
    const noCheckpoints = { ...ch, predictionPolicy: { requiredOnIterations: [] } }
    const s = sessionReducer(fresh(), { type: 'runTest', id: 'no-checkpoint', now }, noCheckpoints)
    expect(s.history[1]?.iteration).toBe(1)
    expect(s.history[1]?.prediction).toBeUndefined()
    expect(s.ui.predictionDialogOpen).toBe(false)
  })

  it('copies the mutable input rather than freezing or sharing its draft/prediction', () => {
    const initial = predict(fresh())
    const mutable: SessionState = { ...initial, pendingPrediction: { ...initial.pendingPrediction! } }
    const s = run(mutable)
    expect(Object.isFrozen(mutable.draft)).toBe(false)
    expect(Object.isFrozen(mutable.draft.section)).toBe(false)
    expect(Object.isFrozen(mutable.pendingPrediction)).toBe(false)
    if (mutable.draft.section.kind !== 'iSection') throw new Error('Expected I-section')
    mutable.draft.section.widthM = 0.08
    mutable.pendingPrediction!.direction = 'increase'
    expect(s.history[1]!.designSnapshot.section).toEqual(ch.initialDesign.section)
    expect(s.history[1]!.prediction!.direction).toBe('same')
    expect(() => { (s.history[1]!.designSnapshot.section as { widthM: number }).widthM = 0.07 }).toThrow()
  })

  it('keeps the highest-numbered three selected non-baseline iterations in history order', () => {
    let s = fresh()
    for (let iteration = 1; iteration <= 5; iteration++) {
      if (ch.predictionPolicy.requiredOnIterations.includes(iteration)) s = predict(s)
      s = run(s, `run-${iteration}`)
    }
    expect(s.compareSelection).toEqual(['run-3', 'run-4', 'run-5'])
    s = run({ ...s, compareSelection: ['run-4', 'base', 'run-1', 'run-3', 'run-4', 'unknown'] }, 'run-6')
    expect(s.compareSelection).toEqual(['run-3', 'run-4', 'run-6'])
    expect(s.history.map((r) => r.iteration)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('records out-of-assumption geometry as modelNotApplicable rather than blocking the test', () => {
    // A 10 mm flange width deflects about 114 mm (δ/L ≈ 0.19 > 0.1): outside small deflection.
    const s = run(predict(edit(fresh(), 0.01)))
    expect(s.history[1]!.evaluation.status).toBe('modelNotApplicable')
    expect(s.history[1]!.accepted).toBe(false)
  })

  it('is deterministic and leaves deeply frozen input state, action, and challenge unchanged', () => {
    const initial = deepFreeze(predict(edit(fresh(), 0.04)))
    const before = structuredClone(initial)
    const action = deepFreeze({ type: 'runTest', id: 'fixed-id', now } as const)
    const a = step(initial, action)
    const b = step(initial, action)
    expect(a).toEqual(b)
    expect(initial).toEqual(before)
    expect(ch).toBe(bundledChallengeResult.ok ? bundledChallengeResult.value : undefined)
    expect(a.history[0]).toBe(initial.history[0])
  })
})

describe('runTest failure paths (19.1)', () => {
  it('validates before prediction gating, reports all draft errors and closes an already-open dialog', () => {
    const initial = predict(fresh())
    const bad: SessionState = { ...initial, draft: { ...cloneDesign(initial.draft), lengthM: 1, section: { kind: 'circle', diameterM: NaN } }, draftStatus: 'draft', ui: { predictionDialogOpen: true } }
    const s = run(bad)
    expect(s.draftErrors).toEqual(validateDesign(bad.draft, ch))
    expect(s.draftErrors.length).toBeGreaterThan(1)
    expect(s.ui.predictionDialogOpen).toBe(false)
    expect(s.history).toBe(bad.history)
    expect(s.pendingPrediction).toBe(bad.pendingPrediction)
    expect(s.draft).toBe(bad.draft)
    expect(s.draftStatus).toBe(bad.draftStatus)
    const withoutPrediction = run({ ...bad, pendingPrediction: undefined })
    expect(withoutPrediction.ui.predictionDialogOpen).toBe(false)
    expect(withoutPrediction.history).toBe(bad.history)
  })

  it('catches PhysicsInvariantError, keeps the iteration/prediction available for retry, and reports the cause', () => {
    const initial = predict(edit(fresh(), 0.04))
    const broken = { ...ch, material: { ...ch.material, elasticModulusPa: 0 } }
    const failed = sessionReducer(initial, { type: 'runTest', id: 'failed', now }, broken)
    expect(failed.ui.notice).toEqual({ kind: 'error', message: expect.stringContaining('tipDeflectionM') })
    expect(failed.ui.predictionDialogOpen).toBe(false)
    expect(failed.history).toBe(initial.history)
    expect(failed.compareSelection).toBe(initial.compareSelection)
    expect(failed.pendingPrediction).toBe(initial.pendingPrediction)
    expect(failed.draftStatus).toBe(initial.draftStatus)
    const retried = run(failed, 'retry')
    expect(retried.history[1]).toMatchObject({ id: 'retry', iteration: 1 })
    expect(retried.ui.notice).toBeUndefined()
  })

  it('does not swallow unrelated programming errors', () => {
    const initial = predict(fresh())
    vi.spyOn(physics, 'analyze').mockImplementationOnce(() => { throw new Error('Unexpected failure') })
    expect(() => run(initial)).toThrow('Unexpected failure')
  })
})
