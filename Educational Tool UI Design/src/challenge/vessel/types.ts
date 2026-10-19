import type { VesselDesign } from '../../geometry/vessel/design'
import type { Difficulty, InteractionMode, ParamRange } from '../types'

// Pressure Vessel I challenge configuration types (task 69; .kiro/specs/pressure-vessel-1
// PVS-01–PVS-09, multi-model-architecture MM-01/MM-02). Independent of the beam `Challenge`
// type, which is unchanged. The thin-wall and plasticity thresholds are model constants
// (physics/vessel/constants.ts), never configuration. The allowable stress is not a field: it is
// the yield stress divided by the design factor (allowableStressPa below), so the two can never
// disagree.

/** The vessel model identity; every vessel config declares it explicitly (MM-02). New id (MM-01). */
export const VESSEL_MODEL_REF = Object.freeze({ id: 'thinWallPressureVessel', version: 1 } as const)

export type VesselModelId = (typeof VESSEL_MODEL_REF)['id']

/** Fields the student can never change (PVS-03). `materialId` is a design field. */
export type VesselLockedField = 'materialId' | 'pressurePa' | 'designFactor' | 'heads'

export const VESSEL_LOCKED_FIELDS: readonly VesselLockedField[] = Object.freeze([
  'materialId',
  'pressurePa',
  'designFactor',
  'heads',
] as const)

export interface VesselMaterial {
  id: string
  name: string
  densityKgM3: number
  /** Educational nominal value, not certified. The allowable is this divided by the design factor. */
  yieldStressPa: number
}

/** Ranges of the four adjustable dimensions. `stepM` is the control grid. */
export interface VesselDesignLimits {
  innerDiameterM: ParamRange
  shellLengthM: ParamRange
  shellThicknessM: ParamRange
  headThicknessM: ParamRange
}

export interface VesselChallenge {
  id: string
  version: number
  model: { id: VesselModelId; version: 1 }
  title: string
  difficulty: Difficulty
  /** Non-empty. */
  allowedModes: InteractionMode[]
  statement: string
  material: VesselMaterial
  /** Design factor n on yield; the allowable membrane stress is σ_y / n. At least 1. */
  designFactor: number
  /** Internal (gauge) pressure, Pa. */
  pressurePa: number
  /** Both ends are hemispherical heads with the shell's inner radius. */
  heads: 'hemispherical'
  initialDesign: VesselDesign
  /** Test fixture / instructor demo only, never shown to students (PVS-05). */
  referenceDesign?: VesselDesign
  lockedFields: VesselLockedField[]
  constraints: {
    /** Required internal volume (a minimum), m³. */
    minVolumeM3: number
    /** Maximum overall length, outside of head to outside of head, m. */
    maxOverallLengthM: number
    maxMassKg: number
  }
  designLimits: VesselDesignLimits
  /** 1-based, non-baseline iteration numbers. */
  predictionPolicy: { requiredOnIterations: number[] }
  reflectionPrompt: { id: string; text: string }
}

/** σ_a = σ_y / n, the allowable membrane stress for every stress check, Pa. */
export function allowableStressPa(ch: Pick<VesselChallenge, 'material' | 'designFactor'>): number {
  return ch.material.yieldStressPa / ch.designFactor
}
