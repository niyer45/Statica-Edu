import type { BracedFrameChallenge } from '../../challenge/bracedFrame/types'
import type { BracedFrameAnalysis } from '../../physics/bracedFrame/types'
import { withinLimit } from '../tolerance'
import type { BracedFrameConstraintId, BracedFrameConstraintResult, BracedFrameConstraintUnit, BracedFrameEfficiency } from './types'

// Braced frame constraint checks (task 49.2; BFR-07, MM-10, MM-11). Pure; never throws for typed
// inputs, including analyses with non-finite numbers (those constraints fail). Comparisons use
// the shared inclusive withinLimit with REL_TOL, so a value equal to its limit passes and
// non-finite values never pass.
//
// Solved frame: stability (passed), roofDrift (|δ_roof|), utilization (max |N|/capacity), mass,
// applicability. Mechanism: stability (failed), mass, applicability (failed). The roofDrift and
// utilization entries are ABSENT for a mechanism: undefined, not failed (MM-10, BFR-07).

/** Fixed reporting order (BFR-07); a mechanism skips roofDrift and utilization. */
export const BRACED_FRAME_CONSTRAINT_ORDER: readonly BracedFrameConstraintId[] = Object.freeze([
  'stability',
  'roofDrift',
  'utilization',
  'mass',
  'applicability',
] as const)

/** Student-facing labels. Contain no digits, so fact texts that quote them stay grounded. */
export const BRACED_FRAME_CONSTRAINT_LABELS: Readonly<Record<BracedFrameConstraintId, string>> = Object.freeze({
  stability: 'Stability',
  roofDrift: 'Roof drift',
  utilization: 'Maximum member utilization',
  mass: 'Mass',
  applicability: 'Model applicability',
})

function numeric(id: BracedFrameConstraintId, value: number, limit: number, unit: BracedFrameConstraintUnit): BracedFrameConstraintResult {
  return {
    id,
    label: BRACED_FRAME_CONSTRAINT_LABELS[id],
    value,
    limit,
    unit,
    passed: withinLimit(value, limit),
    utilization: value / limit,
  }
}

function bool(id: BracedFrameConstraintId, passed: boolean): BracedFrameConstraintResult {
  const value = passed ? 1 : 0
  return { id, label: BRACED_FRAME_CONSTRAINT_LABELS[id], value, limit: 1, unit: 'bool', passed, utilization: value }
}

/**
 * Returns the constraint results in BRACED_FRAME_CONSTRAINT_ORDER: five for a solved frame,
 * three (stability, mass, applicability) for a mechanism. Applicability mirrors `a.applicable`.
 */
export function evaluateBracedFrameConstraints(
  a: BracedFrameAnalysis,
  ch: Pick<BracedFrameChallenge, 'constraints'>,
): BracedFrameConstraintResult[] {
  const k = ch.constraints
  const solved = a.status === 'solved'
  const results: BracedFrameConstraintResult[] = [bool('stability', solved)]
  if (a.status === 'solved') {
    results.push(numeric('roofDrift', Math.abs(a.roofDriftM), k.maxRoofDriftM, 'm'))
    results.push(numeric('utilization', a.maxUtilization, k.maxUtilization, 'ratio'))
  }
  results.push(numeric('mass', a.massKg, k.maxMassKg, 'kg'))
  results.push(bool('applicability', a.applicable === true))
  return results
}

/** Unclamped margins; drift and utilization margins only for a solved frame. */
export function bracedFrameEfficiency(a: BracedFrameAnalysis, ch: Pick<BracedFrameChallenge, 'constraints'>): BracedFrameEfficiency {
  const k = ch.constraints
  const massUsage = a.massKg / k.maxMassKg
  if (a.status !== 'solved') return { massUsage }
  return { massUsage, driftUsage: Math.abs(a.roofDriftM) / k.maxRoofDriftM, maxUtilization: a.maxUtilization }
}
