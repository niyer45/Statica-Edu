import { currentStep, guidedProgress, lockedChange, type GuidedPlan, type GuidedResult } from '../evaluation/guided/plan'
import { isSharedAction } from './engine'

// Guided parameter locks (task 58). In Guided mode only the current step's parameters may be
// edited. The controls show locked parameters read-only; this reducer wrapper is the backstop for
// every other edit path (viewport handles, drag-and-drop): a model edit that would change a
// locked parameter keeps the session and sets an error notice. Shared actions (restore, reset,
// import, tests) are never blocked, and Parametric is never affected. Nothing new is persisted:
// progress is derived from the stored history by the pure guided plan.

/** Session fields the lock reads. */
interface GuardedSession<D> {
  mode: string
  draft: D
  history: ReadonlyArray<GuidedResult<D>>
  ui: { predictionDialogOpen: boolean; notice?: { kind: 'info' | 'error'; message: string } }
}

/** Student-facing reason for a blocked edit. */
export function lockedMessage<D, R>(plan: GuidedPlan<D, R>, history: ReadonlyArray<GuidedResult<D>>, param: string): string {
  const step = currentStep(plan, guidedProgress(plan, history))
  return `${plan.label(param)} is locked in this Guided step.${step ? ` Editable now: ${step.focus}.` : ''}`
}

/** Wraps a model reducer so Guided sessions reject edits to locked parameters. */
export function withGuidedLocks<S extends GuardedSession<D>, A extends { type: string }, Ch, D>(
  plan: GuidedPlan<D, unknown>,
  reduce: (s: S, a: A, ch: Ch) => S,
): (s: S, a: A, ch: Ch) => S {
  return (s, a, ch) => {
    const next = reduce(s, a, ch)
    if (s.mode !== 'guided' || isSharedAction(a) || next.draft === s.draft) return next
    const locked = lockedChange(plan, s.history, s.draft, next.draft)
    if (locked === undefined) return next
    return { ...s, ui: { ...s.ui, notice: { kind: 'error', message: lockedMessage(plan, s.history, locked) } } }
  }
}
