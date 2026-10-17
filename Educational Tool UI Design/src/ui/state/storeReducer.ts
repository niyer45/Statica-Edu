import type { Challenge, InteractionMode } from '../../challenge/types'
import { modelOf, UnregisteredModelError } from '../../state/models'
import { runtimeFor, type LoopChallenge, type LoopSession, type ModelRuntime } from '../../state/runtimes'
import type { Action, SessionState } from '../../state/session'
import { isModeAllowed } from './bootstrap'

// Provider-level reducer: the model's session reducer plus mode selection (Req 35.1, 35.4).
// Mode only changes `mode`; draft, history, and evaluations are untouched, so both modes share
// one session (Req 35.3). A mode outside `allowedModes` leaves the state unchanged.
// The model reducer comes from the challenge's explicit runtime (task 34.2; MM-05, MM-07).

export type StoreAction = Action | { type: 'selectMode'; mode: InteractionMode }
export type SelectModeAction = { type: 'selectMode'; mode: InteractionMode }

/** The registered runtime for a challenge; throws instead of substituting another model. */
export function requireRuntime(ch: LoopChallenge): ModelRuntime {
  const ref = modelOf(ch)
  const runtime = runtimeFor(ref)
  if (runtime === undefined) throw new UnregisteredModelError(ref)
  return runtime
}

/** Any store action: a model action or mode selection. */
export type AnyStoreAction = { type: string; [key: string]: unknown }

/** Beam-typed provider reducer (kept for existing callers and tests). */
export function makeStoreReducer(ch: Challenge): (s: SessionState, a: StoreAction) => SessionState {
  return makeRuntimeReducer(ch, requireRuntime(ch)) as unknown as (s: SessionState, a: StoreAction) => SessionState
}

/** Provider reducer for any model runtime. */
export function makeRuntimeReducer(ch: LoopChallenge, runtime: ModelRuntime): (s: LoopSession, a: AnyStoreAction) => LoopSession {
  return (s, a) => {
    if (a.type === 'selectMode') {
      const mode = (a as SelectModeAction).mode
      if (!isModeAllowed(ch, mode) || s.mode === mode) return s
      return { ...s, mode }
    }
    return runtime.reduce(s, a, ch)
  }
}
