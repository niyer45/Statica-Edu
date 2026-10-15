import bundledJson from './challenges/cantilever-beam-1.json'
import { loadChallenge } from './loader'
import type { Challenge, Result, SchemaIssue } from './types'

// Bundled challenge content (Req 3.5, 3.6, 3.7).
// The JSON is validated by the same loader as any other challenge input, so a bad edit
// surfaces as schema issues (full-page error, Req 3.3) instead of a crash.

export const CANTILEVER_BEAM_1_ID = 'cantilever-beam-1'

/** Raw bundled JSON, typed `unknown` so nothing bypasses the loader. */
export const cantileverBeam1Json: unknown = bundledJson

/** Loader result for the bundled challenge. Never throws; computed once at import. */
export const bundledChallengeResult: Result<Challenge, SchemaIssue[]> =
  loadChallenge(cantileverBeam1Json)

/** Challenge data safe for student-facing views: `referenceDesign` is structurally absent. */
export type StudentChallenge = Omit<Challenge, 'referenceDesign'>

/**
 * Student view of a challenge without `referenceDesign` (Req 3.7). The key is absent,
 * not `undefined`. The result is a new frozen top-level object; nested values are shared
 * with `ch` (already deep-frozen when `ch` comes from the loader).
 */
export function toStudentChallenge(ch: Challenge): Readonly<StudentChallenge> {
  const { referenceDesign: _omitted, ...student } = ch
  void _omitted
  return Object.freeze(student)
}
