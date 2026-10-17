import type { TorsionChallenge } from '../../challenge/torsion/types'
import type { TorsionAnalysis } from '../../physics/torsion/types'
import { withinLimit } from '../tolerance'
import type { TorsionConstraintId, TorsionConstraintResult, TorsionConstraintUnit, TorsionEfficiency } from './types'

// Torsion constraint checks (task 47.2; TSH-07, MM-11). Pure; never throws for typed inputs,
// including analyses with non-finite numbers (those constraints fail, all 5 are still returned).
// Comparisons use the shared inclusive withinLimit with REL_TOL, so a value equal to its limit
// passes and non-finite values never pass.

/** Fixed reporting order (TSH-07). */
export const TORSION_CONSTRAINT_ORDER: readonly TorsionConstraintId[] = Object.freeze([
  'twist',
  'shearStress',
  'mass',
  'outerDiameter',
  'applicability',
] as const)

/** Student-facing labels. Contain no digits, so fact texts that quote them stay grounded. */
export const TORSION_CONSTRAINT_LABELS: Readonly<Record<TorsionConstraintId, string>> = Object.freeze({
  twist: 'Angle of twist',
  shearStress: 'Maximum shear stress',
  mass: 'Mass',
  outerDiameter: 'Outer diameter',
  applicability: 'Model applicability',
})

function numeric(
  id: TorsionConstraintId,
  value: number,
  limit: number,
  unit: TorsionConstraintUnit,
): TorsionConstraintResult {
  return {
    id,
    label: TORSION_CONSTRAINT_LABELS[id],
    value,
    limit,
    unit,
    passed: withinLimit(value, limit),
    utilization: value / limit,
  }
}

/** Returns exactly 5 constraint results in TORSION_CONSTRAINT_ORDER; applicability mirrors `a.applicable`. */
export function evaluateTorsionConstraints(
  a: TorsionAnalysis,
  ch: Pick<TorsionChallenge, 'constraints'>,
): TorsionConstraintResult[] {
  const k = ch.constraints
  const applicable = a.applicable === true
  return [
    numeric('twist', a.twistRad, k.maxTwistRad, 'rad'),
    numeric('shearStress', a.maxShearStressPa, k.maxShearStressPa, 'Pa'),
    numeric('mass', a.massKg, k.maxMassKg, 'kg'),
    numeric('outerDiameter', a.outerDiameterM, k.maxOuterDiameterM, 'm'),
    {
      id: 'applicability',
      label: TORSION_CONSTRAINT_LABELS.applicability,
      value: applicable ? 1 : 0,
      limit: 1,
      unit: 'bool',
      passed: applicable,
      utilization: applicable ? 1 : 0,
    },
  ]
}

/** Unclamped margins; non-finite inputs propagate as non-finite outputs. */
export function torsionEfficiency(a: TorsionAnalysis, ch: Pick<TorsionChallenge, 'constraints'>): TorsionEfficiency {
  const k = ch.constraints
  return {
    massUsage: a.massKg / k.maxMassKg,
    twistMargin: 1 - a.twistRad / k.maxTwistRad,
    stressMargin: 1 - a.maxShearStressPa / k.maxShearStressPa,
  }
}
