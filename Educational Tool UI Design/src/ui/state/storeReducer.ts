import type { Challenge, InteractionMode } from '../../challenge/types'
import { beamModel, requireModel } from '../../state/models'
import { sessionReducer } from '../../state/reducer'
import type { Action, SessionState } from '../../state/session'
import { isModeAllowed } from './bootstrap'

// Provider-level reducer: the domain sessionReducer plus mode selection (Req 35.1, 35.4).
// Mode only changes `mode`; draft, history, and evaluations are untouched, so both modes share
// one session (Req 35.3). A mode outside `allowedModes` leaves the state unchanged.

export type StoreAction = Action | { type: 'selectMode'; mode: InteractionMode }

export function makeStoreReducer(ch: Challenge): (s: SessionState, a: StoreAction) => SessionState {
  // Refuse to bind a challenge whose model is not registered rather than substituting one (MM-07).
  if (requireModel(ch) !== beamModel) throw new Error('This store supports the beam model only until its model UI is integrated.')
  return (s, a) => {
    if (a.type === 'selectMode') {
      if (!isModeAllowed(ch, a.mode) || s.mode === a.mode) return s
      return { ...s, mode: a.mode }
    }
    return sessionReducer(s, a, ch)
  }
}
