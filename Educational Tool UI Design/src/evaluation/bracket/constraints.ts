import type { BracketChallenge } from '../../challenge/bracket/types'
import type { BracketAnalysis } from '../../physics/bracket/types'
import { withinLimit } from '../tolerance'
import type { BracketConstraintId, BracketConstraintResult, BracketConstraintUnit, BracketEfficiency } from './types'

// Bracket constraint checks (task 55 L-bracket; MM-11). Pure; never throws for typed inputs,
// including analyses with non-finite numbers (those constraints fail, all 5 are still returned).
// Comparisons use the shared inclusive withinLimit with REL_TOL, so a value equal to its limit
// passes and non-finite values never pass.

/** Fixed reporting order. */
export const BRACKET_CONSTRAINT_ORDER: readonly BracketConstraintId[] = Object.freeze([
  'bendStress',
  'deflection',
  'boltTension',
  'mass',
  'applicability',
] as const)

/** Student-facing labels. Contain no digits, so fact texts that quote them stay grounded. */
export const BRACKET_CONSTRAINT_LABELS: Readonly<Record<BracketConstraintId, string>> = Object.freeze({
  bendStress: 'Bend stress',
  deflection: 'Deflection at the load',
  boltTension: 'Bolt tension',
  mass: 'Mass',
  applicability: 'Model applicability',
})

function numeric(id: BracketConstraintId, value: number, limit: number, unit: BracketConstraintUnit): BracketConstraintResult {
  return { id, label: BRACKET_CONSTRAINT_LABELS[id], value, limit, unit, passed: withinLimit(value, limit), utilization: value / limit }
}

/** Returns exactly 5 constraint results in BRACKET_CONSTRAINT_ORDER; applicability mirrors `a.applicable`. */
export function evaluateBracketConstraints(
  a: BracketAnalysis,
  ch: Pick<BracketChallenge, 'constraints'>,
): BracketConstraintResult[] {
  const k = ch.constraints
  const applicable = a.applicable === true
  return [
    numeric('bendStress', a.bendStressPa, k.maxBendStressPa, 'Pa'),
    numeric('deflection', a.deflectionM, k.maxDeflectionM, 'm'),
    numeric('boltTension', a.boltTensionN, k.maxBoltTensionN, 'N'),
    numeric('mass', a.massKg, k.maxMassKg, 'kg'),
    {
      id: 'applicability',
      label: BRACKET_CONSTRAINT_LABELS.applicability,
      value: applicable ? 1 : 0,
      limit: 1,
      unit: 'bool',
      passed: applicable,
      utilization: applicable ? 1 : 0,
    },
  ]
}

/** Unclamped margins; non-finite inputs propagate. */
export function bracketEfficiency(a: BracketAnalysis, ch: Pick<BracketChallenge, 'constraints'>): BracketEfficiency {
  const k = ch.constraints
  return {
    massUsage: a.massKg / k.maxMassKg,
    stressMargin: 1 - a.bendStressPa / k.maxBendStressPa,
    deflectionMargin: 1 - a.deflectionM / k.maxDeflectionM,
    boltMargin: 1 - a.boltTensionN / k.maxBoltTensionN,
  }
}
