import type { VesselChallenge } from '../../../challenge/vessel/types'
import type { VesselConstraintResult, VesselConstraintUnit } from '../../../evaluation/vessel/types'
import type { VesselDesign } from '../../../geometry/vessel/design'
import { VESSEL_SOURCE_NOTE } from '../../../physics/vessel/constants'
import type { VesselAction, VesselSession } from '../../../state/vesselModel'
import { formatMm, m3ToL, paToMpa } from '../../../units/units'
import { useModelStore } from '../../state/store'

// Shared helpers for the Pressure Vessel I UI (task 69). Display formatting only; every value
// shown comes from a stored vessel analysis/evaluation or the challenge config.

export type StudentVesselChallenge = Omit<VesselChallenge, 'referenceDesign'>

/** The active vessel store; the model UI registry guarantees the active model is the vessel. */
export const useVesselStore = () => useModelStore<VesselSession, VesselAction, StudentVesselChallenge>()

/** Source disclosure for the model limits and help text. */
export const VESSEL_SOURCE_DISCLOSURE = `This model uses ${VESSEL_SOURCE_NOTE}.`

/** Display units of stored vessel values; `ratio` is dimensionless (r / t). */
export type VesselDisplayUnit = VesselConstraintUnit | 'ratio'

/** Display text for a stored vessel value or limit. */
export function formatVessel(value: number, unit: VesselDisplayUnit): string {
  if (unit === 'Pa') return `${paToMpa(value).toFixed(1)} MPa`
  if (unit === 'm3') return `${m3ToL(value).toFixed(1)} L`
  if (unit === 'm') return `${formatMm(value, 0)} mm`
  if (unit === 'kg') return `${value.toFixed(2)} kg`
  if (unit === 'ratio') return value.toFixed(1)
  return ''
}

/** Display text for a constraint's limit; a minimum reads "at least …" (never by symbol alone). */
export function formatLimit(c: Pick<VesselConstraintResult, 'limit' | 'unit' | 'bound'>): string {
  const text = formatVessel(c.limit, c.unit)
  return c.bound === 'min' ? `at least ${text}` : text
}

/** Short design description for history rows. */
export function designLabel(d: Readonly<VesselDesign>): string {
  return `Ø${formatMm(d.innerDiameterM, 0)} · L ${formatMm(d.shellLengthM, 0)} · shell ${formatMm(d.shellThicknessM, 1)} · heads ${formatMm(d.headThicknessM, 1)} mm`
}
