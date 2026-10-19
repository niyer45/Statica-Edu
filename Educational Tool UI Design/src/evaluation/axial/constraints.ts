import type { AxialChallenge } from '../../challenge/axial/types'
import { allowableStress } from '../../physics/axial/formulas'
import type { AxialAnalysis } from '../../physics/axial/types'
import { withinLimit } from '../tolerance'
import type { AxialConstraintId, AxialConstraintResult, AxialConstraintUnit, AxialEfficiency } from './types'

// Stress and Strain I checks (task 72; SSR-07, MM-11). Pure; never throws for typed inputs,
// including analyses with non-finite numbers (those checks fail, all 4 are still returned).
// Comparisons use the shared inclusive withinLimit with REL_TOL. The stress limit is the stored
// yield strength of the chosen material divided by the challenge design factor, so it changes
// with the material: strength is a material property.

/** Fixed reporting order (SSR-07). */
export const AXIAL_CONSTRAINT_ORDER: readonly AxialConstraintId[] = Object.freeze(['stress', 'elongation', 'mass', 'applicability'] as const)

/** Student-facing labels. Contain no digits, so fact texts that quote them stay grounded. */
export const AXIAL_CONSTRAINT_LABELS: Readonly<Record<AxialConstraintId, string>> = Object.freeze({
  stress: 'Axial stress',
  elongation: 'Elongation',
  mass: 'Mass',
  applicability: 'Model applicability',
})

function numeric(id: AxialConstraintId, value: number, limit: number, unit: AxialConstraintUnit): AxialConstraintResult {
  return { id, label: AXIAL_CONSTRAINT_LABELS[id], value, limit, unit, passed: withinLimit(value, limit), utilization: value / limit }
}

/** The stress limit for an analysis: its material's yield strength divided by the design factor. */
export function axialStressLimit(a: Pick<AxialAnalysis, 'yieldStressPa'>, ch: Pick<AxialChallenge, 'designFactor'>): number {
  return allowableStress(a.yieldStressPa, ch.designFactor)
}

/** Returns exactly 4 results in AXIAL_CONSTRAINT_ORDER; applicability mirrors `a.applicable`. */
export function evaluateAxialConstraints(a: AxialAnalysis, ch: Pick<AxialChallenge, 'constraints' | 'designFactor'>): AxialConstraintResult[] {
  const k = ch.constraints
  const applicable = a.applicable === true
  return [
    numeric('stress', a.stressPa, axialStressLimit(a, ch), 'Pa'),
    numeric('elongation', a.elongationM, k.maxElongationM, 'm'),
    numeric('mass', a.massKg, k.maxMassKg, 'kg'),
    {
      id: 'applicability',
      label: AXIAL_CONSTRAINT_LABELS.applicability,
      value: applicable ? 1 : 0,
      limit: 1,
      unit: 'bool',
      passed: applicable,
      utilization: applicable ? 1 : 0,
    },
  ]
}

/** Unclamped margins; non-finite inputs propagate as non-finite outputs. */
export function axialEfficiency(a: AxialAnalysis, ch: Pick<AxialChallenge, 'constraints' | 'designFactor'>): AxialEfficiency {
  const k = ch.constraints
  return {
    massUsage: a.massKg / k.maxMassKg,
    stressMargin: 1 - a.stressPa / axialStressLimit(a, ch),
    elongationMargin: 1 - a.elongationM / k.maxElongationM,
  }
}
