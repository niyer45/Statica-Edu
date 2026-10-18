import type { BracketChallenge } from '../../../challenge/bracket/types'
import type { BracketConstraintUnit } from '../../../evaluation/bracket/types'
import type { BracketDesign } from '../../../geometry/bracket/design'
import { isUniformBar } from '../../../geometry/bracket/design'
import { BRACKET_KT_SOURCE_NOTE } from '../../../physics/bracket/constants'
import type { BracketAnalysis, BracketPeakLocation } from '../../../physics/bracket/types'
import type { BracketAction, BracketSession } from '../../../state/bracketModel'
import { formatMm, kgToG, paToMpa } from '../../../units/units'
import { useModelStore } from '../../state/store'

// Shared helpers for the Mounting Bracket I UI (task 46.3). Display formatting only; every value
// shown comes from a stored bracket analysis/evaluation or the challenge config. Absent stored
// quantities (no step, or the Kt fit undefined) are shown as words, never as placeholder numbers.

export type StudentBracketChallenge = Omit<BracketChallenge, 'referenceDesign'>

/** The active bracket store; the model UI registry guarantees the active model is the bracket. */
export const useBracketStore = () => useModelStore<BracketSession, BracketAction, StudentBracketChallenge>()

/** Required Kt source disclosure for the model limits and help text (MBR-20, D-41 K-1). */
export const BRACKET_KT_DISCLOSURE = `This model uses ${BRACKET_KT_SOURCE_NOTE}. Verification against a printed edition is still required before release.`

/** Display units of stored bracket values; `ratio` is dimensionless (Kt, h/r, D/d). */
export type BracketDisplayUnit = BracketConstraintUnit | 'ratio'

/** Display text for a stored bracket value or limit (MBR-07 precision). */
export function formatBracket(value: number, unit: BracketDisplayUnit): string {
  if (unit === 'Pa') return `${paToMpa(value).toFixed(1)} MPa`
  if (unit === 'm') return `${formatMm(value, 2)} mm`
  if (unit === 'kg') return `${kgToG(value).toFixed(1)} g`
  if (unit === 'ratio') return value.toFixed(2)
  return ''
}

/** Word shown in place of an absent stored step quantity. */
export const NOT_APPLICABLE = 'Not applicable'
export const NO_STEP = 'No step'

/** A stored optional value, or the word explaining why it is absent. */
export function formatOptional(value: number | undefined, unit: BracketDisplayUnit, design: Pick<BracketDesign, 'rootDepthM' | 'armDepthM'>): string {
  if (value !== undefined) return formatBracket(value, unit)
  return isUniformBar(design) ? NO_STEP : NOT_APPLICABLE
}

export const LOCATION_LABELS: Readonly<Record<BracketPeakLocation, string>> = { root: 'Root', step: 'Step' }

/** One-line description of where the peak stress is, from the stored analysis only. */
export function peakSummary(a: Pick<BracketAnalysis, 'peakStressPa' | 'peakLocation' | 'ktStep' | 'stepNominalStressPa'>): string {
  if (a.peakStressPa === undefined || a.peakLocation === undefined) return 'Peak stress not applicable: the shoulder-fillet curve fit does not cover this step'
  const peak = `Peak stress ${formatBracket(a.peakStressPa, 'Pa')} at the ${a.peakLocation}`
  if (a.stepNominalStressPa === undefined) return `${peak} · no step: stress concentration not applied`
  return `${peak} · Kt at the step ${formatBracket(a.ktStep!, 'ratio')}`
}

/** Short design description for history rows. */
export function designLabel(d: Readonly<BracketDesign>): string {
  if (isUniformBar(d)) return `Uniform bar ${formatMm(d.rootDepthM, 1)} mm`
  return `${formatMm(d.rootDepthM, 1)}/${formatMm(d.armDepthM, 1)} mm · step ${formatMm(d.stepLocationM, 0)} mm · r ${formatMm(d.filletRadiusM, 1)} mm`
}
