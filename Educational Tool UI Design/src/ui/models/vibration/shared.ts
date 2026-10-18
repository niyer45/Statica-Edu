import type { VibrationChallenge } from '../../../challenge/vibration/types'
import type { VibrationConstraintId } from '../../../evaluation/vibration/types'
import type { VibrationAction, VibrationSession } from '../../../state/vibrationModel'
import { formatFixed, formatHz, formatKnPerM, formatMm, formatSignificant } from '../../../units/units'
import { useModelStore } from '../../state/store'

// Shared helpers for the Vibration Isolation I UI (task 50.3). Display formatting only; every
// value shown comes from a stored vibration analysis/evaluation or the challenge config.

export type StudentVibrationChallenge = Omit<VibrationChallenge, 'referenceDesign'>

/** The active vibration store; the model UI registry guarantees the active model is vibration. */
export const useVibrationStore = () => useModelStore<VibrationSession, VibrationAction, StudentVibrationChallenge>()

/** Display units of stored vibration values (SI in storage, MM-12 formatting here). */
export type VibrationDisplayUnit = 'ratio' | 'm' | 'Hz' | 'N/m' | 'zeta' | 'Ns/m' | 'bool'

/** Display text for a stored vibration value: TR to 3 significant figures, mm, Hz, kN/m. */
export function formatVibration(value: number, unit: VibrationDisplayUnit): string {
  if (unit === 'ratio') return formatSignificant(value, 3)
  if (unit === 'm') return `${formatMm(value, 2)} mm`
  if (unit === 'Hz') return `${formatHz(value)} Hz`
  if (unit === 'N/m') return `${formatKnPerM(value)} kN/m`
  if (unit === 'zeta') return formatFixed(value, 2)
  if (unit === 'Ns/m') return `${formatFixed(value, 0)} N·s/m`
  return ''
}

/** Short check names for the goal card and history metrics (task 56); full labels stay in Test details. */
export const CHECK_LABELS: Readonly<Record<Exclude<VibrationConstraintId, 'applicability'>, string>> = {
  worstInBandTransmissibility: 'Vibration in band',
  staticDeflection: 'Sag',
  peakTransmissibility: 'Resonance peak',
  relativeDisplacement: 'Rattle space',
}

/** The student-facing name of a material id, from the challenge config. */
export function materialName(ch: Pick<VibrationChallenge, 'materials'>, materialId: string): string {
  return ch.materials.find((m) => m.id === materialId)?.name ?? materialId
}

/** Slider resolution: the log-scale stiffness slider has this many keyboard steps (VIB-14). */
export const STIFFNESS_SLIDER_STEPS = 400

/**
 * Logarithmic slider position (0…STIFFNESS_SLIDER_STEPS) → stiffness in N/m, snapped to the
 * configured input step. Control mapping only; the reducer still clamps and validates.
 */
export function sliderToStiffness(position: number, limits: VibrationChallenge['stiffnessLimits']): number {
  const t = Math.min(1, Math.max(0, position / STIFFNESS_SLIDER_STEPS))
  const raw = limits.minNPerM * Math.pow(limits.maxNPerM / limits.minNPerM, t)
  return Math.round(raw / limits.stepNPerM) * limits.stepNPerM
}

/** Stiffness in N/m → nearest logarithmic slider position. */
export function stiffnessToSlider(stiffnessNPerM: number, limits: VibrationChallenge['stiffnessLimits']): number {
  const t = Math.log(stiffnessNPerM / limits.minNPerM) / Math.log(limits.maxNPerM / limits.minNPerM)
  return Math.round(Math.min(1, Math.max(0, t)) * STIFFNESS_SLIDER_STEPS)
}
