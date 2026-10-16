import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toStudentChallenge } from '../../challenge/content'
import type { Challenge, InteractionMode } from '../../challenge/types'
import { createPersistence, type SessionStorage } from '../../state/persistence'
import type { Action, SessionState } from '../../state/session'
import { isModeAllowed, randomIdFactory, systemClock, type Clock, type IdFactory } from './bootstrap'
import { clearSnapshot, publishSnapshot } from './devSnapshot'
import { StoreContext, type Store } from './store'
import { makeStoreReducer, type StoreAction } from './storeReducer'

// Session store (task 13.2; Req 3.7, 23.10, 23.11, 35.1).
// Pure reducer bound to the frozen challenge; synchronous dispatch preserves persistence ordering. Clock and id factory are injected here, outside
// the reducer. Children read the store through the hooks in ./store.

export interface StoreProviderProps {
  /** Deep-frozen challenge from the loader. Never exposed to children with referenceDesign. */
  challenge: Challenge
  /** Session from `bootstrap` / `initSession`. */
  initialSession: SessionState
  /** Mode to start in; ignored if not allowed (keeps the session's mode). */
  initialMode?: InteractionMode
  clock?: Clock
  newId?: IdFactory
  /** Explicit storage injection; App supplies browser storage, isolated test providers default to memory only. */
  storage?: SessionStorage | null
  children?: ReactNode
}

export default function StoreProvider({
  challenge,
  initialSession,
  initialMode,
  clock = systemClock,
  newId = randomIdFactory,
  children,
  storage = null,
}: StoreProviderProps) {
  const reducer = useMemo(() => makeStoreReducer(challenge), [challenge])
  const [boot] = useState(() => {
    const notices: string[] = []
    const persistence = storage ? createPersistence(challenge, storage, (message) => notices.push(message)) : undefined
    let state = persistence?.load(initialSession) ?? initialSession
    if (initialMode !== undefined && isModeAllowed(challenge, initialMode)) state = { ...state, mode: initialMode }
    const message = notices.pop()
    notices.length = 0
    if (message) state = { ...state, ui: { ...state.ui, notice: { kind: 'error', message } } }
    return { state, persistence, notices }
  })
  const [state, setState] = useState(boot.state)
  const current = useRef(state)
  // Reduce and persist synchronously before accepting the next action, even when React batches
  // renders. The domain reducer remains pure; only this injected UI adapter touches storage.
  const rawDispatch = useCallback((action: StoreAction) => {
    let next = reducer(current.current, action)
    if (next === current.current) return
    boot.persistence?.save(next, clock())
    const message = boot.notices.pop()
    boot.notices.length = 0
    if (message) next = { ...next, ui: { ...next.ui, notice: { kind: 'error', message } } }
    current.current = next
    setState(next)
  }, [reducer, boot, clock])
  const studentChallenge = useMemo(() => toStudentChallenge(challenge), [challenge])

  const dispatch = useCallback((a: Action) => rawDispatch(a), [rawDispatch])
  const selectMode = useCallback(
    (mode: InteractionMode) => {
      if (!isModeAllowed(challenge, mode)) return false
      rawDispatch({ type: 'selectMode', mode })
      return true
    },
    [challenge, rawDispatch],
  )
  const runTest = useCallback(() => rawDispatch({ type: 'runTest', now: clock(), id: newId() }), [clock, newId, rawDispatch])
  const submit = useCallback(
    (testResultId: string) => rawDispatch({ type: 'submit', testResultId, now: clock() }),
    [clock, rawDispatch],
  )

  useEffect(() => {
    publishSnapshot(state)
  }, [state])
  useEffect(() => clearSnapshot, [])

  const store = useMemo<Store>(
    () => ({ state, challenge: studentChallenge, dispatch, selectMode, runTest, submit, clock, newId }),
    [state, studentChallenge, dispatch, selectMode, runTest, submit, clock, newId],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
