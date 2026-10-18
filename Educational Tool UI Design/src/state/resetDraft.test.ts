import { describe, expect, it } from 'vitest'
import { BUNDLED_CHALLENGE_JSON } from '../challenge/bundled'
import { isDraftAtBaseline, requireModel } from './models'
import { runtimeForJson, type AnyRuntime, type LoopChallenge, type LoopSession } from './runtimes'

// Task 60: `resetDraft` (Reset to baseline) through every registered model runtime. The edit
// used is model-independent: the challenge's own reference design is exported and imported
// with that model's import/export, so these tests read the baseline and the edited design only
// from challenge content and never hard-code a model's parameters.

const T0 = '2026-10-18T09:00:00.000Z'

interface Session extends LoopSession {
  draft: { id: string }
  draftErrors: unknown[]
  pendingPrediction?: unknown
  compareSelection: string[]
  history: ReadonlyArray<LoopSession['history'][number] & { designSnapshot: { id: string } }>
}
type Challenge = LoopChallenge & { initialDesign: { id: string }; referenceDesign: unknown }

function setup(id: string) {
  const json = BUNDLED_CHALLENGE_JSON[id]
  const runtime = runtimeForJson(json) as AnyRuntime
  const loaded = runtime.load(json)
  if (!loaded.ok) throw new Error(`Bundled challenge ${id} did not load`)
  const ch = loaded.value as Challenge
  const init = runtime.init(ch, T0, `${id}:baseline`)
  if (!init.ok) throw new Error(init.error.message)
  const fresh = init.value as Session
  const reduce = (s: Session, a: { type: string; [k: string]: unknown }) => runtime.reduce(s, a, ch) as Session
  const run = (s: Session, actions: { type: string; [k: string]: unknown }[]) => actions.reduce(reduce, s)
  const def = requireModel(ch) as unknown as {
    exportDesign(d: unknown, c: unknown): string
    sameDesignIgnoringId(a: unknown, b: unknown): boolean
  }
  const reference = { type: 'importDesign', json: def.exportDesign(ch.referenceDesign, ch) }
  const atBaseline = (d: unknown) => def.sameDesignIgnoringId(d, ch.initialDesign)
  /** Edit → predicted test 1 → reflection and submission → edit again. */
  function tested(): Session {
    return run(fresh, [
      reference,
      { type: 'setPrediction', direction: 'decrease', now: T0 },
      { type: 'runTest', now: T0, id: `${id}:t1` },
      { type: 'setReflection', text: 'Keeps my evidence.' },
      { type: 'submit', testResultId: `${id}:t1`, now: T0 },
      { type: 'restore', testResultId: `${id}:baseline` },
      reference,
      { type: 'setPrediction', direction: 'same', now: T0 },
    ])
  }
  return { runtime, ch, fresh, reduce, run, reference, atBaseline, tested }
}

it('covers all six original challenges', () => {
  expect(Object.keys(BUNDLED_CHALLENGE_JSON)).toEqual(expect.arrayContaining(['cantilever-beam-1', 'mounting-bracket-1', 'torsion-shaft-1', 'heat-sink-1', 'braced-frame-1', 'vibration-isolation-1']))
})

describe.each(Object.keys(BUNDLED_CHALLENGE_JSON))('resetDraft for %s', (id) => {
  it('is a no-op (same state object) when the draft already equals the baseline', () => {
    const { fresh, reduce, ch } = setup(id)
    expect(isDraftAtBaseline(ch, fresh.draft)).toBe(true)
    expect(reduce(fresh, { type: 'resetDraft' })).toBe(fresh)
  })

  it('restores the challenge baseline and keeps tested history, comparison, reflection and submission', () => {
    const { tested, reduce, ch, atBaseline } = setup(id)
    const before = tested()
    expect(before.history).toHaveLength(2)
    expect(atBaseline(before.draft)).toBe(false)
    expect(isDraftAtBaseline(ch, before.draft)).toBe(false)
    expect(before.pendingPrediction).toBeDefined()
    expect(before.submission).toBeDefined()
    const after = reduce({ ...before, draftErrors: [{ code: 'STALE', message: 'stale' }] }, { type: 'resetDraft' })
    expect(atBaseline(after.draft)).toBe(true)
    expect(isDraftAtBaseline(ch, after.draft)).toBe(true)
    // A fresh design identity, never one already used by the draft or a stored test.
    const used = new Set([before.draft.id, ...before.history.flatMap((r) => [r.id, r.designSnapshot.id])])
    expect(used.has(after.draft.id)).toBe(false)
    expect(after.history).toBe(before.history)
    expect(after.submission).toBe(before.submission)
    expect(after.reflectionAnswer).toBe(before.reflectionAnswer)
    expect(after.compareSelection).toBe(before.compareSelection)
    expect(after.deletedIterationIds).toBe(before.deletedIterationIds)
    expect(after.mode).toBe(before.mode)
    // The latest test is not the baseline, so the restored baseline is an untested draft.
    expect(after.draftStatus).toBe('draft')
    expect(after.draftErrors).toEqual([])
    expect(after.pendingPrediction).toBeUndefined()
    expect(after.ui).toEqual({ predictionDialogOpen: false })
  })

  it("reports 'tested' when the latest recorded test is the baseline design", () => {
    const { fresh, run, reference } = setup(id)
    const after = run(fresh, [reference, { type: 'resetDraft' }])
    expect(after.draftStatus).toBe('tested')
    expect(after.history).toBe(fresh.history)
  })

  it('persists the reset draft like any other edit', () => {
    const { tested, reduce, runtime, ch, atBaseline } = setup(id)
    const after = reduce(tested(), { type: 'resetDraft' })
    const restored = runtime.deserialize(runtime.serialize(after, T0), ch)
    if (!restored.ok) throw new Error(restored.error)
    const session = restored.value as Session
    expect(atBaseline(session.draft)).toBe(true)
    expect(session.draft).toEqual(after.draft)
    expect(session.history).toEqual(after.history)
    expect(session.submission).toEqual(after.submission)
  })
})
