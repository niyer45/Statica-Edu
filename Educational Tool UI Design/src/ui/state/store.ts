import { createContext, useContext } from 'react'
import type { StudentChallenge } from '../../challenge/content'
import type { InteractionMode } from '../../challenge/types'
import type { Action, SessionState } from '../../state/session'
import type { Clock, IdFactory } from './bootstrap'

// Store context and hooks for ui/ components (tasks 13.3, 13.5 and later).
//
//   useSession()   current SessionState (read-only; derive views with state/selectors)
//   useDispatch()  dispatch a domain Action (edits, prediction, restore, compare, ...)
//   useChallenge() the student view of the challenge: `referenceDesign` is absent (Req 3.7)
//   useStore()     everything above plus:
//     selectMode(m)   switch Guided/Parametric; returns false and keeps the current mode
//                     when `m` is not in allowedModes (Req 35.1, 35.4)
//     runTest()       dispatches runTest with the injected clock and id factory
//     submit(id)      dispatches submit with the injected clock
//
// Prediction confirmation (task 22.2): dispatch setPrediction with now: clock(), then runTest().
// Components never call Date or crypto directly; the clock and id factory are injected into
// the provider so the reducer stays pure.

/**
 * The active challenge's store. Defaults are the beam types; a model's own UI reads its typed
 * store through `useModelStore` (task 34.2). Shared shell/workbench code reads only the
 * model-independent session fields.
 */
export interface Store<S = SessionState, A = Action, Ch = StudentChallenge> {
  state: S
  /** Last domain action for accessible event announcements; not persisted. */
  lastAction?: A
  challenge: Readonly<Ch>
  dispatch: (a: A) => void
  selectMode: (mode: InteractionMode) => boolean
  runTest: () => void
  submit: (testResultId: string) => void
  clock: Clock
  newId: IdFactory
}

export const StoreContext = createContext<Store<unknown, never, unknown> | null>(null)

function useAnyStore(): Store<unknown, never, unknown> {
  const store = useContext(StoreContext)
  if (store === null) throw new Error('useStore must be used inside <StoreProvider>.')
  return store
}

/** Beam-typed store. Beam components only mount under a beam challenge (ui/models registry). */
export function useStore(): Store {
  return useAnyStore() as unknown as Store
}

/** Typed store for a model's own UI; the model UI registry guarantees the active model matches. */
export function useModelStore<S, A, Ch>(): Store<S, A, Ch> {
  return useAnyStore() as unknown as Store<S, A, Ch>
}

export const useSession = (): SessionState => useStore().state
export const useDispatch = (): Store['dispatch'] => useStore().dispatch
export const useChallenge = (): Readonly<StudentChallenge> => useStore().challenge
