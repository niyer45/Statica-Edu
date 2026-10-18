// Guided structured experiments (task 58). Pure and model-independent: no React, state, units or
// physics formulas. A plan is data per model: which design parameters exist, which stored result
// metrics a step reports, and an ordered list of steps. Each step unlocks a set of parameters and
// declares an objective that is evaluated only from stored test results (design snapshots and
// stored analysis values), so progress is a deterministic function of the append-only history.
// Nothing is persisted for progress; a saved session restores the same step on reload.

/** A comparable design parameter value. */
export type GuidedParamValue = number | string | boolean

/** Required direction of a parameter change between two tested designs. */
export type GuidedDirection = 'increase' | 'decrease' | 'any'

/**
 * Step objective, met by one tested design compared with an earlier tested design:
 * - `change`: the two designs differ only in parameters matching `params` (at least one), every
 *   changed numeric parameter moved in `direction`, and with `single` exactly one parameter changed.
 * - `accepted`: the tested design passes every check.
 */
export type GuidedObjective =
  | { kind: 'change'; params: readonly string[]; direction: GuidedDirection; single?: boolean }
  | { kind: 'accepted' }

export interface GuidedStep {
  id: string
  title: string
  /** The concrete objective, in one or two sentences. */
  instruction: string
  hint: string
  /** What may be edited in this step, in words (e.g. "Depth (diameter or height)"). */
  focus: string
  /** Parameter id patterns editable in this step (`*` matches any run of characters), or 'all'. */
  unlocks: readonly string[] | 'all'
  objective: GuidedObjective
  /** Stored metrics whose change is reported once the step is met. */
  observe?: readonly string[]
}

export interface GuidedMetric<R> {
  label: string
  /** Reads a stored value; undefined when the stored result has none (e.g. a mechanism). */
  read(result: Readonly<R>): number | undefined
}

export interface GuidedPlan<D = unknown, R = unknown> {
  /** Editable design parameters by id. Fixed challenge values are not parameters. */
  params(design: Readonly<D>): Readonly<Record<string, GuidedParamValue>>
  /**
   * Parameters that redefine the others (a section kind). When one changes, only these count
   * as changed; the remaining parameters of different shapes are not comparable.
   */
  structural?: readonly string[]
  /** Student-facing name of a parameter id. */
  label(id: string): string
  metrics: Readonly<Record<string, GuidedMetric<R>>>
  steps: readonly GuidedStep[]
}

/** The stored test-result fields guided progress reads. */
export interface GuidedResult<D = unknown> {
  id: string
  iteration: number
  designSnapshot: Readonly<D>
  accepted: boolean
}

export interface GuidedCompletion {
  stepId: string
  /** The tested result that met the objective and the earlier result it was compared with. */
  resultId: string
  comparedWithId?: string
}

export interface GuidedProgress {
  /** Index of the current step; equals the step count once every step is complete. */
  current: number
  completions: readonly GuidedCompletion[]
  complete: boolean
}

function patternMatches(pattern: string, id: string): boolean {
  if (!pattern.includes('*')) return pattern === id
  const escaped = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${escaped.join('.*')}$`).test(id)
}

function matchesAny(patterns: readonly string[], id: string): boolean {
  return patterns.some((p) => patternMatches(p, id))
}

/**
 * Parameter ids that differ between two designs. A parameter present in only one design is not
 * comparable and is ignored; if a structural parameter changed, only structural ones are listed.
 */
export function changedParams<D>(plan: GuidedPlan<D, unknown>, before: Readonly<D>, after: Readonly<D>): string[] {
  const a = plan.params(before)
  const b = plan.params(after)
  const changed = Object.keys(b).filter((k) => Object.prototype.hasOwnProperty.call(a, k) && !Object.is(a[k], b[k]))
  const structural = changed.filter((k) => plan.structural?.includes(k))
  return structural.length > 0 ? structural : changed
}

function changeMeets<D>(plan: GuidedPlan<D, unknown>, objective: Extract<GuidedObjective, { kind: 'change' }>, before: Readonly<D>, after: Readonly<D>): boolean {
  const changed = changedParams(plan, before, after)
  if (changed.length === 0 || (objective.single === true && changed.length !== 1)) return false
  if (!changed.every((id) => matchesAny(objective.params, id))) return false
  if (objective.direction === 'any') return true
  const a = plan.params(before)
  const b = plan.params(after)
  return changed.every((id) => {
    const from = a[id]
    const to = b[id]
    if (typeof from !== 'number' || typeof to !== 'number') return false
    return objective.direction === 'increase' ? to > from : to < from
  })
}

/** The earliest-found (nearest) earlier result that `history[i]` meets the step objective against. */
function objectiveMetAt<D>(plan: GuidedPlan<D, unknown>, step: GuidedStep, history: ReadonlyArray<GuidedResult<D>>, i: number): GuidedCompletion | undefined {
  const result = history[i]!
  if (step.objective.kind === 'accepted') return result.accepted ? { stepId: step.id, resultId: result.id } : undefined
  for (let j = i - 1; j >= 0; j--) {
    if (changeMeets(plan, step.objective, history[j]!.designSnapshot, result.designSnapshot)) {
      return { stepId: step.id, resultId: result.id, comparedWithId: history[j]!.id }
    }
  }
  return undefined
}

/**
 * Step progress from the stored history (index 0 is the Baseline). Results are read in order; a
 * step is met by a result recorded after the previous step was met, compared with any earlier
 * result. One result meets at most one step. Deleted (archived) entries still count: they were
 * tested, and deleting a record never undoes a completed experiment.
 */
export function guidedProgress<D>(plan: GuidedPlan<D, unknown>, history: ReadonlyArray<GuidedResult<D>>): GuidedProgress {
  const completions: GuidedCompletion[] = []
  let current = 0
  for (let i = 1; i < history.length && current < plan.steps.length; i++) {
    const met = objectiveMetAt(plan, plan.steps[current]!, history, i)
    if (met !== undefined) {
      completions.push(met)
      current++
    }
  }
  return { current, completions, complete: current >= plan.steps.length }
}

/** The current step, or undefined once every step is complete. */
export function currentStep<D, R>(plan: GuidedPlan<D, R>, progress: GuidedProgress): GuidedStep | undefined {
  return plan.steps[progress.current]
}

/** Whether a parameter may be edited at this progress: everything is open once all steps are met. */
export function isEditable<D, R>(plan: GuidedPlan<D, R>, progress: GuidedProgress, id: string): boolean {
  const step = plan.steps[progress.current]
  if (step === undefined || step.unlocks === 'all') return true
  return matchesAny(step.unlocks, id)
}

/**
 * The first parameter an edit from `before` to `after` changes that is locked at the progress
 * derived from `history`, or undefined when the edit is allowed.
 */
export function lockedChange<D>(plan: GuidedPlan<D, unknown>, history: ReadonlyArray<GuidedResult<D>>, before: Readonly<D>, after: Readonly<D>): string | undefined {
  const progress = guidedProgress(plan, history)
  const a = plan.params(before)
  const b = plan.params(after)
  // Every differing parameter counts here (not only comparable ones), so a structural change
  // cannot smuggle in locked parameters; a structural change itself needs its own unlock.
  const structural = Object.keys({ ...a, ...b }).filter((k) => plan.structural?.includes(k) && !Object.is(a[k], b[k]))
  const changed = structural.length > 0 ? structural : Object.keys({ ...a, ...b }).filter((k) => !Object.is(a[k], b[k]))
  return changed.find((id) => !isEditable(plan, progress, id))
}

export type GuidedChange = 'increased' | 'decreased' | 'unchanged' | 'unavailable'

export interface GuidedObservation {
  label: string
  change: GuidedChange
}

/**
 * How the observed stored metrics changed between the compared results of a completion. Only
 * stored values are compared; nothing is recomputed.
 */
export function observations<D, R extends GuidedResult<D>>(plan: GuidedPlan<D, R>, completion: GuidedCompletion, history: ReadonlyArray<R>): GuidedObservation[] {
  const step = plan.steps.find((s) => s.id === completion.stepId)
  const after = history.find((r) => r.id === completion.resultId)
  const before = completion.comparedWithId === undefined ? undefined : history.find((r) => r.id === completion.comparedWithId)
  if (step?.observe === undefined || after === undefined || before === undefined) return []
  return step.observe.flatMap((id) => {
    const metric = plan.metrics[id]
    if (metric === undefined) return []
    const from = metric.read(before)
    const to = metric.read(after)
    const change: GuidedChange = from === undefined || to === undefined ? 'unavailable' : to > from ? 'increased' : to < from ? 'decreased' : 'unchanged'
    return [{ label: metric.label, change }]
  })
}
