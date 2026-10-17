import type { BracketChallenge } from '../../challenge/bracket/types'
import type { BracketAnalysis } from '../../physics/bracket/types'
import { withinLimit } from '../tolerance'
import type { BracketConstraintId, BracketConstraintResult, BracketConstraintUnit, BracketEfficiency } from './types'

// Bracket constraint checks (task 46.2; MBR-08, MM-11). Pure; never throws for typed inputs,
// including analyses with non-finite numbers (those constraints fail, all 5 are still returned).
// Comparisons use the shared inclusive withinLimit with REL_TOL, so a value equal to its limit
// passes and non-finite values never pass. An absent peak stress is reported without a value and
// never passes (MBR-08, MM-10).

/** Fixed reporting order (MBR-08). */
export const BRACKET_CONSTRAINT_ORDER: readonly BracketConstraintId[] = Object.freeze([
  'peakStress',
  'tipDeflection',
  'mass',
  'envelopeDepth',
  'applicability',
] as const)

/** Student-facing labels. Contain no digits, so fact texts that quote them stay grounded. */
export const BRACKET_CONSTRAINT_LABELS: Readonly<Record<BracketConstraintId, string>> = Object.freeze({
  peakStress: 'Peak stress',
  tipDeflection: 'Tip deflection',
  mass: 'Mass',
  envelopeDepth: 'Envelope depth',
  applicability: 'Model applicability',
})

function numeric(
  id: BracketConstraintId,
  value: number | undefined,
  limit: number,
  unit: BracketConstraintUnit,
): BracketConstraintResult {
  const label = BRACKET_CONSTRAINT_LABELS[id]
  if (value === undefined) return { id, label, limit, unit, passed: false }
  return { id, label, value, limit, unit, passed: withinLimit(value, limit), utilization: value / limit }
}

/** Returns exactly 5 constraint results in BRACKET_CONSTRAINT_ORDER; applicability mirrors `a.applicable`. */
export function evaluateBracketConstraints(
  a: BracketAnalysis,
  ch: Pick<BracketChallenge, 'constraints'>,
): BracketConstraintResult[] {
  const k = ch.constraints
  const applicable = a.applicable === true
  return [
    numeric('peakStress', a.peakStressPa, k.maxPeakStressPa, 'Pa'),
    numeric('tipDeflection', a.tipDeflectionM, k.maxTipDeflectionM, 'm'),
    numeric('mass', a.massKg, k.maxMassKg, 'kg'),
    numeric('envelopeDepth', a.envelopeDepthM, k.maxEnvelopeDepthM, 'm'),
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

/** Unclamped margins; non-finite inputs propagate; stressMargin is omitted without a peak stress. */
export function bracketEfficiency(a: BracketAnalysis, ch: Pick<BracketChallenge, 'constraints'>): BracketEfficiency {
  const k = ch.constraints
  return {
    massUsage: a.massKg / k.maxMassKg,
    ...(a.peakStressPa !== undefined ? { stressMargin: 1 - a.peakStressPa / k.maxPeakStressPa } : {}),
    deflectionMargin: 1 - a.tipDeflectionM / k.maxTipDeflectionM,
  }
}
