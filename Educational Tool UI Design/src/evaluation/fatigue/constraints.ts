import type { FatigueChallenge } from '../../challenge/fatigue/types'
import type { FatigueAnalysis } from '../../physics/fatigue/types'
import { withinLowerLimit } from '../heatSink/tolerance'
import { withinLimit } from '../tolerance'
import type { FatigueConstraintId, FatigueConstraintResult, FatigueConstraintUnit, FatigueEfficiency } from './types'

// Fatigue constraint checks (task 70; FAT-09, MM-11). Pure; never throws for typed inputs. Upper
// bounds use the shared inclusive withinLimit; lower bounds use the mirrored inclusive
// withinLowerLimit (the shared lower-bound helper introduced with the heat sink). A value equal to
// its limit passes and non-finite values never pass.

export const FATIGUE_CONSTRAINT_ORDER: readonly FatigueConstraintId[] = Object.freeze(['fatigueSafetyFactor', 'yieldSafetyFactor', 'mass', 'shoulderFace', 'applicability'] as const)

/** Student-facing labels. Contain no digits, so fact texts that quote them stay grounded. */
export const FATIGUE_CONSTRAINT_LABELS: Readonly<Record<FatigueConstraintId, string>> = Object.freeze({
  fatigueSafetyFactor: 'Fatigue safety factor at the target life',
  yieldSafetyFactor: 'First-cycle yield safety factor',
  mass: 'Mass',
  shoulderFace: 'Shoulder face for the wheel hub',
  applicability: 'Model applicability',
})

function upper(id: FatigueConstraintId, value: number, limit: number, unit: FatigueConstraintUnit): FatigueConstraintResult {
  return { id, label: FATIGUE_CONSTRAINT_LABELS[id], value, limit, unit, bound: 'upper', passed: withinLimit(value, limit), utilization: value / limit }
}

function lower(id: FatigueConstraintId, value: number, limit: number, unit: FatigueConstraintUnit): FatigueConstraintResult {
  return { id, label: FATIGUE_CONSTRAINT_LABELS[id], value, limit, unit, bound: 'lower', passed: withinLowerLimit(value, limit), utilization: limit / value }
}

/** Exactly 5 constraint results in FATIGUE_CONSTRAINT_ORDER; applicability mirrors `a.applicable`. */
export function evaluateFatigueConstraints(a: FatigueAnalysis, ch: Pick<FatigueChallenge, 'constraints'>): FatigueConstraintResult[] {
  const k = ch.constraints
  const applicable = a.applicable === true
  return [
    lower('fatigueSafetyFactor', a.fatigueSafetyFactor, k.minFatigueSafetyFactor, 'ratio'),
    lower('yieldSafetyFactor', a.yieldSafetyFactor, k.minYieldSafetyFactor, 'ratio'),
    upper('mass', a.massKg, k.maxMassKg, 'kg'),
    lower('shoulderFace', a.shoulderFaceM, k.minShoulderFaceM, 'm'),
    {
      id: 'applicability',
      label: FATIGUE_CONSTRAINT_LABELS.applicability,
      value: applicable ? 1 : 0,
      limit: 1,
      unit: 'bool',
      bound: 'upper',
      passed: applicable,
      utilization: applicable ? 1 : 0,
    },
  ]
}

/** Unclamped margins; non-finite inputs propagate. */
export function fatigueEfficiency(a: FatigueAnalysis, ch: Pick<FatigueChallenge, 'constraints'>): FatigueEfficiency {
  const k = ch.constraints
  return {
    fatigueMargin: a.fatigueSafetyFactor / k.minFatigueSafetyFactor - 1,
    yieldMargin: a.yieldSafetyFactor / k.minYieldSafetyFactor - 1,
    massUsage: a.massKg / k.maxMassKg,
    shoulderFaceMarginM: a.shoulderFaceM - k.minShoulderFaceM,
  }
}
