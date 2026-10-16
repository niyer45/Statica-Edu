import { createContext, useContext, useEffect, useRef } from 'react'
import { SECTION_KIND_NAMES } from '../../evaluation/explain'
import { useStore } from '../state/store'
import { STATUS_LABELS } from '../panels/resultPresentation'

export const AnnounceContext = createContext<(message: string) => void>(() => {})
export const useAnnounce = () => useContext(AnnounceContext)
/** Mounted by App's Workbench, the owner of its single persistent live region and toast. */
export function useAnnouncements(announce: (message: string) => void) {
  const { state, lastAction } = useStore()
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
    } else if (lastAction?.type === 'applySection' && state.draftErrors.length === 0 && state !== before) {
      announce(`Section applied: ${SECTION_KIND_NAMES[state.draft.section.kind]}.`)
    } else if (lastAction?.type === 'runTest' && state.draftErrors.length) {
      announce(state.draftErrors.map((error) => error.message).join(' '))
    }
  }, [state, lastAction, announce])
}
