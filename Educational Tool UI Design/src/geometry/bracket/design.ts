import { z } from 'zod'

// Mounting Bracket I design types and structural schema (task 46.2; mounting-bracket-1
// MBR-04–MBR-06). The bracket is a symmetric stepped flat bar: root depth D over 0 ≤ x < a, arm
// depth d over a ≤ x ≤ L, with opposite shoulder fillets of radius r at x = a. Length, thickness,
// force and support are challenge constants, so they are not design fields; materialId is a
// locked design field, as for the other models. d = D (as stored values) is a uniform bar.

/** The four adjustable dimensions, in control and validation order. */
export type BracketParam = 'rootDepthM' | 'armDepthM' | 'stepLocationM' | 'filletRadiusM'

export const BRACKET_PARAMS: readonly BracketParam[] = Object.freeze([
  'rootDepthM',
  'armDepthM',
  'stepLocationM',
  'filletRadiusM',
] as const)

export interface BracketDesign {
  id: string
  /** Root (wall-side, envelope) depth D, m. */
  rootDepthM: number
  /** Arm (tip-side) depth d ≤ D, m. */
  armDepthM: number
  /** Distance a from the wall clamp to the shoulder plane, m. */
  stepLocationM: number
  /** Shoulder fillet radius r, m. Has no effect on a uniform bar. */
  filletRadiusM: number
  materialId: string
}

const lengthM = z.number().finite().positive()

/** Structural shape only; ranges and d ≤ D live in the validator (geometry/bracket/validate.ts). */
export const bracketDesignSchema = z
  .object({
    id: z.string().min(1),
    rootDepthM: lengthM,
    armDepthM: lengthM,
    stepLocationM: lengthM,
    filletRadiusM: lengthM,
    materialId: z.string().min(1),
  })
  .strict()

/** True iff the design has no step: d = D as stored values (MBR-12). */
export function isUniformBar(d: Pick<BracketDesign, 'rootDepthM' | 'armDepthM'>): boolean {
  return d.armDepthM === d.rootDepthM
}

// Compile-time guarantee that the schema and the hand-written type stay identical.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const designTypesMatch: Equal<z.infer<typeof bracketDesignSchema>, BracketDesign> = true
void designTypesMatch
