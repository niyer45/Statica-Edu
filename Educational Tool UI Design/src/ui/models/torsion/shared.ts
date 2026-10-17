import type { TorsionChallenge } from '../../../challenge/torsion/types'
import type { TorsionConstraintUnit } from '../../../evaluation/torsion/types'
import type { TorsionAction, TorsionSession } from '../../../state/torsionModel'
import { formatMm, paToMpa, radToDeg } from '../../../units/units'
import { useModelStore } from '../../state/store'

// Shared helpers for the Torsion Shaft I UI (task 47.3). Display formatting only; every value
// shown comes from a stored torsion analysis/evaluation or the challenge config.

export type StudentTorsionChallenge = Omit<TorsionChallenge, 'referenceDesign'>

/** The active torsion store; the model UI registry guarantees the active model is torsion. */
export const useTorsionStore = () => useModelStore<TorsionSession, TorsionAction, StudentTorsionChallenge>()

/** Display text for a stored torsion constraint value or limit. */
export function formatTorsion(value: number, unit: TorsionConstraintUnit): string {
  if (unit === 'rad') return `${radToDeg(value).toFixed(2)}°`
  if (unit === 'Pa') return `${paToMpa(value).toFixed(1)} MPa`
  if (unit === 'kg') return `${value.toFixed(3)} kg`
  if (unit === 'm') return `${formatMm(value, 1)} mm`
  return ''
}

export const SHAFT_SECTION_NAMES: Readonly<Record<'circle' | 'tube', string>> = { circle: 'Solid shaft', tube: 'Hollow tube' }

export const SHAFT_PARAM_LABELS: Readonly<Record<string, string>> = {
  diameterM: 'Diameter',
  outerDiameterM: 'Outer diameter',
  innerDiameterM: 'Inner diameter',
}
