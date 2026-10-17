import type { HeatSinkChallenge } from '../../challenge/heatSink/types'
import type { HeatSinkAnalysis } from '../../physics/heatSink/types'
import { withinLimit } from '../tolerance'
import { withinLowerLimit } from './tolerance'
import type { HeatSinkConstraintId, HeatSinkConstraintResult, HeatSinkConstraintUnit, HeatSinkEfficiency } from './types'

// Heat sink constraint checks (task 48.2; HSK-07, MM-11). Pure; never throws for typed inputs,
// including analyses with non-finite numbers (those constraints fail, all 5 are still returned).
// Upper bounds use the shared inclusive withinLimit with REL_TOL; the fin gap uses the mirrored
// inclusive withinLowerLimit. A value equal to its limit passes and non-finite values never pass.

/** Fixed reporting order (HSK-07). */
export const HEAT_SINK_CONSTRAINT_ORDER: readonly HeatSinkConstraintId[] = Object.freeze([
  'baseTemperature',
  'mass',
  'finHeight',
  'finGap',
  'applicability',
] as const)

/** Student-facing labels. Contain no digits, so fact texts that quote them stay grounded. */
export const HEAT_SINK_CONSTRAINT_LABELS: Readonly<Record<HeatSinkConstraintId, string>> = Object.freeze({
  baseTemperature: 'Base temperature',
  mass: 'Mass',
  finHeight: 'Fin height',
  finGap: 'Fin gap',
  applicability: 'Model applicability',
})

function upper(id: HeatSinkConstraintId, value: number, limit: number, unit: HeatSinkConstraintUnit): HeatSinkConstraintResult {
  return {
    id,
    label: HEAT_SINK_CONSTRAINT_LABELS[id],
    value,
    limit,
    unit,
    bound: 'upper',
    passed: withinLimit(value, limit),
    utilization: value / limit,
  }
}

function lower(id: HeatSinkConstraintId, value: number, limit: number, unit: HeatSinkConstraintUnit): HeatSinkConstraintResult {
  return {
    id,
    label: HEAT_SINK_CONSTRAINT_LABELS[id],
    value,
    limit,
    unit,
    bound: 'lower',
    passed: withinLowerLimit(value, limit),
    utilization: limit / value,
  }
}

/** Returns exactly 5 constraint results in HEAT_SINK_CONSTRAINT_ORDER; applicability mirrors `a.applicable`. */
export function evaluateHeatSinkConstraints(
  a: HeatSinkAnalysis,
  ch: Pick<HeatSinkChallenge, 'constraints'>,
): HeatSinkConstraintResult[] {
  const k = ch.constraints
  const applicable = a.applicable === true
  return [
    upper('baseTemperature', a.baseTemperatureK, k.maxBaseTemperatureK, 'K'),
    upper('mass', a.massKg, k.maxMassKg, 'kg'),
    upper('finHeight', a.finHeightM, k.maxFinHeightM, 'm'),
    lower('finGap', a.finGapM, k.minFinGapM, 'm'),
    {
      id: 'applicability',
      label: HEAT_SINK_CONSTRAINT_LABELS.applicability,
      value: applicable ? 1 : 0,
      limit: 1,
      unit: 'bool',
      bound: 'upper',
      passed: applicable,
      utilization: applicable ? 1 : 0,
    },
  ]
}

/** Unclamped margins; non-finite inputs propagate as non-finite outputs. */
export function heatSinkEfficiency(a: HeatSinkAnalysis, ch: Pick<HeatSinkChallenge, 'constraints'>): HeatSinkEfficiency {
  const k = ch.constraints
  return {
    temperatureMarginK: k.maxBaseTemperatureK - a.baseTemperatureK,
    massUsage: a.massKg / k.maxMassKg,
    gapMarginM: a.finGapM - k.minFinGapM,
  }
}
