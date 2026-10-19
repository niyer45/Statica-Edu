import { allowableStressPa, type VesselChallenge } from '../../challenge/vessel/types'
import type { VesselAnalysis } from '../../physics/vessel/types'
import { withinLimit } from '../tolerance'
import type { VesselConstraintId, VesselConstraintResult, VesselConstraintUnit, VesselEfficiency } from './types'

// Pressure vessel constraint checks (task 69; PVS-07, MM-11). Pure; never throws for typed
// inputs, including analyses with non-finite numbers (those constraints fail, all 7 are still
// returned). Comparisons use the shared inclusive withinLimit with REL_TOL, so a value equal to
// its limit passes and non-finite values never pass. The volume is a minimum.

/** Fixed reporting order. */
export const VESSEL_CONSTRAINT_ORDER: readonly VesselConstraintId[] = Object.freeze([
  'hoopStress',
  'longitudinalStress',
  'headStress',
  'volume',
  'overallLength',
  'mass',
  'applicability',
] as const)

/** Student-facing labels. Contain no digits, so fact texts that quote them stay grounded. */
export const VESSEL_CONSTRAINT_LABELS: Readonly<Record<VesselConstraintId, string>> = Object.freeze({
  hoopStress: 'Hoop stress (shell)',
  longitudinalStress: 'Longitudinal stress (shell)',
  headStress: 'Head stress',
  volume: 'Internal volume',
  overallLength: 'Overall length',
  mass: 'Mass',
  applicability: 'Model applicability',
})

function atMost(id: VesselConstraintId, value: number, limit: number, unit: VesselConstraintUnit): VesselConstraintResult {
  return { id, label: VESSEL_CONSTRAINT_LABELS[id], value, limit, unit, bound: 'max', passed: withinLimit(value, limit), utilization: value / limit }
}

function atLeast(id: VesselConstraintId, value: number, limit: number, unit: VesselConstraintUnit): VesselConstraintResult {
  return { id, label: VESSEL_CONSTRAINT_LABELS[id], value, limit, unit, bound: 'min', passed: withinLimit(limit, value), utilization: limit / value }
}

/** Returns exactly 7 constraint results in VESSEL_CONSTRAINT_ORDER; applicability mirrors `a.applicable`. */
export function evaluateVesselConstraints(
  a: VesselAnalysis,
  ch: Pick<VesselChallenge, 'constraints' | 'material' | 'designFactor'>,
): VesselConstraintResult[] {
  const k = ch.constraints
  const allowable = allowableStressPa(ch)
  const applicable = a.applicable === true
  return [
    atMost('hoopStress', a.hoopStressPa, allowable, 'Pa'),
    atMost('longitudinalStress', a.longitudinalStressPa, allowable, 'Pa'),
    atMost('headStress', a.headStressPa, allowable, 'Pa'),
    atLeast('volume', a.volumeM3, k.minVolumeM3, 'm3'),
    atMost('overallLength', a.overallLengthM, k.maxOverallLengthM, 'm'),
    atMost('mass', a.massKg, k.maxMassKg, 'kg'),
    {
      id: 'applicability',
      label: VESSEL_CONSTRAINT_LABELS.applicability,
      value: applicable ? 1 : 0,
      limit: 1,
      unit: 'bool',
      bound: 'max',
      passed: applicable,
      utilization: applicable ? 1 : 0,
    },
  ]
}

/** Unclamped margins; non-finite inputs propagate. */
export function vesselEfficiency(a: VesselAnalysis, ch: Pick<VesselChallenge, 'constraints' | 'material' | 'designFactor'>): VesselEfficiency {
  const k = ch.constraints
  const allowable = allowableStressPa(ch)
  return {
    massUsage: a.massKg / k.maxMassKg,
    hoopMargin: 1 - a.hoopStressPa / allowable,
    headMargin: 1 - a.headStressPa / allowable,
    volumeMargin: a.volumeM3 / k.minVolumeM3 - 1,
  }
}
