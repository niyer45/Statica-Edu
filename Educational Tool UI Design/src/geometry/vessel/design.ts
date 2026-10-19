import { z } from 'zod'

// Pressure Vessel I design types and structural schema (task 69, model `thinWallPressureVessel`
// v1; .kiro/specs/pressure-vessel-1 PVS-04). A closed vessel: a cylindrical shell of inner
// diameter D_i, length L (heads excluded) and wall t_s, closed by two hemispherical heads of the
// same inner radius and wall t_h. Pressure, head shape, material and design factor are challenge
// constants; materialId is a locked design field, as for the other models.

/** The four adjustable dimensions, in control and validation order. */
export type VesselParam = 'innerDiameterM' | 'shellLengthM' | 'shellThicknessM' | 'headThicknessM'

export const VESSEL_PARAMS: readonly VesselParam[] = Object.freeze([
  'innerDiameterM',
  'shellLengthM',
  'shellThicknessM',
  'headThicknessM',
] as const)

export interface VesselDesign {
  id: string
  /** Inner diameter D_i of the shell and the heads, m. */
  innerDiameterM: number
  /** Length L of the cylindrical shell between the two head junctions, m. */
  shellLengthM: number
  /** Shell wall thickness t_s, m. */
  shellThicknessM: number
  /** Head wall thickness t_h, m. */
  headThicknessM: number
  materialId: string
}

const lengthM = z.number().finite().positive()

/** Structural shape only; ranges live in the validator (geometry/vessel/validate.ts). */
export const vesselDesignSchema = z
  .object({
    id: z.string().min(1),
    innerDiameterM: lengthM,
    shellLengthM: lengthM,
    shellThicknessM: lengthM,
    headThicknessM: lengthM,
    materialId: z.string().min(1),
  })
  .strict()

// Compile-time guarantee that the schema and the hand-written type stay identical.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const designTypesMatch: Equal<z.infer<typeof vesselDesignSchema>, VesselDesign> = true
void designTypesMatch
