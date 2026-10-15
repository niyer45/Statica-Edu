import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { toStudentChallenge } from '../../challenge/content'
import type { Challenge, InteractionMode } from '../../challenge/types'
import type { Action, SessionState } from '../../state/session'
import { isModeAllowed, randomIdFactory, systemClock, type Clock, type IdFactory } from './bootstrap'
import { clearSnapshot, publishSnapshot } from './devSnapshot'
import { StoreContext, type Store } from './store'
import { makeStoreReducer } from './storeReducer'

// Session store (task 13.2; Req 3.7, 23.10, 23.11, 35.1).
// useReducer bound to the frozen challenge. Clock and id factory are injected here, outside
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
  children?: ReactNode
}

export default function StoreProvider({
  challenge,
  initialSession,
  initialMode,
  clock = systemClock,
  newId = randomIdFactory,
  children,
}: StoreProviderProps) {
  const reducer = useMemo(() => makeStoreReducer(challenge), [challenge])
  const [state, rawDispatch] = useReducer(reducer, initialSession, (s) =>
    initialMode !== undefined && isModeAllowed(challenge, initialMode) ? { ...s, mode: initialMode } : s,
  )
  const studentChallenge = useMemo(() => toStudentChallenge(challenge), [challenge])

  const dispatch = useCallback((a: Action) => rawDispatch(a), [])
  const selectMode = useCallback(
    (mode: InteractionMode) => {
      if (!isModeAllowed(challenge, mode)) return false
      rawDispatch({ type: 'selectMode', mode })
      return true
    },
    [challenge],
  )
  const runTest = useCallback(() => rawDispatch({ type: 'runTest', now: clock(), id: newId() }), [clock, newId])
  const submit = useCallback(
    (testResultId: string) => rawDispatch({ type: 'submit', testResultId, now: clock() }),
    [clock],
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
