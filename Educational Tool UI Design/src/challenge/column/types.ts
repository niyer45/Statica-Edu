import type { ColumnDesign, ColumnSectionKind } from '../../geometry/column/design'
import type { Difficulty, InteractionMode, ParamRange } from '../types'

// Column Buckling I challenge configuration types (task 68; column-buckling-1 CBK-01–CBK-10,
// multi-model-architecture MM-01/MM-02). Independent of the beam `Challenge` type, which is
// unchanged. Shared value types (Difficulty, InteractionMode, ParamRange, SchemaIssue, Result) are
// reused from ../types. The effective-length factor follows from the support (a model constant in
// physics/column/constants.ts), and the screen thresholds are model constants, never configuration.

/** The column model identity; every column config declares it explicitly (MM-02). */
export const COLUMN_MODEL_REF = Object.freeze({ id: 'eulerColumnBuckling', version: 1 } as const)

export type ColumnModelId = (typeof COLUMN_MODEL_REF)['id']

/** Fields the student can never change (CBK-04). `lengthM`/`materialId` are design fields. */
export type ColumnLockedField = 'lengthM' | 'materialId' | 'forceN' | 'support'

export const COLUMN_LOCKED_FIELDS: readonly ColumnLockedField[] = Object.freeze([
  'lengthM',
  'materialId',
  'forceN',
  'support',
] as const)

/** End conditions offered by the model. Only ideal pins at both ends (K = 1) in version 1. */
export type ColumnSupport = 'pinnedPinned'

export interface ColumnMaterial {
  id: string
  name: string
  elasticModulusPa: number
  densityKgM3: number
  /** Educational nominal allowable axial (compressive) stress, not certified. */
  allowableStressPa: number
  /** Used only for the Euler-range (Johnson transition) applicability screen. */
  yieldStressPa: number
}

export interface ColumnSectionLimits {
  solid: { diameterM: ParamRange }
  tube: { outerDiameterM: ParamRange; wallThicknessM: ParamRange }
}

/** Wall used when switching to a tube (CBK-05). */
export interface ColumnSectionDefaults {
  tubeWallM: number
}

export interface ColumnChallenge {
  id: string
  version: number
  model: { id: ColumnModelId; version: 1 }
  title: string
  difficulty: Difficulty
  /** Non-empty. */
  allowedModes: InteractionMode[]
  statement: string
  material: ColumnMaterial
  /** Length between the pins; equals every design's lengthM (loader cross-field rule). */
  lengthM: number
  support: ColumnSupport
  /** Concentric axial compressive load applied at the top, through the centroid. */
  load: { forceN: number; direction: 'down'; location: 'centroid' }
  initialDesign: ColumnDesign
  /** Test fixture / instructor demo only, never shown to students (CBK-06). */
  referenceDesign?: ColumnDesign
  lockedFields: ColumnLockedField[]
  constraints: {
    /** The critical load must be at least this multiple of the load (a minimum check). */
    minBucklingSafetyFactor: number
    maxAxialStressPa: number
    maxMassKg: number
  }
  sectionLimits: ColumnSectionLimits
  sectionDefaults: ColumnSectionDefaults
  allowedSections: ColumnSectionKind[]
  /** 1-based, non-baseline iteration numbers. */
  predictionPolicy: { requiredOnIterations: number[] }
  reflectionPrompt: { id: string; text: string }
}
