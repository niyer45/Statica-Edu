import { useState } from 'react'
import type { ModelRef } from '../../challenge/types'
import { isDraftAtBaseline } from '../../state/models'
import Dialog from '../dialogs/Dialog'
import Icon from '../icons/Icon'
import { useModelStore } from '../state/store'

// Reset to baseline (task 60). One shared control in the Design tools panel for every model:
// it asks for confirmation in the shared template Dialog (never window.confirm), then
// dispatches the engine's `resetDraft`, which replaces the draft with the challenge's baseline
// design and keeps tested history and any submission. The store persists the new draft like any
// other edit, and useAnnouncements speaks the result once through the single live region.
// When the draft already equals the baseline the button stays focusable but is marked
// aria-disabled and does nothing, so focus returning from the dialog is never lost.

export const RESET_DRAFT_LABEL = 'Reset to baseline'

interface ResetStore {
  draft: unknown
}

interface ResetChallenge {
  model?: Readonly<ModelRef>
  initialDesign: unknown
}

export default function ResetDraftControl() {
  const { state, challenge, dispatch } = useModelStore<ResetStore, { type: 'resetDraft' }, ResetChallenge>()
  const [confirming, setConfirming] = useState(false)
  const atBaseline = isDraftAtBaseline(challenge, state.draft)
  return (
    <div className="reset-baseline">
      <button
        type="button"
        className="secondary reset-baseline-button"
        aria-disabled={atBaseline}
        aria-describedby={atBaseline ? 'reset-baseline-note' : undefined}
        onClick={() => { if (!atBaseline) setConfirming(true) }}
      >
        <Icon name="reset" size={14} />
        {RESET_DRAFT_LABEL}
      </button>
      {atBaseline && <span id="reset-baseline-note" className="reset-baseline-note">Design matches the baseline.</span>}
      {confirming && (
        <Dialog title="Reset design?" icon="reset" onClose={() => setConfirming(false)}>
          <p>Your current design will be replaced by the challenge&apos;s baseline design. Untested changes will be lost.</p>
          <p>Your tested history and any submission stay unchanged.</p>
          <button
            type="button"
            className="primary modal-primary"
            onClick={() => { setConfirming(false); dispatch({ type: 'resetDraft' }) }}
          >
            Reset design
          </button>
          <button type="button" className="delete-cancel" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </Dialog>
      )}
    </div>
  )
}
