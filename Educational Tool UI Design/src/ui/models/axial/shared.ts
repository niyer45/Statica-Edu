import { axialMaterial, type AxialChallenge } from '../../../challenge/axial/types'
import type { AxialConstraintUnit } from '../../../evaluation/axial/types'
import type { AxialDesign } from '../../../geometry/axial/design'
import type { AxialAction, AxialSession } from '../../../state/axialModel'
import { formatFixed, formatMm, formatPercent, m2ToMm2, paToMpa } from '../../../units/units'
import { useModelStore } from '../../state/store'

// Shared helpers for the Stress and Strain I UI (task 72). Display formatting only; every value
// shown comes from a stored rod analysis/evaluation or the challenge config.

export type StudentAxialChallenge = Omit<AxialChallenge, 'referenceDesign'>

/** The active rod store; the model UI registry guarantees the active model is the rod. */
export const useAxialStore = () => useModelStore<AxialSession, AxialAction, StudentAxialChallenge>()

/** Display units of stored rod values. */
export type AxialDisplayUnit = AxialConstraintUnit | 'diameter' | 'strain' | 'area' | 'modulus' | 'stiffness' | 'ratio'

/** Display text for a stored rod value or limit. */
export function formatAxial(value: number, unit: AxialDisplayUnit): string {
  if (unit === 'Pa') return `${paToMpa(value).toFixed(1)} MPa`
  if (unit === 'm') return `${formatMm(value, 2)} mm`
  if (unit === 'diameter') return `${formatMm(value, 1)} mm`
  if (unit === 'kg') return `${value.toFixed(3)} kg`
  if (unit === 'strain') return `${formatPercent(value, 3)} %`
  if (unit === 'area') return `${m2ToMm2(value).toFixed(1)} mm²`
  if (unit === 'modulus') return `${formatFixed(value / 1e9, 0)} GPa`
  if (unit === 'stiffness') return `${formatFixed(value / 1e6, 2)} kN/mm`
  if (unit === 'ratio') return value.toFixed(2)
  return ''
}

/** Full material name for a design, or its id when it is not listed. */
export function materialName(ch: Pick<StudentAxialChallenge, 'materials'>, id: string): string {
  return axialMaterial(ch, id)?.name ?? id
}

/** Digit-free short material name, as explanation facts quote it. */
export function materialShortName(ch: Pick<StudentAxialChallenge, 'materials'>, id: string): string {
  return axialMaterial(ch, id)?.shortName ?? id
}

/** Short design description for history rows: "Ø13.0 mm · Steel". */
export function designLabel(d: Readonly<AxialDesign>, ch: Pick<StudentAxialChallenge, 'materials'>): string {
  return `Ø${formatMm(d.diameterM, 1)} mm · ${materialShortName(ch, d.materialId)}`
}

/**
 * Display-only stretch (SSR-15): the stored, latest tested elongation × the configured
 * exaggeration, capped at a fraction of the rod length, expressed as a fraction of the length so
 * either drawing can apply it to its own drawn length. Shared by the 2D and 3D views.
 */
export function displayedStretch(
  testedM: number,
  lengthM: number,
  visualization: Readonly<StudentAxialChallenge['visualization']>,
): { fractionOfLength: number; capped: boolean } {
  const scaled = (testedM * visualization.elongationExaggerationFactor) / lengthM
  const fractionOfLength = Math.min(scaled, visualization.maxVisualElongationFractionOfL)
  return { fractionOfLength, capped: fractionOfLength < scaled }
}
