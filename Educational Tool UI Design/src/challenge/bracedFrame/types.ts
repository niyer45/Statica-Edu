import type { BracedFrameDesign } from '../../geometry/bracedFrame/design'
import type { FrameJointId } from '../../geometry/bracedFrame/template'
import type { Difficulty, InteractionMode } from '../types'

// Braced Frame I challenge configuration types (task 49.2; braced-frame-1 BFR-01–BFR-09,
// multi-model-architecture MM-01/MM-02). Independent of the beam `Challenge` type, which is
// unchanged. Shared value types (Difficulty, InteractionMode, SchemaIssue, Result) are reused
// from ../types. The joint and member topology belongs to the model's template
// (geometry/bracedFrame/template.ts), not to the config, so v1 accepts exactly one template.

/** The braced-frame model identity; every braced-frame config declares it explicitly (MM-02). */
export const BRACED_FRAME_MODEL_REF = Object.freeze({ id: 'pinJointedBracedFrame', version: 1 } as const)

export type BracedFrameModelId = (typeof BRACED_FRAME_MODEL_REF)['id']

/**
 * Fields the student can never change (BFR-03): the template and its dimensions, the pinned
 * supports, the loads, the material and the presence of the six fixed members. Only
 * `materialId` and fixed-member presence appear in a design; the rest are challenge constants.
 */
export type BracedFrameLockedField = 'frame' | 'supports' | 'loads' | 'materialId' | 'fixedMembers'

export const BRACED_FRAME_LOCKED_FIELDS: readonly BracedFrameLockedField[] = Object.freeze([
  'frame',
  'supports',
  'loads',
  'materialId',
  'fixedMembers',
] as const)

export interface FrameMaterial {
  id: string
  name: string
  elasticModulusPa: number
  /** Educational nominal value, not certified; used for squash/yield capacity. */
  yieldStressPa: number
  densityKgM3: number
}

/** The single v1 template with its locked dimensions (BFR-03). */
export interface FrameGeometryConfig {
  template: 'oneBayTwoStorey'
  bayWidthM: number
  storeyHeightM: number
}

/** A static joint load, N (x to the right, y upward). */
export interface FrameJointLoad {
  jointId: FrameJointId
  fxN: number
  fyN: number
}

/** One circular hollow section of the catalog: outer diameter D and wall t (BFR-04). */
export interface ChsSection {
  id: string
  label: string
  outerDiameterM: number
  wallM: number
}

export interface BracedFrameChallenge {
  id: string
  version: number
  model: { id: BracedFrameModelId; version: 1 }
  title: string
  difficulty: Difficulty
  /** Non-empty. */
  allowedModes: InteractionMode[]
  statement: string
  material: FrameMaterial
  frame: FrameGeometryConfig
  /** Pins at j1 and j2 with both translations fixed. */
  supports: 'pinnedBases'
  /** One static load case; each joint at most once and never at a support (loader rules). */
  loads: FrameJointLoad[]
  /** Section catalog in display order (thin to thick); ids are unique. */
  sections: ChsSection[]
  initialDesign: BracedFrameDesign
  /** Test fixture / instructor demo only, never shown to students (BFR-05). */
  referenceDesign?: BracedFrameDesign
  lockedFields: BracedFrameLockedField[]
  constraints: {
    /** Limit on |roof drift|, m. */
    maxRoofDriftM: number
    /** Limit on the maximum member utilization |N|/capacity (ratio). */
    maxUtilization: number
    maxMassKg: number
  }
  /** 1-based, non-baseline iteration numbers. */
  predictionPolicy: { requiredOnIterations: number[] }
  reflectionPrompt: { id: string; text: string }
  /** Display-only deformed shape: stored displacements × factor, capped (BFR-16). */
  visualization: { displacementExaggeration: number; maxVisualDisplacementM: number }
}
