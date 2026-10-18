import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../test/arbitraries'
import { peekSession, serializeSession, sessionKey, type SessionStorage } from './persistence'
import { sessionReducer } from './reducer'
import { selectProgress, selectWorkspaceStarted } from './selectors'
import { initSession } from './session'

// Read-only saved-session summaries for the shell (task 34.1 step 2; MM-23).

const ch = bundledChallenge()
const init = initSession(ch, '2026-10-17T00:00:00.000Z', 'b0')
if (!init.ok) throw new Error('bundled challenge must initialize')
const fresh = init.value

function recording(initial: Record<string, string>) {
  const values = new Map(Object.entries(initial))
  const writes: string[] = []
  const storage: SessionStorage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k) => void writes.push(`set ${k}`),
    removeItem: (k) => void writes.push(`remove ${k}`),
  }
  return { storage, writes }
}

describe('peekSession', () => {
  it('returns a valid saved session without writing', () => {
    const edited = sessionReducer(fresh, { type: 'setReflection', text: 'note' }, ch)
    const { storage, writes } = recording({ [sessionKey(ch)]: serializeSession(edited) })
    expect(peekSession(ch, storage)?.reflectionAnswer).toBe('note')
    expect(writes).toEqual([])
  })

  it.each([
    ['missing', {}],
    ['corrupt', { [sessionKey(ch)]: '{' }],
  ])('reads a %s save as absent and never removes it', (_name, initial: Record<string, string>) => {
    const { storage, writes } = recording(initial)
    expect(peekSession(ch, storage)).toBeUndefined()
    expect(writes).toEqual([])
  })

  it('never throws when storage access throws', () => {
    const storage: SessionStorage = { getItem: () => { throw new Error('denied') }, setItem: () => {}, removeItem: () => {} }
    expect(peekSession(ch, storage)).toBeUndefined()
  })
})

describe('selectWorkspaceStarted', () => {
  it('is false for an untouched Baseline and true once work exists', () => {
    expect(selectWorkspaceStarted(fresh)).toBe(false)
    expect(selectWorkspaceStarted(sessionReducer(fresh, { type: 'applySection', kind: 'tube' }, ch))).toBe(true)
    expect(selectWorkspaceStarted(sessionReducer(fresh, { type: 'setReflection', text: 'x' }, ch))).toBe(true)
  })
})

describe('selectProgress (task 38 homepage)', () => {
  const tested = { ...fresh, draftStatus: 'tested' as const, history: [...fresh.history, { ...fresh.history[0]!, id: 't1', iteration: 1, label: undefined }] }
  it('is not started for an untouched Baseline', () => {
    expect(selectProgress(fresh)).toEqual({ status: 'notStarted', testsRun: 0 })
  })
  it('is in progress with work, including an unsuccessful submission', () => {
    expect(selectProgress(sessionReducer(fresh, { type: 'setReflection', text: 'x' }, ch))).toEqual({ status: 'inProgress', testsRun: 0 })
    expect(selectProgress(tested)).toEqual({ status: 'inProgress', testsRun: 1 })
    expect(selectProgress({ ...tested, submission: { status: 'notAccepted' } })).toEqual({ status: 'inProgress', testsRun: 1, submission: 'notAccepted' })
    expect(selectProgress({ ...tested, submission: { status: 'modelNotApplicable' } }).status).toBe('inProgress')
  })
  it('is completed only for an Accepted submission', () => {
    expect(selectProgress({ ...tested, submission: { status: 'accepted' } })).toEqual({ status: 'completed', testsRun: 1, submission: 'accepted' })
  })
  it('does not count deleted tests', () => {
    expect(selectProgress({ ...tested, deletedIterationIds: ['t1'] })).toEqual({ status: 'inProgress', testsRun: 0 })
  })
})
