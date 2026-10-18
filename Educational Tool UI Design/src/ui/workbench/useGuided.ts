import { useMemo } from 'react'
import { currentStep, guidedProgress, isEditable, type GuidedPlan, type GuidedProgress, type GuidedResult, type GuidedStep } from '../../evaluation/guided/plan'
import { useModelUi } from '../models/registry'
import { useModelStore } from '../state/store'

// Guided structured experiments in the UI (task 58). Progress comes from the pure guided plan
// over the stored history; nothing here evaluates designs. In Parametric nothing is locked.

export interface GuidedView {
  /** True in Guided mode. */
  active: boolean
  plan: GuidedPlan<unknown, unknown>
  progress: GuidedProgress
  /** The current step in Guided mode; undefined in Parametric or once every step is met. */
  step: GuidedStep | undefined
  /** True when `param` is locked in the current Guided step (always false in Parametric). */
  locked(param: string): boolean
  /** Short visible reason shown beside a locked control. */
  lockReason: string
}

export function useGuided(): GuidedView {
  const { state } = useModelStore<{ mode: string; history: ReadonlyArray<GuidedResult> }, never, unknown>()
  const plan = useModelUi().guided as GuidedPlan<unknown, unknown>
  const { mode, history } = state
  return useMemo(() => {
    const active = mode === 'guided'
    const progress = guidedProgress(plan, history)
    const step = active ? currentStep(plan, progress) : undefined
    return {
      active,
      plan,
      progress,
      step,
      locked: (param: string) => active && !isEditable(plan, progress, param),
      lockReason: step ? `Locked in this step. Editable now: ${step.focus}.` : '',
    }
  }, [mode, history, plan])
}
