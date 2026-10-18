import { createContext, useContext, useEffect, useRef } from 'react'
import { useModelUi } from '../models/registry'
import { useStore } from '../state/store'
import { STATUS_LABELS } from '../panels/resultPresentation'

/** Task 60: spoken and shown once after Reset to baseline replaces the draft. */
export const RESET_DRAFT_ANNOUNCEMENT = 'Design reset to the baseline. Tested history is unchanged.'

export const AnnounceContext = createContext<(message: string) => void>(() => {})
export const useAnnounce = () => useContext(AnnounceContext)
/** Mounted by App's Workbench, the owner of its single persistent live region and toast. */
export function useAnnouncements(announce: (message: string) => void) {
  const { state, lastAction } = useStore()
  const { announceEdit } = useModelUi()
  const previous = useRef(state)
  useEffect(() => {
    const before = previous.current
    previous.current = state
    if (state.ui.notice && (state.ui.notice !== before.ui.notice || before === state)) { announce(state.ui.notice.message); return }
    if (state.history.length > before.history.length) {
      const result = state.history[state.history.length - 1]!
      announce(`Test ${result.iteration}: ${STATUS_LABELS[result.evaluation.status]}; ${result.failures.length} failed constraints.`)
    } else if (lastAction?.type === 'restore' && state !== before) {
      const result = state.history.find((r) => r.id === lastAction.testResultId)
      if (result) announce(`Restored ${result.iteration === 0 ? 'Baseline' : `iteration ${result.iteration}`}.`)
    } else if (lastAction?.type === 'resetDraft' && state !== before) {
      announce(RESET_DRAFT_ANNOUNCEMENT)
    } else if (lastAction && announceEdit && state.draftErrors.length === 0 && state !== before && announceEdit(state, lastAction) !== undefined) {
      announce(announceEdit(state, lastAction)!)
    } else if (lastAction?.type === 'runTest' && state.draftErrors.length) {
      announce(state.draftErrors.map((error) => error.message).join(' '))
    }
  }, [state, lastAction, announce, announceEdit])
}
