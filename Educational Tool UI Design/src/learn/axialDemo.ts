import { axialElongation, axialStiffness, axialStress, circleArea, strainFromElongation, strainFromStress, stressFromStrain, yieldRatio } from '../physics/axial/formulas'
import { TYPICAL_MATERIALS, typicalMaterial, type TypicalMaterial } from '../physics/axial/materials'
import { withinLimit } from '../physics/tolerance'
import type { AxialDemoKind } from './types'

// Demonstration model for the Stress and strain module (task 72; SSL-03, SSL-04): a straight solid
// round rod in uniaxial tension, linear elastic up to yield, as in Stress and Strain I. Every number
// a demo shows comes from these functions, which only call the shared physics layer
// (physics/axial). Values are generic teaching values (a 2 m, 10 mm rod carrying 10 kN), not
// challenge constants; the materials are the same typical textbook values.

export type DemoMaterialId = TypicalMaterial['id']

export const AXIAL_DEMO_MATERIALS: readonly TypicalMaterial[] = TYPICAL_MATERIALS

export interface RodInput {
  forceN: number
  lengthM: number
  diameterM: number
  material: TypicalMaterial
}

export interface RodResponse {
  areaM2: number
  stressPa: number
  strain: number
  elongationM: number
  /** Load per unit stretch, N/m. */
  axialStiffnessNPerM: number
  /** σ / σ_y. */
  yieldRatio: number
  /** True when the stress exceeds yield: the linear model no longer applies (not modeled). */
  beyondYield: boolean
}

/** The rod's response to its load, from the physics layer only. */
export function rodResponse({ forceN, lengthM, diameterM, material }: RodInput): RodResponse {
  const areaM2 = circleArea(diameterM)
  const stressPa = axialStress(forceN, areaM2)
  const ratio = yieldRatio(stressPa, material.yieldStressPa)
  return {
    areaM2,
    stressPa,
    strain: strainFromStress(stressPa, material.elasticModulusPa),
    elongationM: axialElongation(forceN, lengthM, areaM2, material.elasticModulusPa),
    axialStiffnessNPerM: axialStiffness(material.elasticModulusPa, areaM2, lengthM),
    yieldRatio: ratio,
    beyondYield: !withinLimit(ratio, 1),
  }
}

/** Strain from a stretch and a length, ε = δ / L. */
export function strainOf(elongationM: number, lengthM: number): number {
  return strainFromElongation(elongationM, lengthM)
}

/** The stress Hooke's law needs for a strain in a material, σ = E ε (meaningful only below yield). */
export function stressForStrain(strain: number, material: TypicalMaterial): { stressPa: number; beyondYield: boolean } {
  const stressPa = stressFromStrain(strain, material.elasticModulusPa)
  return { stressPa, beyondYield: !withinLimit(yieldRatio(stressPa, material.yieldStressPa), 1) }
}

/** Strain at the yield point, ε_y = σ_y / E. */
export function yieldStrain(material: TypicalMaterial): number {
  return strainFromStress(material.yieldStressPa, material.elasticModulusPa)
}

/** Ranges and starting values for each demonstration's control (display units: mm, m, kN). */
export const AXIAL_DEMO_DEFAULTS = {
  forceN: 10000,
  lengthM: 2,
  diameterM: 0.01,
  materialId: 'steel' as DemoMaterialId,
  diameterMm: { min: 5, max: 20, step: 1 },
  lengthRange: { min: 0.5, max: 4, step: 0.5 },
  forceKn: { min: 2, max: 30, step: 2 },
  elongationMm: { min: 0.25, max: 2, step: 0.25 },
  /** The two rod lengths the strain demo compares, m. */
  strainLengths: [1, 2] as readonly number[],
} as const

export function demoMaterial(id: DemoMaterialId): TypicalMaterial {
  return typicalMaterial(id)
}

/** The baseline demo rod: 2 m long, 10 mm steel, 10 kN. */
export function baseRod(overrides: Partial<RodInput> = {}): RodInput {
  return {
    forceN: AXIAL_DEMO_DEFAULTS.forceN,
    lengthM: AXIAL_DEMO_DEFAULTS.lengthM,
    diameterM: AXIAL_DEMO_DEFAULTS.diameterM,
    material: demoMaterial(AXIAL_DEMO_DEFAULTS.materialId),
    ...overrides,
  }
}

/**
 * Largest elongation a demonstration can produce over its control range, so its drawing keeps one
 * exaggerated scale and every change is drawn in true proportion (SSL-04).
 */
export function demoMaxElongationM(kind: AxialDemoKind): number {
  const stretchOf = (overrides: Partial<RodInput>) => rodResponse(baseRod(overrides)).elongationM
  const D = AXIAL_DEMO_DEFAULTS
  switch (kind) {
    case 'axial-area':
      return stretchOf({ diameterM: D.diameterMm.min / 1000 })
    case 'axial-strain':
      return D.elongationMm.max / 1000
    case 'axial-hooke':
      return Math.max(...AXIAL_DEMO_MATERIALS.map((m) => stretchOf({ material: m })))
    case 'axial-yield':
      return Math.max(...AXIAL_DEMO_MATERIALS.map((m) => stretchOf({ material: m, forceN: D.forceKn.max * 1000 })))
    case 'axial-length':
      return stretchOf({ lengthM: D.lengthRange.max })
  }
}
