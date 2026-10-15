import { z } from 'zod'

// Section and design types shared by every domain module.
// Task 5.1 extends this file (validation helpers, tolerances); this part is types + zod schemas only.

export type Section =
  | { kind: 'circle'; diameterM: number }
  | { kind: 'tube'; outerDiameterM: number; innerDiameterM: number }
  | { kind: 'rectangle'; widthM: number; heightM: number }
  | {
      kind: 'iSection'
      widthM: number
      heightM: number
      flangeThicknessM: number
      webThicknessM: number
    }

export type Orientation = 0 | 90

export interface BeamDesign {
  id: string
  section: Section
  orientationDeg: Orientation
  lengthM: number
  materialId: string
}

const lengthM = z.number().finite().positive()

/** Structural shape only; geometric rules (wall thickness, flange overlap, ranges) live in validators. */
export const sectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('circle'), diameterM: lengthM }).strict(),
  z
    .object({ kind: z.literal('tube'), outerDiameterM: lengthM, innerDiameterM: lengthM })
    .strict(),
  z.object({ kind: z.literal('rectangle'), widthM: lengthM, heightM: lengthM }).strict(),
  z
    .object({
      kind: z.literal('iSection'),
      widthM: lengthM,
      heightM: lengthM,
      flangeThicknessM: lengthM,
      webThicknessM: lengthM,
    })
    .strict(),
])

export const orientationSchema = z.union([z.literal(0), z.literal(90)])

export const beamDesignSchema = z
  .object({
    id: z.string().min(1),
    section: sectionSchema,
    orientationDeg: orientationSchema,
    lengthM,
    materialId: z.string().min(1),
  })
  .strict()

/** Absolute geometric tolerance in metres used by validation and range checks. */
export const GEOM_TOL = 1e-9

export type GeometryErrorCode =
  | 'NON_FINITE'
  | 'NON_POSITIVE'
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'INNER_NOT_LESS_THAN_OUTER'
  | 'WALL_TOO_THIN'
  | 'FLANGES_OVERLAP'
  | 'WEB_WIDER_THAN_FLANGE'
  | 'FLANGE_TOO_THIN'
  | 'WEB_TOO_THIN'
  | 'SECTION_NOT_ALLOWED'
  | 'LOCKED_FIELD_CHANGED'
  | 'BAD_ORIENTATION'

export interface GeometryError {
  code: GeometryErrorCode
  param?: string
  message: string
}

/** Point in section-local coordinates (u horizontal = width b, v vertical = height h), metres. */
export interface Vec2 {
  u: number
  v: number
}

/**
 * Unrotated bounding box in section-local axes: widthM along u (b), heightM along v (h).
 * Circle: b = h = d. Tube: b = h = D. Rectangle / I-section: widthM × heightM.
 */
export function sectionBoundingBox(s: Section): { widthM: number; heightM: number } {
  switch (s.kind) {
    case 'circle':
      return { widthM: s.diameterM, heightM: s.diameterM }
    case 'tube':
      return { widthM: s.outerDiameterM, heightM: s.outerDiameterM }
    case 'rectangle':
    case 'iSection':
      return { widthM: s.widthM, heightM: s.heightM }
  }
}

// Compile-time guarantee that the schemas and the hand-written types stay identical.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const sectionTypesMatch: Equal<z.infer<typeof sectionSchema>, Section> = true
const designTypesMatch: Equal<z.infer<typeof beamDesignSchema>, BeamDesign> = true
void sectionTypesMatch
void designTypesMatch
