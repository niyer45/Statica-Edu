import type { FatigueDesign, SurfaceFinishId } from '../../geometry/fatigue/design'
import type { Difficulty, InteractionMode, ParamRange } from '../types'

// Fatigue Analysis I challenge configuration types (task 70; FAT-01–FAT-06, multi-model-architecture
// MM-01/MM-02). Independent of the other models' challenge types. Correlation coefficients, the
// equivalent-diameter factor and the screen limits are model constants
// (physics/fatigue/constants.ts), never configuration.
//
// The component is a non-rotating stub-axle spindle held by its collar; a wheel load on the neck
// fluctuates between F_m − F_a and F_m + F_a every cycle, bending the shoulder fillet.

/** The fatigue model identity; every fatigue config declares it explicitly (MM-02). */
export const FATIGUE_MODEL_REF = Object.freeze({ id: 'steppedShaftFatigue', version: 1 } as const)

export type FatigueModelId = (typeof FATIGUE_MODEL_REF)['id']

/** Fields the student can never change. `materialId` is a design field; the rest are challenge constants. */
export type FatigueLockedField = 'materialId' | 'load' | 'geometry' | 'support'

export const FATIGUE_LOCKED_FIELDS: readonly FatigueLockedField[] = Object.freeze(['materialId', 'load', 'geometry', 'support'] as const)

export interface FatigueMaterial {
  id: string
  name: string
  /** Educational nominal values, not certified. */
  ultimateStrengthPa: number
  yieldStrengthPa: number
  densityKgM3: number
}

/** Ranges of the three adjustable dimensions. `stepM` is the control grid. */
export interface FatigueDesignLimits {
  neckDiameterM: ParamRange
  collarDiameterM: ParamRange
  filletRadiusM: ParamRange
}

export interface FatigueChallenge {
  id: string
  version: number
  model: { id: FatigueModelId; version: 1 }
  title: string
  difficulty: Difficulty
  /** Non-empty. */
  allowedModes: InteractionMode[]
  statement: string
  material: FatigueMaterial
  /**
   * The wheel load on the neck: mean F_m and amplitude F_a (so it cycles between F_m − F_a and
   * F_m + F_a), acting `armM` from the shoulder.
   */
  load: { meanForceN: number; alternatingForceN: number; armM: number }
  /** Fixed lengths of the collar and the neck (mass only). */
  geometry: { collarLengthM: number; neckLengthM: number }
  /** The collar is held rigidly in its housing; the spindle does not rotate. */
  support: 'collarClamped'
  /** Reliability of the endurance limit: percent and Shigley's factor ke (checked by the loader). */
  reliability: { percent: number; factor: number }
  /** Required life, cycles (10³…10⁶). */
  targetLifeCycles: number
  /** Surface finishes the student may choose, in display order. */
  allowedFinishes: SurfaceFinishId[]
  initialDesign: FatigueDesign
  /** Test fixture / instructor demo only, never shown to students. */
  referenceDesign?: FatigueDesign
  lockedFields: FatigueLockedField[]
  constraints: {
    minFatigueSafetyFactor: number
    minYieldSafetyFactor: number
    maxMassKg: number
    /** Minimum flat shoulder face (D − d)/2 − r for the wheel hub to seat against, m. */
    minShoulderFaceM: number
  }
  designLimits: FatigueDesignLimits
  /** 1-based, non-baseline iteration numbers. */
  predictionPolicy: { requiredOnIterations: number[] }
  reflectionPrompt: { id: string; text: string }
}

/** The wheel load's minimum and maximum over a cycle, F_m ∓ F_a, N (shared by the drawings and the copy). */
export function wheelLoadRangeN(load: Readonly<FatigueChallenge['load']>): { minN: number; maxN: number } {
  return { minN: load.meanForceN - load.alternatingForceN, maxN: load.meanForceN + load.alternatingForceN }
}
