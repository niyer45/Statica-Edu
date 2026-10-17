import type { VibrationChallenge } from '../../challenge/vibration/types'
import type { VibrationAnalysis } from '../../physics/vibration/types'
import { withinLimit } from '../tolerance'
import type { VibrationConstraintId, VibrationConstraintResult, VibrationConstraintUnit, VibrationEfficiency } from './types'

// Vibration constraint checks (task 50.2; VIB-07, MM-11). Pure; never throws for typed inputs,
// including analyses with non-finite numbers (those constraints fail, all 5 are still returned).
// Comparisons use the shared inclusive withinLimit with REL_TOL, so a value equal to its limit
// passes and non-finite values never pass.

/** Fixed reporting order (VIB-07). */
export const VIBRATION_CONSTRAINT_ORDER: readonly VibrationConstraintId[] = Object.freeze([
  'worstInBandTransmissibility',
  'staticDeflection',
  'peakTransmissibility',
  'relativeDisplacement',
  'applicability',
] as const)

/** Student-facing labels. Contain no digits, so fact texts that quote them stay grounded. */
export const VIBRATION_CONSTRAINT_LABELS: Readonly<Record<VibrationConstraintId, string>> = Object.freeze({
  worstInBandTransmissibility: 'Worst vibration transmitted in the operating band',
  staticDeflection: 'Static deflection (sag)',
  peakTransmissibility: 'Peak transmissibility (resonance)',
  relativeDisplacement: 'Peak relative displacement (clearance)',
  applicability: 'Model applicability',
})

function numeric(
  id: VibrationConstraintId,
  value: number,
  limit: number,
  unit: VibrationConstraintUnit,
): VibrationConstraintResult {
  return {
    id,
    label: VIBRATION_CONSTRAINT_LABELS[id],
    value,
    limit,
    unit,
    passed: withinLimit(value, limit),
    utilization: value / limit,
  }
}

/** Returns exactly 5 constraint results in VIBRATION_CONSTRAINT_ORDER; applicability mirrors `a.applicable`. */
export function evaluateVibrationConstraints(
  a: VibrationAnalysis,
  ch: Pick<VibrationChallenge, 'constraints'>,
): VibrationConstraintResult[] {
  const k = ch.constraints
  const applicable = a.applicable === true
  return [
    numeric('worstInBandTransmissibility', a.worstInBandTransmissibility, k.maxWorstInBandTransmissibility, 'ratio'),
    numeric('staticDeflection', a.staticDeflectionM, k.maxStaticDeflectionM, 'm'),
    numeric('peakTransmissibility', a.peakTransmissibility, k.maxPeakTransmissibility, 'ratio'),
    numeric('relativeDisplacement', a.peakRelativeDisplacementM, k.maxRelativeDisplacementM, 'm'),
    {
      id: 'applicability',
      label: VIBRATION_CONSTRAINT_LABELS.applicability,
      value: applicable ? 1 : 0,
      limit: 1,
      unit: 'bool',
      passed: applicable,
      utilization: applicable ? 1 : 0,
    },
  ]
}

/** Unclamped margins; non-finite inputs propagate as non-finite outputs. */
export function vibrationEfficiency(a: VibrationAnalysis, ch: Pick<VibrationChallenge, 'constraints'>): VibrationEfficiency {
  const k = ch.constraints
  return {
    isolationMargin: 1 - a.worstInBandTransmissibility / k.maxWorstInBandTransmissibility,
    sagUsage: a.staticDeflectionM / k.maxStaticDeflectionM,
    clearanceUsage: a.peakRelativeDisplacementM / k.maxRelativeDisplacementM,
  }
}
