import { z } from 'zod'

// Stress and Strain I design type and structural schema (task 72; stress-strain-1 SSR-04). The
// student chooses the diameter of a solid circular rod and one of the challenge's materials.
// Length, load, design factor and support are challenge constants (locked fields), so they are
// not design fields. The diameter range and material membership live in the validator
// (geometry/axial/validate.ts); the 0.5 mm step is input granularity only.

export interface AxialDesign {
  id: string
  /** Rod diameter d, m. */
  diameterM: number
  /** One of the challenge's material ids. */
  materialId: string
}

/** The adjustable parameters, in control and validation order. */
export type AxialParam = 'diameterM' | 'materialId'

/** Structural shape only; the range and material membership live in the validator. */
export const axialDesignSchema = z
  .object({
    id: z.string().min(1),
    diameterM: z.number().finite().positive(),
    materialId: z.string().min(1),
  })
  .strict()

// Compile-time guarantee that the schema and the hand-written type stay identical.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const designTypesMatch: Equal<z.infer<typeof axialDesignSchema>, AxialDesign> = true
void designTypesMatch
