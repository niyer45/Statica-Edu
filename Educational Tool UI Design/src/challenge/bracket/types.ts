import type { BracketDesign } from '../../geometry/bracket/design'
import type { Difficulty, InteractionMode, ParamRange } from '../types'

// Mounting Bracket I challenge configuration types (task 55 L-bracket rebuild; replaces the
// task 46.2 stepped-bar configuration; multi-model-architecture MM-01/MM-02/MM-04). Independent
// of the beam `Challenge` type, which is unchanged. Shared value types (Difficulty,
// InteractionMode, ParamRange, SchemaIssue, Result) are reused from ../types. The curved-beam
// validity limit and the screen thresholds are model constants (physics/bracket/constants.ts),
// never configuration.
//
// The bracket is a bolted L (angle) bracket: a vertical flange lies flat against the wall and is
// held by one row of bolts across its width; a horizontal arm leaves the bend at the bottom of
// the flange and carries a hanging load at a fixed distance from the wall.

/**
 * The bracket model identity; every bracket config declares it explicitly (MM-02). A new id, not
 * a new version of `steppedBarBracket`, because ids are never reused for a different formulation
 * (MM-01).
 */
export const BRACKET_MODEL_REF = Object.freeze({ id: 'boltedLBracket', version: 1 } as const)

export type BracketModelId = (typeof BRACKET_MODEL_REF)['id']

/**
 * Fields the student can never change. `materialId` is a design field; the load offset, force,
 * bolts and support are challenge constants, so no design can change them.
 */
export type BracketLockedField = 'loadOffsetM' | 'materialId' | 'forceN' | 'bolts' | 'support'

export const BRACKET_LOCKED_FIELDS: readonly BracketLockedField[] = Object.freeze([
  'loadOffsetM',
  'materialId',
  'forceN',
  'bolts',
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

/** Ranges of the four adjustable dimensions. `stepM` is the control grid. */
export interface BracketDesignLimits {
  thicknessM: ParamRange
  widthM: ParamRange
  flangeHeightM: ParamRange
  innerRadiusM: ParamRange
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
  /** Horizontal distance a from the wall face to the load line, m. */
  loadOffsetM: number
  /** Arm length beyond the load line, m. Adds mass; no other effect. */
  tipOverhangM: number
  /**
   * One row of `count` bolts across the flange width, at `edgeDistanceM` below the top of the
   * flange. The bolts share the overturning tension equally.
   */
  bolts: { count: number; edgeDistanceM: number }
  /** The flange is bolted flat to a rigid wall; it bears on the wall at its heel. */
  support: 'boltedWall'
  /** Static vertical force hanging from the arm at the load line, spread across the arm width. */
  load: { forceN: number; location: 'loadLine'; direction: 'down' }
  initialDesign: BracketDesign
  /** Test fixture / instructor demo only, never shown to students. */
  referenceDesign?: BracketDesign
  lockedFields: BracketLockedField[]
  constraints: {
    maxBendStressPa: number
    maxDeflectionM: number
    /** Allowable tension per bolt, N. */
    maxBoltTensionN: number
    maxMassKg: number
  }
  designLimits: BracketDesignLimits
  /** 1-based, non-baseline iteration numbers. */
  predictionPolicy: { requiredOnIterations: number[] }
  reflectionPrompt: { id: string; text: string }
}
