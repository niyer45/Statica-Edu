import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../test/arbitraries'
import { sequenceHarness } from '../../test/state/sequence'
import { sessionReducer } from './reducer'
import { deserializeSession, serializeSession } from './persistence'
import { selectNextIteration, selectTestCount, selectVisibleHistory } from './selectors'
const ch = bundledChallenge()
const fresh = () => sequenceHarness(() => {}).real.state

describe('delete iteration from visible history', () => {
  it('protects Baseline, ignores unknown ids and makes repeated deletion a no-op', () => {
    const s = fresh()
    for (const id of [s.history[0]!.id, 'missing']) expect(sessionReducer(s, { type: 'deleteIteration', testResultId: id }, ch)).toBe(s)
    const id = s.history[1]!.id
    const next = sessionReducer(s, { type: 'deleteIteration', testResultId: id }, ch)
    expect(sessionReducer(next, { type: 'deleteIteration', testResultId: id }, ch)).toBe(next)
  })
  it('archives the row, prunes comparison and submission, and preserves draft/results/prediction provenance', () => {
    const s = fresh(), target = s.history[2]!
    const submitted = sessionReducer(sessionReducer(s, { type: 'setReflection', text: 'My reasoning' }, ch), { type: 'submit', testResultId: target.id, now: 't' }, ch)
    const next = sessionReducer({ ...submitted, compareSelection: [target.id] }, { type: 'deleteIteration', testResultId: target.id }, ch)
    expect(selectVisibleHistory(next).some((r) => r.id === target.id)).toBe(false)
    expect(next.history).toBe(s.history)
    expect(next.draft).toBe(s.draft)
    expect(next.draftStatus).toBe(s.draftStatus)
    expect(next.compareSelection).toEqual([])
    expect(next.submission).toBeUndefined()
    expect(next.reflectionAnswer).toBe('My reasoning')
    for (const type of ['restore', 'toggleCompare', 'submit'] as const) expect(sessionReducer(next, { type, testResultId: target.id, now: 't' }, ch)).toBe(next)
    expect(deserializeSession(serializeSession(next), ch)).toEqual({ ok: true, value: next })
  })
  it('keeps numbering after all rows are removed and records the next test without reusing ids/numbers', () => {
    let s = fresh()
    const history = s.history
    for (const r of history.slice(1)) s = sessionReducer(s, { type: 'deleteIteration', testResultId: r.id }, ch)
    expect(selectTestCount(s)).toBe(0)
    expect(selectVisibleHistory(s)).toEqual([history[0]])
    expect(selectNextIteration(s)).toBe(history.length)
    s = sessionReducer(s, { type: 'setPrediction', direction: 'same', now: 't' }, ch)
    s = sessionReducer(s, { type: 'runTest', id: 'after-delete', now: 't' }, ch)
    expect(s.history.at(-1)!.iteration).toBe(history.length)
    expect(selectVisibleHistory(s)).toHaveLength(2)
    expect(deserializeSession(serializeSession(s), ch)).toEqual({ ok: true, value: s })
  })
  it('rejects invalid deletion metadata and hidden references during storage restore', () => {
    const s = fresh(), id = s.history[1]!.id
    for (const deletedIterationIds of [[s.history[0]!.id], ['unknown'], [id, id]]) {
      expect(deserializeSession(serializeSession({ ...s, deletedIterationIds }), ch).ok).toBe(false)
    }
    expect(deserializeSession(serializeSession({ ...s, deletedIterationIds: [id], compareSelection: [id] }), ch).ok).toBe(false)
  })
})
