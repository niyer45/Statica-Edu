import { useState } from 'react'
import type { ModelRef } from '../../challenge/types'
import { isFreshSession } from '../../state/models'
import Dialog from '../dialogs/Dialog'
import Icon from '../icons/Icon'
import { useModelStore } from '../state/store'

// Reset to baseline (task 60, owner amendment). One shared control in the Design tools panel for
// every model: it asks for confirmation in the shared template Dialog (never window.confirm;
// Escape or Cancel keeps everything), then dispatches the engine's `resetDraft` with the
// injected clock and id. The engine rebuilds the session with its fresh-session constructor in
// the same mode: baseline design, test history back to only the Baseline, no reflection or
// submission. The store persists the result like any other action, and useAnnouncements speaks
// it once through the single live region. On a fresh session the button stays focusable but is
// marked aria-disabled and does nothing, so focus returning from the dialog is never lost.

export const RESET_DRAFT_LABEL = 'Reset to baseline'

type ResetSession = Parameters<typeof isFreshSession>[1]

interface ResetChallenge {
  model?: Readonly<ModelRef>
  initialDesign: unknown
}

export default function ResetDraftControl() {
  const { state, challenge, dispatch, clock, newId } = useModelStore<ResetSession, { type: 'resetDraft'; now: string; id: string }, ResetChallenge>()
  const [confirming, setConfirming] = useState(false)
  const fresh = isFreshSession(challenge, state)
  return (
    <div className="reset-baseline">
      <button
        type="button"
        className="secondary reset-baseline-button"
        aria-disabled={fresh}
        aria-describedby={fresh ? 'reset-baseline-note' : undefined}
        onClick={() => { if (!fresh) setConfirming(true) }}
      >
        <Icon name="reset" size={14} />
        {RESET_DRAFT_LABEL}
      </button>
      {fresh && <span id="reset-baseline-note" className="reset-baseline-note">Nothing to reset yet.</span>}
      {confirming && (
        <Dialog title="Reset this challenge?" icon="reset" onClose={() => setConfirming(false)}>
          <p>This clears your design, your test history, your reflection and any submission, and starts again from the baseline design.</p>
          <p>This cannot be undone.</p>
          <button
            type="button"
            className="primary modal-primary"
            onClick={() => { setConfirming(false); dispatch({ type: 'resetDraft', now: clock(), id: newId() }) }}
          >
            Reset challenge
          </button>
          <button type="button" className="delete-cancel" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </Dialog>
      )}
    </div>
  )
}
