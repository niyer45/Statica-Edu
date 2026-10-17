import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { InteractionMode } from '../../challenge/types'
import { createPersistenceWith, type SessionStorage } from '../../state/persistence'
import type { LoopChallenge, LoopSession, ModelRuntime } from '../../state/runtimes'
import type { SessionState } from '../../state/session'
import { isModeAllowed, randomIdFactory, systemClock, type Clock, type IdFactory } from './bootstrap'
import { clearSnapshot, publishSnapshot } from './devSnapshot'
import { StoreContext, type Store } from './store'
import type { Challenge } from '../../challenge/types'
import { makeRuntimeReducer, requireRuntime, type AnyStoreAction } from './storeReducer'

// Session store (task 13.2; Req 3.7, 23.10, 23.11, 35.1). Since task 34.2 the reducer and
// persistence envelope come from the challenge's model runtime (MM-05, MM-17, MM-18).
// Pure reducer bound to the frozen challenge; synchronous dispatch preserves persistence ordering. Clock and id factory are injected here, outside
// the reducer. Children read the store through the hooks in ./store.

export interface StoreProviderProps {
  /** Deep-frozen challenge from the loader. Never exposed to children with referenceDesign. */
  challenge: Challenge | LoopChallenge
  /** Session from `bootstrap` / the runtime's `init`. */
  initialSession: LoopSession
  /** The challenge's model runtime; defaults to the registered runtime for its model. */
  runtime?: ModelRuntime
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
  runtime: runtimeProp,
}: StoreProviderProps) {
  const runtime = useMemo(() => runtimeProp ?? requireRuntime(challenge), [runtimeProp, challenge])
  const reducer = useMemo(() => makeRuntimeReducer(challenge, runtime), [challenge, runtime])
  const [boot] = useState(() => {
    const notices: string[] = []
    const persistence = storage ? createPersistenceWith(runtime, challenge, storage, (message) => notices.push(message)) : undefined
    let state = persistence?.load(initialSession) ?? initialSession
    if (initialMode !== undefined && isModeAllowed(challenge, initialMode)) state = { ...state, mode: initialMode }
    const message = notices.pop()
    notices.length = 0
    if (message) state = { ...state, ui: { ...state.ui, notice: { kind: 'error', message } } }
    return { state, persistence, notices }
  })
  const [state, setState] = useState(boot.state)
  const [lastAction, setLastAction] = useState<AnyStoreAction | undefined>()
  const current = useRef(state)
  // Reduce and persist synchronously before accepting the next action, even when React batches
  // renders. The domain reducer remains pure; only this injected UI adapter touches storage.
  const rawDispatch = useCallback((action: AnyStoreAction) => {
    let next = reducer(current.current, action)
    if (next === current.current) return
    boot.persistence?.save(next, clock())
    const message = boot.notices.pop()
    boot.notices.length = 0
    if (message) next = { ...next, ui: { ...next.ui, notice: { kind: 'error', message } } }
    current.current = next
    setLastAction(action.type === 'selectMode' ? undefined : action)
    setState(next)
  }, [reducer, boot, clock])
  const studentChallenge = useMemo(() => {
    // Student views never receive the internal reference design (Req 3.7): the key is absent.
    const { referenceDesign: _omitted, ...student } = challenge
    void _omitted
    return Object.freeze(student)
  }, [challenge])

  const dispatch = useCallback((a: AnyStoreAction) => rawDispatch(a), [rawDispatch])
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
    publishSnapshot(state as SessionState)
  }, [state])
  useEffect(() => clearSnapshot, [])

  const store = useMemo<Store<LoopSession, AnyStoreAction, Omit<LoopChallenge, 'referenceDesign'>>>(
    () => ({ state, lastAction, challenge: studentChallenge, dispatch, selectMode, runTest, submit, clock, newId }),
    [state, lastAction, studentChallenge, dispatch, selectMode, runTest, submit, clock, newId],
  )

  return <StoreContext.Provider value={store as unknown as Store<unknown, never, unknown>}>{children}</StoreContext.Provider>
}
