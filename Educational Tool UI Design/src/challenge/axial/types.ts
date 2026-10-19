import type { AxialDesign } from '../../geometry/axial/design'
import type { Difficulty, InteractionMode, ParamRange } from '../types'

// Stress and Strain I challenge configuration types (task 72; stress-strain-1 SSR-01–SSR-09,
// multi-model-architecture MM-01/MM-02). Independent of the beam `Challenge` type, which is
// unchanged. Shared value types (Difficulty, InteractionMode, ParamRange, SchemaIssue, Result)
// are reused from ../types.
//
// A vertical hanger (tie) rod hangs from a rigid roof beam and carries a static tensile load
// through its centroid. The student chooses the rod diameter and its material from a short list.

/** The axial-rod model identity; every config declares it explicitly (MM-02). New id (MM-01). */
export const AXIAL_MODEL_REF = Object.freeze({ id: 'axialTieRod', version: 1 } as const)

export type AxialModelId = (typeof AXIAL_MODEL_REF)['id']

/** Fields the student can never change (SSR-03). All four are challenge constants. */
export type AxialLockedField = 'lengthM' | 'forceN' | 'designFactor' | 'support'

export const AXIAL_LOCKED_FIELDS: readonly AxialLockedField[] = Object.freeze([
  'lengthM',
  'forceN',
  'designFactor',
  'support',
] as const)

/** A rod material. Typical textbook values, stated as such in the workbench; not certified data. */
export interface AxialMaterial {
  id: string
  /** Full student-facing name (may contain an alloy designation such as 6061-T6). */
  name: string
  /** Digit-free short name (loader rule), quoted by explanation facts so they stay grounded. */
  shortName: string
  /** Young's modulus E, Pa. */
  elasticModulusPa: number
  /** Yield strength σ_y, Pa. The stress check's limit is σ_y / designFactor. */
  yieldStressPa: number
  densityKgM3: number
}

export interface AxialChallenge {
  id: string
  version: number
  model: { id: AxialModelId; version: 1 }
  title: string
  difficulty: Difficulty
  /** Non-empty. */
  allowedModes: InteractionMode[]
  statement: string
  /** Rod length between the pins, m. */
  lengthM: number
  /** Static tensile load through the centroid, N. */
  forceN: number
  /** Design factor n on yield: allowable stress = σ_y / n. */
  designFactor: number
  /** Pinned to a rigid roof beam at the top; the load hangs from the bottom pin. */
  support: 'pinnedTop'
  /** Non-empty, unique ids, in display order. */
  materials: AxialMaterial[]
  initialDesign: AxialDesign
  /** Test fixture / instructor demo only, never shown to students (SSR-05). */
  referenceDesign?: AxialDesign
  lockedFields: AxialLockedField[]
  constraints: {
    maxElongationM: number
    maxMassKg: number
  }
  /** Diameter range; `stepM` is the control grid (not a validity rule). */
  diameterLimits: ParamRange
  /** 1-based, non-baseline iteration numbers. */
  predictionPolicy: { requiredOnIterations: number[] }
  reflectionPrompt: { id: string; text: string }
  /** Display-only stretch: stored elongation × factor, capped at a fraction of the length (SSR-15). */
  visualization: { elongationExaggerationFactor: number; maxVisualElongationFractionOfL: number }
}

/** The material a design names, or undefined when it is not listed. */
export function axialMaterial(ch: Pick<AxialChallenge, 'materials'>, id: string): AxialMaterial | undefined {
  return ch.materials.find((m) => m.id === id)
}
