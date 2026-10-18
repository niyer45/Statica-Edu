import { describe, expect, it } from 'vitest'
import type { InteractionMode } from '../challenge/types'
import { BUNDLED_CHALLENGE_JSON } from '../challenge/bundled'
import { isFreshSession, requireModel } from './models'
import { runtimeForJson, type AnyRuntime, type LoopChallenge, type LoopSession } from './runtimes'

// Task 60 (owner amendment): `resetDraft` (Reset to baseline) through every registered model
// runtime. A reset session must equal a first opening of the challenge in the same mode, built by
// the runtime's own init, apart from the injected time and Baseline id. The edit used is
// model-independent: the challenge's own reference design is exported and imported with that
// model's import/export, so baselines and edits come only from challenge content.

const T0 = '2026-10-18T09:00:00.000Z'
const T1 = '2026-10-18T10:00:00.000Z'

type Action = { type: string; [k: string]: unknown }
interface Session extends LoopSession {
  draft: { id: string }
  draftErrors: unknown[]
  pendingPrediction?: unknown
  compareSelection: string[]
}
type Challenge = LoopChallenge & { initialDesign: { id: string }; referenceDesign: unknown }

function setup(id: string, mode: InteractionMode) {
  const json = BUNDLED_CHALLENGE_JSON[id]
  const runtime = runtimeForJson(json) as AnyRuntime
  const loaded = runtime.load(json)
  if (!loaded.ok) throw new Error(`Bundled challenge ${id} did not load`)
  const ch = loaded.value as Challenge
  const init = (now: string, baselineId: string): Session => {
    const r = runtime.init(ch, now, baselineId, mode)
    if (!r.ok) throw new Error(r.error.message)
    return r.value as Session
  }
  const fresh = init(T0, `${id}:baseline`)
  const reduce = (s: Session, a: Action) => runtime.reduce(s, a, ch) as Session
  const run = (s: Session, actions: Action[]) => actions.reduce(reduce, s)
  const def = requireModel(ch) as unknown as { exportDesign(d: unknown, c: unknown): string }
  const reference: Action = { type: 'importDesign', json: def.exportDesign(ch.referenceDesign, ch) }
  const reset: Action = { type: 'resetDraft', now: T1, id: `${id}:baseline-2` }
  /** Edit → predicted test 1 → reflection and submission → delete nothing yet → edit pending. */
  const worked = (): Session => run(fresh, [
    reference,
    { type: 'setPrediction', direction: 'decrease', now: T0 },
    { type: 'runTest', now: T0, id: `${id}:t1` },
    { type: 'setReflection', text: 'Reflection to clear.' },
    { type: 'submit', testResultId: `${id}:t1`, now: T0 },
    { type: 'restore', testResultId: `${id}:baseline` },
    { type: 'setPrediction', direction: 'same', now: T0 },
  ])
  return { runtime, ch, init, fresh, reduce, run, reference, reset, worked }
}

it('covers all six original challenges', () => {
  expect(Object.keys(BUNDLED_CHALLENGE_JSON)).toEqual(expect.arrayContaining(['cantilever-beam-1', 'mounting-bracket-1', 'torsion-shaft-1', 'heat-sink-1', 'braced-frame-1', 'vibration-isolation-1']))
})

describe.each(Object.keys(BUNDLED_CHALLENGE_JSON))('resetDraft for %s', (id) => {
  it.each(['guided', 'parametric'] as const)('%s: a fresh session is a no-op (same state object)', (mode) => {
    const { fresh, reduce, reset, ch } = setup(id, mode)
    expect(isFreshSession(ch, fresh)).toBe(true)
    expect(reduce(fresh, reset)).toBe(fresh)
  })

  it.each(['guided', 'parametric'] as const)('%s: returns exactly to a first opening in the same mode', (mode) => {
    const { worked, reduce, reset, init, ch } = setup(id, mode)
    const before = worked()
    expect(before.history).toHaveLength(2)
    expect(before.submission).toBeDefined()
    expect(before.pendingPrediction).toBeDefined()
    expect(isFreshSession(ch, before)).toBe(false)
    const after = reduce(before, reset)
    // The runtime's own fresh-session constructor, with the injected time and Baseline id.
    expect(after).toEqual(init(T1, `${id}:baseline-2`))
    expect(after.mode).toBe(mode)
    expect(after.history).toHaveLength(1)
    expect(after.history[0]!.iteration).toBe(0)
    expect(after.submission).toBeUndefined()
    expect(after.reflectionAnswer).toBe('')
    expect(after.pendingPrediction).toBeUndefined()
    expect(after.compareSelection).toEqual([])
    expect(after.draftStatus).toBe('tested')
    expect(isFreshSession(ch, after)).toBe(true)
  })

  it('clears archived (deleted) history entries too', () => {
    const { fresh, run, reference, reset, ch } = setup(id, 'parametric')
    const deleted = run(fresh, [
      reference,
      { type: 'setPrediction', direction: 'decrease', now: T0 },
      { type: 'runTest', now: T0, id: `${id}:t1` },
      { type: 'deleteIteration', testResultId: `${id}:t1` },
      { type: 'restore', testResultId: `${id}:baseline` },
    ])
    expect(deleted.deletedIterationIds).toEqual([`${id}:t1`])
    // Only the Baseline is visible and the draft is at the baseline, but the archive still counts.
    expect(isFreshSession(ch, deleted)).toBe(false)
    const after = run(deleted, [reset])
    expect(after.history).toHaveLength(1)
    expect(after.deletedIterationIds).toBeUndefined()
  })

  it('a reflection alone makes the session resettable', () => {
    const { fresh, run, reset, ch } = setup(id, 'parametric')
    const s = run(fresh, [{ type: 'setReflection', text: 'draft thoughts' }])
    expect(isFreshSession(ch, s)).toBe(false)
    expect(run(s, [reset]).reflectionAnswer).toBe('')
  })

  it('persists the reset session like any other action', () => {
    const { worked, reduce, reset, runtime, ch } = setup(id, 'guided')
    const after = reduce(worked(), reset)
    const restored = runtime.deserialize(runtime.serialize(after, T1), ch)
    if (!restored.ok) throw new Error(restored.error)
    expect(restored.value).toEqual(after)
  })
})
