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

/** Student-visible history; archived tests still preserve analysis/prediction provenance. */
export function selectVisibleHistory(s: SessionState): ReadonlyArray<TestResult> {
  return s.history.filter((r) => !s.deletedIterationIds?.includes(r.id))
}

/** Number of available non-baseline tests. */
export function selectTestCount(s: SessionState): number {
  return selectVisibleHistory(s).filter((r) => r.iteration >= 1).length
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
