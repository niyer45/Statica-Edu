import type { ColumnChallenge } from '../../challenge/column/types'
import type { ColumnAnalysis } from '../../physics/column/types'
import { withinLimit } from '../tolerance'
import type { ColumnConstraintId, ColumnConstraintResult, ColumnConstraintUnit, ColumnEfficiency } from './types'

// Column constraint checks (task 68; CBK-07, MM-11). Pure; never throws for typed inputs, including
// analyses with non-finite numbers (those constraints fail, all 4 are still returned). Comparisons
// use the shared inclusive withinLimit with REL_TOL, so a value equal to its limit passes and
// non-finite values never pass. The buckling check is a minimum: the critical load must reach the
// required safety factor times the load.

/** Fixed reporting order. */
export const COLUMN_CONSTRAINT_ORDER: readonly ColumnConstraintId[] = Object.freeze(['buckling', 'axialStress', 'mass', 'applicability'] as const)

/** Student-facing labels. Contain no digits, so fact texts that quote them stay grounded. */
export const COLUMN_CONSTRAINT_LABELS: Readonly<Record<ColumnConstraintId, string>> = Object.freeze({
  buckling: 'Critical buckling load',
  axialStress: 'Axial stress',
  mass: 'Mass',
  applicability: 'Model applicability',
})

function atMost(id: ColumnConstraintId, value: number, limit: number, unit: ColumnConstraintUnit): ColumnConstraintResult {
  return { id, label: COLUMN_CONSTRAINT_LABELS[id], value, limit, unit, sense: 'max', passed: withinLimit(value, limit), utilization: value / limit }
}

function atLeast(id: ColumnConstraintId, value: number, limit: number, unit: ColumnConstraintUnit): ColumnConstraintResult {
  // Non-finite values never pass: withinLimit rejects a non-finite `value` in either argument.
  const passed = Number.isFinite(value) && withinLimit(limit, value)
  return { id, label: COLUMN_CONSTRAINT_LABELS[id], value, limit, unit, sense: 'min', passed, utilization: limit / value }
}

/** The load the critical load must reach: the required safety factor times the applied load, N. */
export function requiredCriticalLoadN(ch: Pick<ColumnChallenge, 'constraints' | 'load'>): number {
  return ch.constraints.minBucklingSafetyFactor * ch.load.forceN
}

/** Returns exactly 4 constraint results in COLUMN_CONSTRAINT_ORDER; applicability mirrors `a.applicable`. */
export function evaluateColumnConstraints(a: ColumnAnalysis, ch: Pick<ColumnChallenge, 'constraints' | 'load'>): ColumnConstraintResult[] {
  const k = ch.constraints
  const applicable = a.applicable === true
  return [
    atLeast('buckling', a.criticalLoadN, requiredCriticalLoadN(ch), 'N'),
    atMost('axialStress', a.axialStressPa, k.maxAxialStressPa, 'Pa'),
    atMost('mass', a.massKg, k.maxMassKg, 'kg'),
    {
      id: 'applicability',
      label: COLUMN_CONSTRAINT_LABELS.applicability,
      value: applicable ? 1 : 0,
      limit: 1,
      unit: 'bool',
      sense: 'max',
      passed: applicable,
      utilization: applicable ? 1 : 0,
    },
  ]
}

/** Unclamped margins; non-finite inputs propagate. */
export function columnEfficiency(a: ColumnAnalysis, ch: Pick<ColumnChallenge, 'constraints' | 'load'>): ColumnEfficiency {
  const k = ch.constraints
  return {
    massUsage: a.massKg / k.maxMassKg,
    bucklingMargin: 1 - requiredCriticalLoadN(ch) / a.criticalLoadN,
    stressMargin: 1 - a.axialStressPa / k.maxAxialStressPa,
  }
}
