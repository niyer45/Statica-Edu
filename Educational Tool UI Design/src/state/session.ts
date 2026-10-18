import { deepFreeze } from '../challenge/deepFreeze'
import type { Challenge, InteractionMode, Result, SectionKind } from '../challenge/types'
import { evaluate } from '../evaluation/evaluate'
import type {
  Evaluation,
  EvaluationStatus,
  Prediction,
  PredictionDirection,
  PredictionOutcome,
  TestResult,
} from '../evaluation/types'
import type { BeamDesign, GeometryError, Orientation, Section } from '../geometry/sections'
import { validateDesign } from '../geometry/validate'
import { analyze, PhysicsInvariantError } from '../physics/analyze'

// Session model (design "Component: state/"; Req 15.1–15.3, 15.7, 16.1, 16.7).
// Pure: no clock, randomness, DOM, or storage. Timestamps and ids come from the caller.
//
// Domain types TestResult / Prediction / PredictionOutcome live in evaluation/types.ts so that
// evaluation/ never imports state/; they are re-exported here for UI code.

export type { Prediction, PredictionDirection, PredictionOutcome, TestResult }

/** 'tested' iff the draft deep-equals the latest snapshot, ignoring the design id (Req 16.1). */
export type DraftStatus = 'draft' | 'tested'

/** A submitted design: its stored status and model-specific margins (`efficiency`). */
export interface SubmissionOf<Eff> {
  testResultId: string
  status: EvaluationStatus
  reflection: string
  efficiency: Eff
  submittedAt: string
}

export type Submission = SubmissionOf<Evaluation['efficiency']>

/** Transient student-facing message (toast + live region). Set by task 19 actions. */
export interface Notice {
  kind: 'info' | 'error'
  message: string
}

/**
 * Learning-loop session for any model (task 34.2; MM-15): D design, R test result, Err draft
 * error, Eff submission margins. The beam `SessionState` below is this shape with beam types,
 * so the persisted v1 beam session is unchanged (MM-17).
 */
export interface SessionStateOf<D, R, Err, Eff> {
  schemaVersion: 1
  challengeId: string
  challengeVersion: number
  mode: InteractionMode
  draft: D
  draftStatus: DraftStatus
  draftErrors: Err[]
  /** Append-only; index 0 is always the Baseline. */
  history: ReadonlyArray<R>
  /** Deleted history entries remain archived so recorded predictions and numbering stay immutable. */
  deletedIterationIds?: string[]
  pendingPrediction?: Prediction
  /** TestResult ids; the baseline is always available. */
  compareSelection: string[]
  reflectionAnswer: string
  submission?: SubmissionOf<Eff>
  ui: { predictionDialogOpen: boolean; notice?: Notice }
}

export type SessionState = SessionStateOf<BeamDesign, TestResult, GeometryError, Evaluation['efficiency']>

export type Action =
  | { type: 'applySection'; kind: SectionKind }
  | { type: 'setParam'; param: string; valueM: number; mode: 'clamp' | 'strict' }
  | { type: 'setOrientation'; orientationDeg: Orientation }
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
  /** Task 60: draft back to the challenge baseline; history and submission kept (engine.ts). */
  | { type: 'resetDraft' }

export const BASELINE_LABEL = 'Baseline'

/** Why `initSession` could not build a session (Req 15.3). */
export interface InitSessionError {
  /** Always the challenge initial design. */
  source: 'initialDesign'
  message: string
  /** Validator messages, or the physics invariant message. */
  details: string[]
}

/** Fresh, unfrozen copy of a design (sections are flat records of numbers). */
export function cloneDesign(d: Readonly<BeamDesign>): BeamDesign {
  return {
    id: d.id,
    section: { ...d.section } as Section,
    orientationDeg: d.orientationDeg,
    lengthM: d.lengthM,
    materialId: d.materialId,
  }
}

function sameSection(a: Readonly<Section>, b: Readonly<Section>): boolean {
  if (a.kind !== b.kind) return false
  const ra = a as unknown as Record<string, unknown>
  const rb = b as unknown as Record<string, unknown>
  const ka = Object.keys(ra)
  if (ka.length !== Object.keys(rb).length) return false
  return ka.every((k) => Object.prototype.hasOwnProperty.call(rb, k) && Object.is(ra[k], rb[k]))
}

/** Deep equality of two designs, ignoring only `id` (Req 16.1). */
export function sameDesignIgnoringId(a: Readonly<BeamDesign>, b: Readonly<BeamDesign>): boolean {
  return (
    a.orientationDeg === b.orientationDeg &&
    a.lengthM === b.lengthM &&
    a.materialId === b.materialId &&
    sameSection(a.section, b.section)
  )
}

/** Draft status against the latest Test_Result (Req 16.1). */
export function draftStatusOf(draft: Readonly<BeamDesign>, history: ReadonlyArray<TestResult>): DraftStatus {
  const latest = history[history.length - 1]
  return latest !== undefined && sameDesignIgnoringId(draft, latest.designSnapshot) ? 'tested' : 'draft'
}

/**
 * Builds a new session: analyzes and evaluates the challenge initial design and stores it as
 * the Baseline (iteration 0, label "Baseline", the supplied timestamp and id, no prediction).
 * The draft is a copy of the baseline snapshot, status 'tested'. Fails without a session if the
 * initial design is invalid or analysis throws (Req 15.1–15.3). Never throws for those cases.
 * `mode` defaults to the challenge's first allowed mode.
 */
export function initSession(
  ch: Challenge,
  now: string,
  id: string,
  mode: InteractionMode = ch.allowedModes[0] ?? 'guided',
): Result<SessionState, InitSessionError> {
  const errors = validateDesign(ch.initialDesign, ch)
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

  const snapshot = deepFreeze(cloneDesign(ch.initialDesign))
  let baseline: TestResult
  try {
    const analysis = analyze(snapshot, ch)
    const evaluation = evaluate(snapshot, analysis, ch)
    baseline = deepFreeze({
      id,
      iteration: 0,
      label: BASELINE_LABEL,
      designSnapshot: snapshot,
      analysis,
      evaluation,
      accepted: evaluation.accepted,
      failures: [...evaluation.failures],
      timestamp: now,
    })
  } catch (e) {
    // PhysicsInvariantError is the expected case (Req 15.3); any other throw is reported the
    // same way so a bad challenge never crashes the app.
    const detail = e instanceof PhysicsInvariantError ? e.message : e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      error: {
        source: 'initialDesign',
        message: 'The challenge initial design could not be analyzed.',
        details: [detail],
      },
    }
  }

  const history = Object.freeze([baseline])
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      challengeId: ch.id,
      challengeVersion: ch.version,
      mode,
      draft: cloneDesign(snapshot),
      draftStatus: 'tested',
      draftErrors: [],
      history,
      // The Baseline is always comparable and never counted toward the three (Req 18.7).
      compareSelection: [],
      reflectionAnswer: '',
      ui: { predictionDialogOpen: false },
    },
  }
}
