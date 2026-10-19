import type { Section } from '../geometry/sections'
import { deflectionShape, maxMoment, nominalStress, tipDeflection } from '../physics/beam'
import { bendingProperties, sectionProperties } from '../physics/sectionProperties'
import type { BeamDemoKind } from './types'

// Demonstration model for the Beam bending module (task 67; LRN-04, LRN-05): the same
// Euler–Bernoulli cantilever with a tip load as Cantilever Beam I. Every number a demo shows comes
// from these functions, which only call the physics layer. Values are generic teaching values,
// not challenge constants.

export interface DemoMaterial {
  id: 'steel' | 'aluminium' | 'timber'
  label: string
  youngsModulusPa: number
}

export const DEMO_MATERIALS: readonly DemoMaterial[] = [
  { id: 'steel', label: 'Steel', youngsModulusPa: 200e9 },
  { id: 'aluminium', label: 'Aluminium', youngsModulusPa: 69e9 },
  { id: 'timber', label: 'Timber (along the grain)', youngsModulusPa: 12e9 },
]

export interface DemoSection {
  id: 'flat' | 'upright' | 'iSection' | 'tube'
  label: string
  section: Section
}

/** Cross-sections with about the same area (800 mm²), so only the shape changes. */
export const DEMO_SECTIONS: readonly DemoSection[] = [
  { id: 'flat', label: 'Flat bar, 40 × 20 mm', section: { kind: 'rectangle', widthM: 0.04, heightM: 0.02 } },
  { id: 'upright', label: 'Upright bar, 20 × 40 mm', section: { kind: 'rectangle', widthM: 0.02, heightM: 0.04 } },
  {
    id: 'iSection',
    label: 'I-section, 40 × 60 mm',
    section: { kind: 'iSection', widthM: 0.04, heightM: 0.06, flangeThicknessM: 0.005, webThicknessM: 0.008 },
  },
  { id: 'tube', label: 'Round tube, 50 mm', section: { kind: 'tube', outerDiameterM: 0.05, innerDiameterM: 0.0385 } },
]

export interface CantileverInput {
  forceN: number
  lengthM: number
  youngsModulusPa: number
  section: Section
}

export interface CantileverResponse {
  areaM2: number
  /** Second moment of area about the bending axis. */
  secondMomentM4: number
  /** Distance from the neutral axis to the top and bottom surfaces. */
  extremeFibreM: number
  tipDeflectionM: number
  rootMomentNm: number
  /** Peak bending stress, at the fixed end on the top and bottom surfaces. */
  maxStressPa: number
}

export function cantileverResponse({ forceN, lengthM, youngsModulusPa, section }: CantileverInput): CantileverResponse {
  const props = sectionProperties(section)
  const { I, c } = bendingProperties(props, 0)
  const rootMomentNm = maxMoment(forceN, lengthM)
  return {
    areaM2: props.areaM2,
    secondMomentM4: I,
    extremeFibreM: c,
    tipDeflectionM: tipDeflection(forceN, lengthM, youngsModulusPa, I),
    rootMomentNm,
    maxStressPa: nominalStress(rootMomentNm, c, I),
  }
}

/** Bending moment at distance x from the fixed end: the load times its lever arm L − x. */
export function momentAt(input: CantileverInput, xM: number): number {
  const x = Math.min(Math.max(xM, 0), input.lengthM)
  return maxMoment(input.forceN, input.lengthM - x)
}

/**
 * Bending stress at distance x from the fixed end and height y above the neutral axis, as a
 * fraction of the extreme-fibre distance (1 = top surface, −1 = bottom). Positive is tension: a
 * downward tip load stretches the top of a cantilever.
 */
export function stressAt(input: CantileverInput, xM: number, heightFraction: number): number {
  const { secondMomentM4, extremeFibreM } = cantileverResponse(input)
  const y = Math.min(Math.max(heightFraction, -1), 1) * extremeFibreM
  return nominalStress(momentAt(input, xM), y, secondMomentM4)
}

/** Deflection (downward, m) at `samples + 1` evenly spaced points from the fixed end to the tip. */
export function deflectedShape(input: CantileverInput, samples = 24): { xM: number; deflectionM: number }[] {
  const { secondMomentM4 } = cantileverResponse(input)
  return Array.from({ length: samples + 1 }, (_, i) => {
    const xM = (input.lengthM * i) / samples
    return { xM, deflectionM: deflectionShape(input.forceN, input.lengthM, input.youngsModulusPa, secondMomentM4, xM) }
  })
}

/** Ranges and starting values for each demonstration's control. */
export const DEMO_DEFAULTS = {
  forceN: 200,
  lengthM: 1,
  materialId: 'aluminium' as DemoMaterial['id'],
  sectionId: 'upright' as DemoSection['id'],
  force: { min: 50, max: 400, step: 50 },
  length: { min: 0.5, max: 2, step: 0.25 },
} as const

export function demoMaterial(id: DemoMaterial['id']): DemoMaterial {
  return DEMO_MATERIALS.find((m) => m.id === id)!
}

export function demoSection(id: DemoSection['id']): DemoSection {
  return DEMO_SECTIONS.find((s) => s.id === id)!
}

/** The baseline demo beam: 1 m aluminium, upright 20 × 40 mm bar, 200 N at the tip. */
export function baseInput(overrides: Partial<CantileverInput> = {}): CantileverInput {
  return {
    forceN: DEMO_DEFAULTS.forceN,
    lengthM: DEMO_DEFAULTS.lengthM,
    youngsModulusPa: demoMaterial(DEMO_DEFAULTS.materialId).youngsModulusPa,
    section: demoSection(DEMO_DEFAULTS.sectionId).section,
    ...overrides,
  }
}

/**
 * Largest tip deflection a demonstration can produce over its control range, so its drawing keeps
 * one exaggerated scale and every change is drawn in true proportion (LRN-05).
 */
export function demoMaxDeflectionM(kind: BeamDemoKind): number {
  const tipOf = (overrides: Partial<CantileverInput>) => cantileverResponse(baseInput(overrides)).tipDeflectionM
  switch (kind) {
    case 'load':
      return tipOf({ forceN: DEMO_DEFAULTS.force.max })
    case 'length':
      return tipOf({ lengthM: DEMO_DEFAULTS.length.max })
    case 'material':
      return Math.max(...DEMO_MATERIALS.map((m) => tipOf({ youngsModulusPa: m.youngsModulusPa })))
    case 'section':
      return Math.max(...DEMO_SECTIONS.map((s) => tipOf({ section: s.section })))
    case 'stress':
      return tipOf({})
  }
}
