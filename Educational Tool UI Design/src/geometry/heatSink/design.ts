import { z } from 'zod'

// Heat Sink I design types and structural schema (task 48.2; heat-sink-1 HSK-03–HSK-05).
// The design is a straight rectangular plate-fin array on a fixed base: N evenly spaced fins of
// thickness t and height H (above the base surface) that span the full base depth, with the
// outer fins flush with the base edges. There is no orientation: fins always run parallel to the
// configured airflow. Base, heat load, ambient temperature and convection are challenge
// constants, so they are not design fields; materialId is a locked design field.

export interface HeatSinkDesign {
  id: string
  /** N, an integer ≥ 2 (ranges and integrality live in the validator). */
  finCount: number
  /** t, metres. */
  finThicknessM: number
  /** H above the base surface, metres. */
  finHeightM: number
  materialId: string
}

/** The fin parameters a student can change, in display and validation order. */
export type FinArray = Pick<HeatSinkDesign, 'finCount' | 'finThicknessM' | 'finHeightM'>

/**
 * Fin gap s = (W − N t)/(N − 1), metres: the clear spacing between neighboring fins when the
 * outer fins are flush with the base edges. Undefined (division by zero) for N = 1, so callers
 * check N ≥ 2 first. The single source of this formula for validation, edits and analysis.
 */
export function finGap(baseWidthM: number, finCount: number, finThicknessM: number): number {
  return (baseWidthM - finCount * finThicknessM) / (finCount - 1)
}

const lengthM = z.number().finite().positive()

/** Structural shape only; integrality, ranges, steps and the gap floor live in the validator. */
export const heatSinkDesignSchema = z
  .object({
    id: z.string().min(1),
    finCount: z.number().finite(),
    finThicknessM: lengthM,
    finHeightM: lengthM,
    materialId: z.string().min(1),
  })
  .strict()

// Compile-time guarantee that the schema and the hand-written type stay identical.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const designTypesMatch: Equal<z.infer<typeof heatSinkDesignSchema>, HeatSinkDesign> = true
void designTypesMatch
