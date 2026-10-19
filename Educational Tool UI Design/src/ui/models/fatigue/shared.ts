import type { FatigueChallenge } from '../../../challenge/fatigue/types'
import type { FatigueConstraintUnit } from '../../../evaluation/fatigue/types'
import type { FatigueDesign, SurfaceFinishId } from '../../../geometry/fatigue/design'
import { FATIGUE_SOURCE_NOTE, SURFACE_FINISHES } from '../../../physics/fatigue/constants'
import type { FatigueAnalysis } from '../../../physics/fatigue/types'
import type { FatigueAction, FatigueSession } from '../../../state/fatigueModel'
import { formatMm, kgToG, paToMpa } from '../../../units/units'
import { useModelStore } from '../../state/store'

// Shared helpers for the Fatigue Analysis I UI (task 70). Display formatting only; every value
// shown comes from a stored fatigue analysis/evaluation or the challenge config.

export type StudentFatigueChallenge = Omit<FatigueChallenge, 'referenceDesign'>

/** The active fatigue store; the model UI registry guarantees the active model is fatigue. */
export const useFatigueStore = () => useModelStore<FatigueSession, FatigueAction, StudentFatigueChallenge>()

export const FATIGUE_SOURCE_DISCLOSURE = `This model uses ${FATIGUE_SOURCE_NOTE}.`

export type FatigueDisplayUnit = FatigueConstraintUnit | 'Pa' | 'factor' | 'cycles'

/** Display text for a stored fatigue value or limit. */
export function formatFatigue(value: number, unit: FatigueDisplayUnit): string {
  if (unit === 'ratio') return value.toFixed(2)
  if (unit === 'factor') return value.toFixed(3)
  if (unit === 'Pa') return `${paToMpa(value).toFixed(1)} MPa`
  if (unit === 'm') return `${formatMm(value, 2)} mm`
  if (unit === 'kg') return `${kgToG(value).toFixed(0)} g`
  if (unit === 'cycles') return formatCycles(value)
  return ''
}

/** Cycles in scientific form with a superscript exponent, e.g. "6.99 × 10³ cycles". */
export function formatCycles(cycles: number): string {
  let exponent = Math.floor(Math.log10(cycles))
  let mantissa = cycles / 10 ** exponent
  if (mantissa.toFixed(2) === '10.00') {
    exponent += 1
    mantissa /= 10
  }
  const sup = String(exponent).replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]!)
  return `${mantissa.toFixed(2)} × 10${sup} cycles`
}

/** Limit text with its bound, e.g. "min 1.30" or "max 520 g". */
export function formatLimit(c: { bound: 'upper' | 'lower'; limit: number; unit: FatigueConstraintUnit }): string {
  return `${c.bound === 'lower' ? 'min' : 'max'} ${formatFatigue(c.limit, c.unit)}`
}

/** The predicted life in words from the stored regime. */
export function lifeText(a: Pick<FatigueAnalysis, 'lifeRegime' | 'predictedLifeCycles'>): string {
  if (a.lifeRegime === 'infinite') return 'Infinite (below the endurance limit)'
  if (a.lifeRegime === 'finite' && a.predictedLifeCycles !== undefined) return formatCycles(a.predictedLifeCycles)
  return 'Below a thousand cycles (outside the model)'
}

export function finishName(id: SurfaceFinishId): string {
  return SURFACE_FINISHES[id].name
}

/** Short design description for history rows. */
export function designLabel(d: Readonly<FatigueDesign>): string {
  return `d ${formatMm(d.neckDiameterM, 1)} · D ${formatMm(d.collarDiameterM, 1)} · r ${formatMm(d.filletRadiusM, 2)} mm · ${finishName(d.surfaceFinish).toLowerCase()}`
}
