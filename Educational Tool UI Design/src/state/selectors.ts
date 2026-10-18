import type { Challenge } from '../challenge/types'
import { toStudentChallenge, type StudentChallenge } from '../challenge/content'
import type { TestResult } from '../evaluation/types'
import { orientedEnvelope } from '../geometry/envelope'
import type { SessionState } from './session'

// Read-only views of the session for the UI (design: "UI components dispatch actions and
// render selectors"). Pure; no computation of physics or pass/fail here, only lookups of
// stored Test_Results and geometry helpers from geometry/.

/** The Baseline (history[0]); always present (Req 15.4). */
export function selectBaseline(s: SessionState): TestResult {
  return s.history[0] as TestResult
}

/** The latest Test_Result, whose numbers are shown while the draft is untested (Req 16.5). */
export function selectLatestResult(s: SessionState): TestResult {
  return s.history[s.history.length - 1] as TestResult
}

export function selectResultById(s: SessionState, id: string): TestResult | undefined {
  return s.history.find((r) => r.id === id)
}

/** Badge text: "Draft" or "Tested #n" with n the latest iteration (Req 16.3, 16.4, 16.7). */
export function selectStatusBadge(s: SessionState): string {
  return s.draftStatus === 'draft' ? 'Draft' : `Tested #${selectLatestResult(s).iteration}`
}

/** The model-independent history fields these selectors read (any model's session fits). */
interface HistoryView<R extends { id: string; iteration: number }> {
  history: ReadonlyArray<R>
  deletedIterationIds?: string[]
}

/** Student-visible history; archived tests still preserve analysis/prediction provenance. */
export function selectVisibleHistory<R extends { id: string; iteration: number } = TestResult>(s: HistoryView<R>): ReadonlyArray<R> {
  return s.history.filter((r) => !s.deletedIterationIds?.includes(r.id))
}

/** Number of available non-baseline tests. */
export function selectTestCount(s: HistoryView<{ id: string; iteration: number }>): number {
  return selectVisibleHistory(s).filter((r) => r.iteration >= 1).length
}

/** True when stored work exists beyond the untouched Baseline (shell resume / My designs). */
export function selectWorkspaceStarted(s: HistoryView<{ id: string; iteration: number }> & Pick<SessionState, 'draftStatus' | 'reflectionAnswer'> & { submission?: unknown }): boolean {
  return selectTestCount(s) > 0 || s.draftStatus === 'draft' || (s.deletedIterationIds?.length ?? 0) > 0 || s.reflectionAnswer.length > 0 || s.submission !== undefined
}

/** Challenge progress shown on the homepage (task 38). */
export type ProgressStatus = 'notStarted' | 'inProgress' | 'completed'
export interface ChallengeProgress {
  status: ProgressStatus
  /** Visible non-baseline tests. */
  testsRun: number
  /** Status of the recorded submission, if any (a Not accepted submission is not completion). */
  submission?: string
}

/**
 * Not started / in progress / completed from stored session data only. Completed means a recorded
 * submission whose result was Accepted (submissions are always a tested non-Baseline result with a
 * nonblank reflection); an unsuccessful submission stays in progress (MILESTONE4 account inputs).
 */
export function selectProgress(s: Parameters<typeof selectWorkspaceStarted>[0]): ChallengeProgress {
  const testsRun = selectTestCount(s)
  const recorded = s.submission as { status?: unknown } | undefined
  const submission = typeof recorded?.status === 'string' ? recorded.status : undefined
  const status: ProgressStatus = submission === 'accepted' ? 'completed' : selectWorkspaceStarted(s) ? 'inProgress' : 'notStarted'
  return submission === undefined ? { status, testsRun } : { status, testsRun, submission }
}

/** Iteration number the next Run Test would produce. */
export function selectNextIteration(s: SessionState): number {
  return selectLatestResult(s).iteration + 1
}

/** True if the next Run Test requires a prediction (predictionPolicy). */
export function selectPredictionRequired(s: SessionState, ch: Challenge): boolean {
  return ch.predictionPolicy.requiredOnIterations.includes(selectNextIteration(s))
}

/** Live envelope of the draft (geometry only, previewed before Run Test; D-02). */
export function selectDraftEnvelope(s: SessionState): { widthZM: number; heightYM: number } {
  return orientedEnvelope(s.draft.section, s.draft.orientationDeg)
}

/** Challenge data without referenceDesign, for every student-facing view (Req 3.7). */
export function selectStudentChallenge(ch: Challenge): Readonly<StudentChallenge> {
  return toStudentChallenge(ch)
}
