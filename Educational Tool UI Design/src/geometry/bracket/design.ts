import { z } from 'zod'

// Mounting Bracket I design types and structural schema (task 55 L-bracket). The bracket is a
// bolted L (angle) bracket of constant thickness t and width w: a vertical flange of outer height
// H lies flat against the wall, and a horizontal arm leaves the bend at the bottom of the flange.
// The bend has inner radius r_i (outer radius r_i + t). The load offset, arm overhang, force,
// bolts and support are challenge constants, so they are not design fields; materialId is a
// locked design field, as for the other models.

/** The four adjustable dimensions, in control and validation order. */
export type BracketParam = 'thicknessM' | 'widthM' | 'flangeHeightM' | 'innerRadiusM'

export const BRACKET_PARAMS: readonly BracketParam[] = Object.freeze([
  'thicknessM',
  'widthM',
  'flangeHeightM',
  'innerRadiusM',
] as const)

export interface BracketDesign {
  id: string
  /** Plate thickness t of the flange, bend and arm, m. */
  thicknessM: number
  /** Bracket width w across the wall (out of the bending plane), m. */
  widthM: number
  /** Outer flange height H, from the underside of the arm to the top of the flange, m. */
  flangeHeightM: number
  /** Inner bend radius r_i, m. */
  innerRadiusM: number
  materialId: string
}

const lengthM = z.number().finite().positive()

/** Structural shape only; ranges live in the validator (geometry/bracket/validate.ts). */
export const bracketDesignSchema = z
  .object({
    id: z.string().min(1),
    thicknessM: lengthM,
    widthM: lengthM,
    flangeHeightM: lengthM,
    innerRadiusM: lengthM,
    materialId: z.string().min(1),
  })
  .strict()

// Compile-time guarantee that the schema and the hand-written type stay identical.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const designTypesMatch: Equal<z.infer<typeof bracketDesignSchema>, BracketDesign> = true
void designTypesMatch
