import { z } from 'zod'

// Fatigue Analysis I design types and structural schema (task 70; FAT-03, FAT-05). The component
// is a non-rotating stepped stub-axle spindle: a collar of diameter D held in its housing, a
// neck of diameter d carrying the wheel load, and a shoulder fillet of radius r between them.
// The surface finish applies at the fillet. Lengths, load, support and material are challenge
// constants (materialId is a locked design field, as for the other models).

/** The three adjustable dimensions, in control and validation order. */
export type FatigueParam = 'neckDiameterM' | 'collarDiameterM' | 'filletRadiusM'

export const FATIGUE_PARAMS: readonly FatigueParam[] = Object.freeze(['neckDiameterM', 'collarDiameterM', 'filletRadiusM'] as const)

/** Surface finishes the model knows (coefficients in physics/fatigue/constants.ts). */
export type SurfaceFinishId = 'ground' | 'machined' | 'asForged'

export const SURFACE_FINISH_IDS: readonly [SurfaceFinishId, ...SurfaceFinishId[]] = Object.freeze(['ground', 'machined', 'asForged'] as const) as unknown as readonly [
  SurfaceFinishId,
  ...SurfaceFinishId[],
]

export interface FatigueDesign {
  id: string
  /** Neck diameter d, where the wheel load is carried, m. */
  neckDiameterM: number
  /** Collar diameter D, held in the housing, m. */
  collarDiameterM: number
  /** Shoulder fillet radius r between the collar and the neck, m. */
  filletRadiusM: number
  /** Surface finish at the fillet. */
  surfaceFinish: SurfaceFinishId
  materialId: string
}

const lengthM = z.number().finite().positive()

export const surfaceFinishSchema = z.enum(['ground', 'machined', 'asForged'])

/** Structural shape only; ranges and the fillet-fits-the-step rule live in the validator. */
export const fatigueDesignSchema = z
  .object({
    id: z.string().min(1),
    neckDiameterM: lengthM,
    collarDiameterM: lengthM,
    filletRadiusM: lengthM,
    surfaceFinish: surfaceFinishSchema,
    materialId: z.string().min(1),
  })
  .strict()

// Compile-time guarantee that the schema and the hand-written type stay identical.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const designTypesMatch: Equal<z.infer<typeof fatigueDesignSchema>, FatigueDesign> = true
void designTypesMatch

/** Shoulder height h = (D − d)/2, m. Pure geometry, shared by validation, physics and drawings. */
export function shoulderHeightM(d: Pick<FatigueDesign, 'neckDiameterM' | 'collarDiameterM'>): number {
  return (d.collarDiameterM - d.neckDiameterM) / 2
}
