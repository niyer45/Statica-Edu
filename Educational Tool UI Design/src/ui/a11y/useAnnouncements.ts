import { createContext, useContext, useEffect, useRef } from 'react'
import { guidedProgress, type GuidedPlan, type GuidedResult } from '../../evaluation/guided/plan'
import { useModelUi } from '../models/registry'
import { useStore } from '../state/store'
import { STATUS_LABELS } from '../panels/resultPresentation'

export const AnnounceContext = createContext<(message: string) => void>(() => {})
export const useAnnounce = () => useContext(AnnounceContext)
/** Guided step completion text for a new test (task 58), or '' when no step was met. */
export function guidedStepText(plan: GuidedPlan<unknown, unknown>, before: ReadonlyArray<GuidedResult>, after: ReadonlyArray<GuidedResult>): string {
  const was = guidedProgress(plan, before).current
  const now = guidedProgress(plan, after).current
  if (now <= was) return ''
  const done = plan.steps[was]!
  const next = plan.steps[now]
  return ` Guided step ${was + 1} complete: ${done.title}.${next ? ` Next: ${next.title}.` : ' All experiments complete.'}`
}

/** Mounted by App's Workbench, the owner of its single persistent live region and toast. */
export function useAnnouncements(announce: (message: string) => void) {
  const { state, lastAction } = useStore()
  const { announceEdit, guided } = useModelUi()
  const previous = useRef(state)
  useEffect(() => {
    const before = previous.current
    previous.current = state
    if (state.ui.notice && (state.ui.notice !== before.ui.notice || before === state)) { announce(state.ui.notice.message); return }
    if (state.history.length > before.history.length) {
      const result = state.history[state.history.length - 1]!
      const step = state.mode === 'guided' ? guidedStepText(guided as GuidedPlan<unknown, unknown>, before.history as unknown as GuidedResult[], state.history as unknown as GuidedResult[]) : ''
      announce(`Test ${result.iteration}: ${STATUS_LABELS[result.evaluation.status]}; ${result.failures.length} failed constraints.${step}`)
    } else if (lastAction?.type === 'restore' && state !== before) {
      const result = state.history.find((r) => r.id === lastAction.testResultId)
      if (result) announce(`Restored ${result.iteration === 0 ? 'Baseline' : `iteration ${result.iteration}`}.`)
    } else if (lastAction && announceEdit && state.draftErrors.length === 0 && state !== before && announceEdit(state, lastAction) !== undefined) {
      announce(announceEdit(state, lastAction)!)
    } else if (lastAction?.type === 'runTest' && state.draftErrors.length) {
      announce(state.draftErrors.map((error) => error.message).join(' '))
    }
  }, [state, lastAction, announce, announceEdit, guided])
}
