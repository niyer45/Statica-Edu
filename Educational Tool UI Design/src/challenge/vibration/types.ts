import type { VibrationDesign } from '../../geometry/vibration/design'
import type { Difficulty, InteractionMode } from '../types'

// Vibration Isolation I challenge configuration types (task 50.2; vibration-isolation-1
// VIB-01–VIB-09, multi-model-architecture MM-01/MM-02). Independent of the beam `Challenge`
// type, which is unchanged. Shared value types (Difficulty, InteractionMode, SchemaIssue,
// Result) are reused from ../types.

/** The vibration model identity; every vibration config declares it explicitly (MM-02). */
export const VIBRATION_MODEL_REF = Object.freeze({ id: 'sdofBaseIsolation', version: 1 } as const)

export type VibrationModelId = (typeof VIBRATION_MODEL_REF)['id']

/** Fields the student can never change (VIB-03). All four are challenge constants. */
export type VibrationLockedField = 'massKg' | 'operatingBandHz' | 'amplitudeM' | 'linearStrokeM'

export const VIBRATION_LOCKED_FIELDS: readonly VibrationLockedField[] = Object.freeze([
  'massKg',
  'operatingBandHz',
  'amplitudeM',
  'linearStrokeM',
] as const)

/** An isolator material. ζ is an educational nominal value, not supplier data (VIB-04). */
export interface VibrationMaterial {
  id: string
  /** Student-facing name. Contains no digits (loader rule), so facts quoting it stay grounded. */
  name: string
  /** Equivalent viscous damping ratio ζ, 0 < ζ ≤ 1. */
  dampingRatio: number
}

/** Stiffness input range, N/m. The step sets input granularity and is not a validity rule. */
export interface StiffnessLimits {
  minNPerM: number
  maxNPerM: number
  stepNPerM: number
}

/** Operating frequency band, Hz; 0 < minHz < maxHz (loader rule). */
export interface FrequencyBand {
  minHz: number
  maxHz: number
}

export interface VibrationChallenge {
  id: string
  version: number
  model: { id: VibrationModelId; version: 1 }
  title: string
  difficulty: Difficulty
  /** Non-empty. */
  allowedModes: InteractionMode[]
  statement: string
  /** Rigid component supported only vertically. */
  component: { massKg: number }
  /**
   * Harmonic base displacement y(t) = Y sin ωt with the same amplitude at every frequency from
   * runUpFromHz (0 in v1) to operatingBandHz.maxHz. Peaks are screened over that range.
   */
  excitation: {
    kind: 'baseDisplacement'
    amplitudeM: number
    operatingBandHz: FrequencyBand
    runUpFromHz: 0
  }
  /** Linear mount stroke, used only by the SPRING_STROKE applicability screen. */
  mount: { linearStrokeM: number }
  /** Non-empty, unique ids, in display order. */
  materials: VibrationMaterial[]
  stiffnessLimits: StiffnessLimits
  initialDesign: VibrationDesign
  /** Test fixture / instructor demo only, never shown to students (VIB-05). */
  referenceDesign?: VibrationDesign
  lockedFields: VibrationLockedField[]
  constraints: {
    maxWorstInBandTransmissibility: number
    maxStaticDeflectionM: number
    maxPeakTransmissibility: number
    maxRelativeDisplacementM: number
  }
  /** 1-based, non-baseline iteration numbers. */
  predictionPolicy: { requiredOnIterations: number[] }
  reflectionPrompt: { id: string; text: string }
  /** Display-only chart range and sample count, and the cap on the schematic's sag offset (VIB-14). */
  visualization: { chartMaxHz: number; chartSamples: number; maxVisualSagPx: number }
}
