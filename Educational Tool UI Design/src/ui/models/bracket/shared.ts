import type { BracketChallenge } from '../../../challenge/bracket/types'
import type { BracketConstraintUnit } from '../../../evaluation/bracket/types'
import type { BracketDesign } from '../../../geometry/bracket/design'
import { BRACKET_SOURCE_NOTE } from '../../../physics/bracket/constants'
import type { BracketAction, BracketSession } from '../../../state/bracketModel'
import { formatMm, kgToG, paToMpa } from '../../../units/units'
import { useModelStore } from '../../state/store'

// Shared helpers for the Mounting Bracket I UI (task 55 L-bracket). Display formatting only; every
// value shown comes from a stored bracket analysis/evaluation or the challenge config.

export type StudentBracketChallenge = Omit<BracketChallenge, 'referenceDesign'>

/** The active bracket store; the model UI registry guarantees the active model is the bracket. */
export const useBracketStore = () => useModelStore<BracketSession, BracketAction, StudentBracketChallenge>()

/** Source disclosure for the model limits and help text. */
export const BRACKET_SOURCE_DISCLOSURE = `This model uses the ${BRACKET_SOURCE_NOTE}.`

/** Display units of stored bracket values; `ratio` is dimensionless (curved-beam factor, R/c). */
export type BracketDisplayUnit = BracketConstraintUnit | 'ratio' | 'Nm'

/** Display text for a stored bracket value or limit. */
export function formatBracket(value: number, unit: BracketDisplayUnit): string {
  if (unit === 'Pa') return `${paToMpa(value).toFixed(1)} MPa`
  if (unit === 'm') return `${formatMm(value, 2)} mm`
  if (unit === 'N') return `${value.toFixed(0)} N`
  if (unit === 'Nm') return `${value.toFixed(1)} N·m`
  if (unit === 'kg') return `${kgToG(value).toFixed(1)} g`
  if (unit === 'ratio') return value.toFixed(2)
  return ''
}

/** Short design description for history rows. */
export function designLabel(d: Readonly<BracketDesign>): string {
  return `t ${formatMm(d.thicknessM, 1)} · w ${formatMm(d.widthM, 0)} · flange ${formatMm(d.flangeHeightM, 0)} · r ${formatMm(d.innerRadiusM, 1)} mm`
}
