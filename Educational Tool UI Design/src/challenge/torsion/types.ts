import type { TorsionDesign, TorsionSectionKind } from '../../geometry/torsion/design'
import type { Difficulty, InteractionMode, ParamRange } from '../types'

// Torsion Shaft I challenge configuration types (task 47.2; torsion-shaft-1 TSH-01–TSH-09,
// multi-model-architecture MM-01/MM-02). Independent of the beam `Challenge` type, which is
// unchanged. Shared value types (Difficulty, InteractionMode, ParamRange, SchemaIssue, Result)
// are reused from ../types.

/** The torsion model identity; every torsion config declares it explicitly (MM-02). */
export const TORSION_MODEL_REF = Object.freeze({ id: 'circularShaftTorsion', version: 1 } as const)

export type TorsionModelId = (typeof TORSION_MODEL_REF)['id']

/** Fields the student can never change (TSH-03). `lengthM`/`materialId` are design fields. */
export type TorsionLockedField = 'lengthM' | 'materialId' | 'torqueNm' | 'support'

export const TORSION_LOCKED_FIELDS: readonly TorsionLockedField[] = Object.freeze([
  'lengthM',
  'materialId',
  'torqueNm',
  'support',
] as const)

export interface TorsionMaterial {
  id: string
  name: string
  shearModulusPa: number
  densityKgM3: number
  /** Educational nominal value, not certified. */
  allowableShearStressPa: number
  /** Used only for the applicability (plasticity) screen. */
  yieldShearStressPa: number
}

export interface TorsionSectionLimits {
  circle: { diameterM: ParamRange }
  tube: { outerDiameterM: ParamRange; minWallM: number }
}

/** Wall used when switching to a tube (TSH-04). */
export interface TorsionSectionDefaults {
  tubeWallM: number
}

export interface TorsionChallenge {
  id: string
  version: number
  model: { id: TorsionModelId; version: 1 }
  title: string
  difficulty: Difficulty
  /** Non-empty. */
  allowedModes: InteractionMode[]
  statement: string
  material: TorsionMaterial
  /** Shaft length; equals initialDesign.lengthM (loader cross-field rule). */
  lengthM: number
  /** Steady torque applied at the free end, N·m. */
  torqueNm: number
  /** The opposite end is fixed against rotation. */
  support: 'fixedEnd'
  initialDesign: TorsionDesign
  /** Test fixture / instructor demo only, never shown to students (TSH-05). */
  referenceDesign?: TorsionDesign
  lockedFields: TorsionLockedField[]
  constraints: {
    maxTwistRad: number
    maxShearStressPa: number
    maxMassKg: number
    maxOuterDiameterM: number
  }
  sectionLimits: TorsionSectionLimits
  sectionDefaults: TorsionSectionDefaults
  allowedSections: TorsionSectionKind[]
  /** 1-based, non-baseline iteration numbers. */
  predictionPolicy: { requiredOnIterations: number[] }
  reflectionPrompt: { id: string; text: string }
  /** Display-only twist line: stored angle × factor, capped at maxVisualTwistRad (TSH-14). */
  visualization: { twistExaggerationFactor: number; maxVisualTwistRad: number }
}
