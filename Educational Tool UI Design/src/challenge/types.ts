import type { BeamDesign } from '../geometry/sections'

export type Difficulty = 'introductory' | 'intermediate' | 'advanced'
export type InteractionMode = 'guided' | 'parametric' | 'freeform'
export type LockedField = 'lengthM' | 'materialId' | 'forceN' | 'support'
export type SectionKind = 'circle' | 'tube' | 'rectangle' | 'iSection'

export interface Material {
  id: string
  name: string
  elasticModulusPa: number
  densityKgM3: number
  /** Educational nominal value, not certified. */
  allowableStressPa: number
  /** Used only for the applicability (plasticity) screen. */
  yieldStressPa: number
}

export interface ParamRange {
  minM: number
  maxM: number
  stepM: number
}

export interface SectionLimits {
  circle: { diameterM: ParamRange }
  tube: { outerDiameterM: ParamRange; minWallM: number }
  rectangle: { widthM: ParamRange; heightM: ParamRange }
  iSection: {
    widthM: ParamRange
    heightM: ParamRange
    minFlangeThicknessM: number
    minWebThicknessM: number
    minClearWebHeightM: number
  }
}

/** Thicknesses used when switching to a section kind that has them (design data table). */
export interface SectionDefaults {
  tubeWallM: number
  iSectionFlangeThicknessM: number
  iSectionWebThicknessM: number
}

export interface Challenge {
  id: string
  version: number
  title: string
  /** Independent of mode; no code derives one from the other. */
  difficulty: Difficulty
  /** Non-empty. MVP: ['guided', 'parametric']; 'freeform' is preview-only. */
  allowedModes: InteractionMode[]
  statement: string
  material: Material
  initialDesign: BeamDesign
  /** Test fixture / instructor demo only, never shown to students. */
  referenceDesign?: BeamDesign
  lockedFields: LockedField[]
  support: 'fixedRoot'
  load: { forceN: number; location: 'freeEnd'; direction: 'down' }
  constraints: {
    maxMassKg: number
    maxDeflectionM: number
    maxStressPa: number
    maxWidthM: number
    maxHeightM: number
  }
  sectionLimits: SectionLimits
  sectionDefaults: SectionDefaults
  allowedSections: SectionKind[]
  /** 1-based, non-baseline iteration numbers. */
  predictionPolicy: { requiredOnIterations: number[] }
  reflectionPrompt: { id: string; text: string }
  visualization: { exaggerationFactor: number; maxVisualDeflectionFractionOfL: number }
  content: { conceptNotes: Record<string, string>; collegeDetails: boolean }
}

/** One schema or cross-field failure: where it happened and which rule was violated. */
export interface SchemaIssue {
  /** Dotted path to the failing field, e.g. `sectionLimits.tube.minWallM` ('' for the root). */
  path: string
  /** Machine-readable rule id, e.g. `unrecognized_keys`, `too_small`, `RANGE_MIN_GT_MAX`. */
  rule: string
  message: string
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
