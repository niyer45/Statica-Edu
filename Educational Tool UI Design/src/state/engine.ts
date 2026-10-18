import { deepFreeze } from '../challenge/deepFreeze'
import type { InteractionMode, ModelRef, Result } from '../challenge/types'
import type { EvaluationStatus, Prediction, PredictionDirection } from '../evaluation/types'
import { BASELINE_LABEL, type DraftStatus, type InitSessionError, type SessionStateOf } from './session'

// Learning-loop engine (task 34.2; multi-model-architecture MM-10, MM-11, MM-13, MM-15).
// The shared session actions (prediction, runTest, delete, restore, compare, reflection,
// submit, import, reset) for any registered model, parameterized by its definition. Moved
// without behavior change from the beam reducer, which is now this engine bound to the beam
// model plus the beam edit actions (state/reducer.ts). Pure: no clock, randomness, DOM or
// storage; time and ids arrive in actions. Model code is reached only through `def`.

/** Minimal design shape: every model's design carries a stable id (restore copies rely on it). */
export interface DesignBase {
  id: string
}

/** A typed, student-facing reason why a design or edit was rejected. */
export interface DesignError {
  code: string
  param?: string
  message: string
}

/** The shared evaluation envelope every model returns (MM-11). */
export interface EvaluationBase {
  status: EvaluationStatus
  accepted: boolean
  failures: readonly string[]
  /** Model-specific margins, stored with a submission. */
  efficiency: unknown
}

/** Challenge fields the engine reads; each model's challenge type extends this. */
export interface ChallengeBase<D> {
  id: string
  version: number
  model?: ModelRef
  allowedModes: readonly InteractionMode[]
  initialDesign: D
  predictionPolicy: { requiredOnIterations: readonly number[] }
}

/** One immutable test record for any model; the beam TestResult is this shape. */
export interface TestResultOf<D, A, E extends EvaluationBase, O> {
  id: string
  /** 0 = baseline. */
  iteration: number
  label?: string
  designSnapshot: Readonly<D>
  analysis: Readonly<A>
  evaluation: Readonly<E>
  accepted: boolean
  failures: E['failures']
  prediction?: Prediction
  predictionOutcome?: O
  timestamp: string
}

/** What the engine needs from a model definition (state/models.ts extends it). */
export interface EngineModel<Ch extends ChallengeBase<D>, D extends DesignBase, A, E extends EvaluationBase, O, Err extends DesignError = DesignError> {
  ref: Readonly<ModelRef>
  validateDesign(d: D, ch: Ch): Err[]
  cloneDesign(d: Readonly<D>): D
  sameDesignIgnoringId(a: Readonly<D>, b: Readonly<D>): boolean
  analyze(d: D, ch: Ch): A
  evaluate(d: D, a: A, ch: Ch): E
  /** True for the model's typed invariant error, which becomes a notice instead of a crash. */
  isInvariantError(e: unknown): e is Error
  scorePrediction(p: Prediction, prev: TestResultOf<D, A, E, O>, next: A): O
  importDesign(json: unknown, ch: Ch): Result<D, string[]>
}

/** Shared actions, identical for every model (MM-15). */
export type SharedAction =
  /** Prediction time is injected just like runTest time (D-27). */
  | { type: 'setPrediction'; direction: PredictionDirection; explanation?: string; now: string }
  /** Closes the dialog and stores nothing (Req 14.5). */
  | { type: 'cancelPrediction' }
  /** Time and id are injected for determinism. */
  | { type: 'runTest'; now: string; id: string }
  | { type: 'deleteIteration'; testResultId: string }
  | { type: 'restore'; testResultId: string }
  | { type: 'toggleCompare'; testResultId: string }
  | { type: 'setReflection'; text: string }
  | { type: 'submit'; testResultId: string; now: string }
  | { type: 'importDesign'; json: unknown }
  | { type: 'reset' }
  /**
   * Task 60 (owner amendment): Reset to baseline. The session starts over exactly as if the
   * challenge were first opened in the same mode: baseline draft, history with only a new
   * Baseline record, no archived/deleted entries, comparison, pending prediction, reflection or
   * submission. Time and the new Baseline id are injected like runTest. A no-op on a fresh session.
   */
  | { type: 'resetDraft'; now: string; id: string }

const SHARED_TYPES: ReadonlySet<string> = new Set(['setPrediction', 'cancelPrediction', 'runTest', 'deleteIteration', 'restore', 'toggleCompare', 'setReflection', 'submit', 'importDesign', 'reset', 'resetDraft'])

/** True for an action the engine handles for every model (not a model edit). */
export function isSharedAction(a: { type: string }): boolean {
  return SHARED_TYPES.has(a.type)
}

/** Session type for a model's design, analysis, evaluation, outcome and error types. */
export type AnySession<D, A, E extends EvaluationBase, O, Err> = SessionStateOf<D, TestResultOf<D, A, E, O>, Err, E['efficiency']>

/**
 * Task 60: true when a session equals a fresh start (as built by initSessionWith) apart from ids
 * and timestamps: baseline draft, only the Baseline in history, nothing archived, compared,
 * pending, reflected or submitted. Reset to baseline is unavailable and a no-op then.
 */
export function isFreshSessionWith<D>(
  same: (a: Readonly<D>, b: Readonly<D>) => boolean,
  s: {
    draft: Readonly<D>
    history: ReadonlyArray<unknown>
    deletedIterationIds?: readonly string[]
    compareSelection: readonly string[]
    pendingPrediction?: unknown
    reflectionAnswer: string
    submission?: unknown
  },
  ch: { initialDesign: Readonly<D> },
): boolean {
  return same(s.draft, ch.initialDesign) && s.history.length === 1 && (s.deletedIterationIds?.length ?? 0) === 0 &&
    s.compareSelection.length === 0 && s.pendingPrediction === undefined && s.reflectionAnswer === '' && s.submission === undefined
}

/** Draft status against the latest Test_Result, ignoring the design id (Req 16.1). */
export function draftStatusWith<D>(same: (a: Readonly<D>, b: Readonly<D>) => boolean, draft: Readonly<D>, history: ReadonlyArray<{ designSnapshot: Readonly<D> }>): DraftStatus {
  const latest = history[history.length - 1]
  return latest !== undefined && same(draft, latest.designSnapshot) ? 'tested' : 'draft'
}

/** Keeps draft and draftStatus; records why the edit was rejected. */
export function rejectEdit<S extends { draftErrors: unknown[] }>(s: S, errors: S['draftErrors']): S {
  return { ...s, draftErrors: errors }
}

/** Accepts a candidate draft only if it validates (Req 15.9, 16.9). */
export function acceptDraft<Ch extends ChallengeBase<D>, D extends DesignBase, A, E extends EvaluationBase, O, Err extends DesignError>(
  def: EngineModel<Ch, D, A, E, O, Err>,
  s: AnySession<D, A, E, O, Err>,
  candidate: D,
  ch: Ch,
): AnySession<D, A, E, O, Err> {
  const errors = def.validateDesign(candidate, ch)
  if (errors.length > 0) return rejectEdit(s, errors)
  return { ...s, draft: candidate, draftErrors: [], draftStatus: draftStatusWith(def.sameDesignIgnoringId, candidate, s.history) }
}

/**
 * Builds a new session: analyzes and evaluates the initial design and stores it as the
 * Baseline (iteration 0). Fails without a session if the initial design is invalid or analysis
 * throws (Req 15.1–15.3). Never throws for those cases.
 */
export function initSessionWith<Ch extends ChallengeBase<D>, D extends DesignBase, A, E extends EvaluationBase, O, Err extends DesignError>(
  def: EngineModel<Ch, D, A, E, O, Err>,
  ch: Ch,
  now: string,
  id: string,
  mode: InteractionMode = ch.allowedModes[0] ?? 'guided',
): Result<AnySession<D, A, E, O, Err>, InitSessionError> {
  const errors = def.validateDesign(ch.initialDesign, ch)
  if (errors.length > 0) {
    return {
      ok: false,
      error: {
        source: 'initialDesign',
        message: `The challenge initial design is invalid (${errors.length} problem${errors.length === 1 ? '' : 's'}).`,
        details: errors.map((e) => e.message),
      },
    }
  }
  const snapshot = deepFreeze(def.cloneDesign(ch.initialDesign))
  let baseline: TestResultOf<D, A, E, O>
  try {
    const analysis = def.analyze(snapshot, ch)
    const evaluation = def.evaluate(snapshot, analysis, ch)
    baseline = deepFreeze({ id, iteration: 0, label: BASELINE_LABEL, designSnapshot: snapshot, analysis, evaluation, accepted: evaluation.accepted, failures: [...evaluation.failures] as E['failures'], timestamp: now })
  } catch (e) {
    return { ok: false, error: { source: 'initialDesign', message: 'The challenge initial design could not be analyzed.', details: [e instanceof Error ? e.message : String(e)] } }
  }
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      challengeId: ch.id,
      challengeVersion: ch.version,
      mode,
      draft: def.cloneDesign(snapshot),
      draftStatus: 'tested',
      draftErrors: [],
      history: Object.freeze([baseline]),
      compareSelection: [],
      reflectionAnswer: '',
      ui: { predictionDialogOpen: false },
    },
  }
}

/**
 * Session reducer for one model. Shared actions are handled here; any other action goes to
 * `reduceEdit` (the model's edit actions), and an unknown action leaves the state unchanged.
 * Never mutates `s` or `ch`; history entries are carried over by reference (append-only).
 */
export function makeSessionReducer<Ch extends ChallengeBase<D>, D extends DesignBase, A, E extends EvaluationBase, O, Err extends DesignError, Edit extends { type: string }>(
  def: EngineModel<Ch, D, A, E, O, Err>,
  reduceEdit: (s: AnySession<D, A, E, O, Err>, a: Edit, ch: Ch) => AnySession<D, A, E, O, Err>,
): (s: AnySession<D, A, E, O, Err>, a: SharedAction | Edit, ch: Ch) => AnySession<D, A, E, O, Err> {
  type S = AnySession<D, A, E, O, Err>
  type R = TestResultOf<D, A, E, O>
  const statusOf = (draft: Readonly<D>, history: ReadonlyArray<R>) => draftStatusWith(def.sameDesignIgnoringId, draft, history)

  /** Store a validated checkpoint response; the UI dispatches runTest after confirmation. */
  function setPrediction(s: S, a: Extract<SharedAction, { type: 'setPrediction' }>): S {
    const validDirection = a.direction === 'increase' || a.direction === 'decrease' || a.direction === 'same'
    const validExplanation = a.explanation === undefined || (typeof a.explanation === 'string' && a.explanation.length <= 500)
    if (!validDirection || !validExplanation) {
      return {
        ...s,
        pendingPrediction: undefined,
        ui: {
          ...s.ui,
          predictionDialogOpen: true,
          notice: {
            kind: 'error',
            message: !validDirection ? 'Select a prediction direction: increase, decrease, or same.' : 'Prediction explanation must contain at most 500 characters.',
          },
        },
      }
    }
    const previous = s.history[s.history.length - 1]!
    return {
      ...s,
      pendingPrediction: deepFreeze({
        iteration: previous.iteration + 1,
        direction: a.direction,
        ...(a.explanation !== undefined ? { explanation: a.explanation } : {}),
        createdAt: a.now,
      }),
      ui: { ...s.ui, notice: undefined },
    }
  }

  /** Validate first (Req 17.2 takes precedence over the design pseudocode's gating order). */
  function runTest(s: S, a: Extract<SharedAction, { type: 'runTest' }>, ch: Ch): S {
    const errors = def.validateDesign(s.draft, ch)
    if (errors.length > 0) {
      return { ...s, draftErrors: errors, ui: { ...s.ui, predictionDialogOpen: false } }
    }
    const previous = s.history[s.history.length - 1]!
    const iteration = previous.iteration + 1
    const prediction = s.pendingPrediction?.iteration === iteration ? s.pendingPrediction : undefined
    if (ch.predictionPolicy.requiredOnIterations.includes(iteration) && prediction === undefined) {
      return { ...s, draftErrors: [], pendingPrediction: undefined, ui: { ...s.ui, predictionDialogOpen: true, notice: undefined } }
    }
    try {
      const snapshot = deepFreeze(def.cloneDesign(s.draft))
      const analysis = def.analyze(snapshot, ch)
      const evaluation = def.evaluate(snapshot, analysis, ch)
      const result: R = deepFreeze({
        id: a.id,
        iteration,
        designSnapshot: snapshot,
        analysis,
        evaluation,
        accepted: evaluation.accepted,
        failures: [...evaluation.failures] as E['failures'],
        ...(prediction !== undefined ? {
          prediction: { ...prediction },
          predictionOutcome: def.scorePrediction(prediction, previous, analysis),
        } : {}),
        timestamp: a.now,
      })
      const history = Object.freeze([...s.history, result])
      const selected = new Set([...s.compareSelection, result.id])
      const compareSelection = history.filter((r) => r.iteration > 0 && selected.has(r.id)).slice(-3).map((r) => r.id)
      return {
        ...s,
        history,
        draftStatus: 'tested',
        draftErrors: [],
        pendingPrediction: undefined,
        compareSelection,
        ui: { ...s.ui, predictionDialogOpen: false, notice: undefined },
      }
    } catch (error) {
      if (!def.isInvariantError(error)) throw error
      return {
        ...s,
        draftErrors: [],
        ui: { ...s.ui, predictionDialogOpen: false, notice: { kind: 'error', message: error.message } },
      }
    }
  }

  /** Deterministic fresh draft identity without clock/randomness or an Action API extension. */
  function copyForRestore(snapshot: Readonly<D>, s: S): D {
    const used = new Set([s.draft.id, ...s.history.flatMap((r) => [r.id, r.designSnapshot.id])])
    let suffix = 1
    let id = `${snapshot.id}:restored:${suffix}`
    while (used.has(id)) id = `${snapshot.id}:restored:${++suffix}`
    return { ...def.cloneDesign(snapshot), id }
  }

  return (s, a, ch) => {
    if (!SHARED_TYPES.has(a.type)) return reduceEdit(s, a as Edit, ch)
    const action = a as SharedAction
    switch (action.type) {
      case 'setPrediction':
        return setPrediction(s, action)
      case 'cancelPrediction':
        return { ...s, pendingPrediction: undefined, ui: { ...s.ui, predictionDialogOpen: false, notice: undefined } }
      case 'runTest':
        return runTest(s, action, ch)
      case 'deleteIteration': {
        const result = s.history.find((r) => r.id === action.testResultId && !s.deletedIterationIds?.includes(r.id))
        if (!result || result.iteration === 0 || s.deletedIterationIds?.includes(result.id)) return s
        return {
          ...s,
          deletedIterationIds: [...(s.deletedIterationIds ?? []), result.id],
          compareSelection: s.compareSelection.filter((id) => id !== result.id),
          submission: s.submission?.testResultId === result.id ? undefined : s.submission,
          ui: { ...s.ui, notice: { kind: 'info', message: `Iteration ${result.iteration} deleted from history.${s.submission?.testResultId === result.id ? ' Its submission was removed.' : ''}` } },
        }
      }
      case 'restore': {
        const result = s.history.find((r) => r.id === action.testResultId && !s.deletedIterationIds?.includes(r.id))
        if (result === undefined) return s
        const draft = copyForRestore(result.designSnapshot, s)
        return { ...s, draft, draftStatus: statusOf(draft, s.history), draftErrors: [], pendingPrediction: undefined, ui: { predictionDialogOpen: false } }
      }
      case 'toggleCompare': {
        const result = s.history.find((r) => r.id === action.testResultId && !s.deletedIterationIds?.includes(r.id))
        if (result === undefined || result.iteration === 0) return s
        if (s.compareSelection.includes(result.id)) {
          return { ...s, compareSelection: s.compareSelection.filter((id) => id !== result.id), ui: { ...s.ui, notice: undefined } }
        }
        if (s.compareSelection.length >= 3) {
          return { ...s, ui: { ...s.ui, notice: { kind: 'info', message: 'At most three iterations can be compared alongside the Baseline.' } } }
        }
        const selected = new Set([...s.compareSelection, result.id])
        return { ...s, compareSelection: s.history.filter((r) => r.iteration > 0 && selected.has(r.id)).map((r) => r.id), ui: { ...s.ui, notice: undefined } }
      }
      case 'setReflection':
        // Reject hostile/oversized payloads; valid text is stored verbatim, without grading.
        return typeof action.text === 'string' && action.text.length <= 2000 ? { ...s, reflectionAnswer: action.text } : s
      case 'submit': {
        const result = s.history.find((r) => r.id === action.testResultId && !s.deletedIterationIds?.includes(r.id))
        if (result === undefined || result.iteration < 1 || s.reflectionAnswer.trim() === '') return s
        const efficiency = result.evaluation.efficiency
        return { ...s, submission: deepFreeze({ testResultId: result.id, status: result.evaluation.status, reflection: s.reflectionAnswer, efficiency: (typeof efficiency === 'object' && efficiency !== null ? { ...efficiency } : efficiency) as E['efficiency'], submittedAt: action.now }) }
      }
      case 'importDesign': {
        const imported = def.importDesign(action.json, ch)
        // The UI obtains reasons from the same pure helper; Req 23.6 forbids changing even UI state here.
        if (!imported.ok) return s
        return { ...s, draft: imported.value, draftStatus: statusOf(imported.value, s.history), draftErrors: [], pendingPrediction: undefined, ui: { predictionDialogOpen: false } }
      }
      case 'resetDraft': {
        // Reuses the fresh-session constructor so a reset session is indistinguishable from a
        // first opening in the same mode (Guided progress, derived from history, returns to step 1).
        if (isFreshSessionWith(def.sameDesignIgnoringId, s, ch)) return s
        const fresh = initSessionWith(def, ch, action.now, action.id, s.mode)
        return fresh.ok ? fresh.value : s
      }
      case 'reset': {
        // History is append-only even on reset (Req 18.1); no baseline is regenerated.
        const draft = copyForRestore(s.history[0]!.designSnapshot, s)
        return { ...s, draft, draftStatus: statusOf(draft, s.history), draftErrors: [], pendingPrediction: undefined, compareSelection: [], reflectionAnswer: '', submission: undefined, ui: { predictionDialogOpen: false } }
      }
    }
  }
}
