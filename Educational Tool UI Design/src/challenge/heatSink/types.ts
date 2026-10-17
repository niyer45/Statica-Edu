import type { HeatSinkDesign } from '../../geometry/heatSink/design'
import type { Difficulty, InteractionMode, ParamRange } from '../types'

// Heat Sink I challenge configuration types (task 48.2; heat-sink-1 HSK-01–HSK-09,
// multi-model-architecture MM-01/MM-02). Independent of the beam `Challenge` and torsion types,
// which are unchanged. Shared value types (Difficulty, InteractionMode, ParamRange, SchemaIssue,
// Result) are reused from ../types. Absolute temperatures are stored in kelvin (MM-12); °C is a
// display conversion only.

/** The heat sink model identity; every heat sink config declares it explicitly (MM-02). */
export const HEAT_SINK_MODEL_REF = Object.freeze({ id: 'plateFinHeatSink', version: 1 } as const)

export type HeatSinkModelId = (typeof HEAT_SINK_MODEL_REF)['id']

/** Fields the student can never change (HSK-03). `materialId` is a design field. */
export type HeatSinkLockedField = 'base' | 'materialId' | 'heatLoadW' | 'ambientTemperatureK' | 'convection'

export const HEAT_SINK_LOCKED_FIELDS: readonly HeatSinkLockedField[] = Object.freeze([
  'base',
  'materialId',
  'heatLoadW',
  'ambientTemperatureK',
  'convection',
] as const)

export interface HeatSinkMaterial {
  id: string
  name: string
  /** Educational nominal value, W/(m·K). */
  thermalConductivityWPerMK: number
  densityKgM3: number
}

/** Rectangular base: W across the fins, D along the fins and the airflow, t_b thick (HSK-03). */
export interface HeatSinkBase {
  widthM: number
  depthM: number
  thicknessM: number
}

/**
 * The specified effective convection coefficient (owner decision D-40): uniform on every exposed
 * fin and base surface, described as low-speed fan-assisted airflow, given and never computed.
 */
export interface HeatSinkConvection {
  coefficientWPerM2K: number
  kind: 'specifiedEffective'
  description: string
}

/** An integer design range with step 1 (fin count, HSK-04). */
export interface IntegerRange {
  min: number
  max: number
  step: 1
}

/** Adjustable ranges and the geometric gap floor (HSK-04). */
export interface HeatSinkDesignLimits {
  finCount: IntegerRange
  finThicknessM: ParamRange
  finHeightM: ParamRange
  /** Fins never touch or merge: s = (W − N t)/(N − 1) ≥ this value, metres. */
  minGeometricGapM: number
}

export interface HeatSinkChallenge {
  id: string
  version: number
  model: { id: HeatSinkModelId; version: 1 }
  title: string
  difficulty: Difficulty
  /** Non-empty. */
  allowedModes: InteractionMode[]
  statement: string
  material: HeatSinkMaterial
  base: HeatSinkBase
  /** Uniform heat load over the whole base mounting face, W. */
  heatLoadW: number
  /** Ambient air temperature T∞, K. */
  ambientTemperatureK: number
  convection: HeatSinkConvection
  initialDesign: HeatSinkDesign
  /** Test fixture / instructor demo only, never shown to students (HSK-05). */
  referenceDesign?: HeatSinkDesign
  lockedFields: HeatSinkLockedField[]
  constraints: {
    /** Upper bound on the mounting-face temperature, K. */
    maxBaseTemperatureK: number
    maxMassKg: number
    maxFinHeightM: number
    /** Lower bound on the fin gap s (a design rule), metres. */
    minFinGapM: number
  }
  designLimits: HeatSinkDesignLimits
  /** 1-based, non-baseline iteration numbers. */
  predictionPolicy: { requiredOnIterations: number[] }
  reflectionPrompt: { id: string; text: string }
  /**
   * Positions x/H at which the analysis stores the fin temperature profile for display (HSK-14).
   * Strictly increasing, from 0 (fin root) to 1 (fin tip); loader cross-field rule.
   */
  visualization: { profileSamplesXOverH: number[] }
}
