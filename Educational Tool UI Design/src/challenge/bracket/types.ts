import type { BracketDesign } from '../../geometry/bracket/design'
import type { Difficulty, InteractionMode, ParamRange } from '../types'

// Mounting Bracket I challenge configuration types (task 46.2; mounting-bracket-1 MBR-01–MBR-10,
// multi-model-architecture MM-01/MM-02). Independent of the beam `Challenge` type, which is
// unchanged. Shared value types (Difficulty, InteractionMode, ParamRange, SchemaIssue, Result)
// are reused from ../types. The Kt coefficient table, its validity condition, the branch rule and
// the screen thresholds are model constants (physics/bracket/constants.ts), never configuration
// (MBR-13).

/** The bracket model identity; every bracket config declares it explicitly (MM-02). */
export const BRACKET_MODEL_REF = Object.freeze({ id: 'steppedBarBracket', version: 1 } as const)

export type BracketModelId = (typeof BRACKET_MODEL_REF)['id']

/**
 * Fields the student can never change (MBR-04). `materialId` is a design field; length,
 * thickness, force and support are challenge constants, so no design can change them.
 */
export type BracketLockedField = 'lengthM' | 'thicknessM' | 'materialId' | 'forceN' | 'support'

export const BRACKET_LOCKED_FIELDS: readonly BracketLockedField[] = Object.freeze([
  'lengthM',
  'thicknessM',
  'materialId',
  'forceN',
  'support',
] as const)

export interface BracketMaterial {
  id: string
  name: string
  elasticModulusPa: number
  densityKgM3: number
  /** Educational nominal value, not certified. */
  allowableStressPa: number
  /** Used only for the applicability (plasticity) screen. */
  yieldStressPa: number
}

/** Ranges of the four adjustable dimensions (MBR-05). `stepM` is the control grid. */
export interface BracketDesignLimits {
  rootDepthM: ParamRange
  armDepthM: ParamRange
  stepLocationM: ParamRange
  filletRadiusM: ParamRange
}

export interface BracketChallenge {
  id: string
  version: number
  model: { id: BracketModelId; version: 1 }
  title: string
  difficulty: Difficulty
  /** Non-empty. */
  allowedModes: InteractionMode[]
  statement: string
  material: BracketMaterial
  /** Cantilever length L from the wall clamp to the tip force, m. */
  lengthM: number
  /** Out-of-plane thickness b, m. */
  thicknessM: number
  /** Rigid wall clamp at x = 0. */
  support: 'wallClamp'
  /** Static tip force at the free end, in the plane of the depth. */
  load: { forceN: number; location: 'freeEnd'; direction: 'down' }
  initialDesign: BracketDesign
  /** Test fixture / instructor demo only, never shown to students (MBR-06). */
  referenceDesign?: BracketDesign
  lockedFields: BracketLockedField[]
  constraints: {
    maxPeakStressPa: number
    maxTipDeflectionM: number
    maxMassKg: number
    maxEnvelopeDepthM: number
  }
  designLimits: BracketDesignLimits
  /** 1-based, non-baseline iteration numbers. */
  predictionPolicy: { requiredOnIterations: number[] }
  reflectionPrompt: { id: string; text: string }
}
