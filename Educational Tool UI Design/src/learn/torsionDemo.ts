import type { TorsionSection } from '../geometry/torsion/design'
import { maxShearStress, shaftDiameters, shaftSectionProperties, shearStressAtRadius, torsionalStiffness, twistAngle } from '../physics/torsion/shaft'
import { mmToM } from '../units/units'
import type { TorsionDemoKind } from './types'

// Demonstration model for the Torsion module (task 71, D-61; LRN-04, LRN-05): the same
// Saint-Venant circular-shaft torsion as Torsion Shaft I (one end fixed, a steady torque at the
// other, linear elastic). Every number a demo shows comes from these functions, which only call
// the physics layer (`physics/torsion/shaft`). Values are generic teaching values, not challenge
// constants.

/** Nominal shear modulus of steel used by every torsion demonstration. */
export const DEMO_SHAFT_MATERIAL = { label: 'Steel', shearModulusPa: 79e9 } as const

export interface DemoShaftSection {
  id: 'solid20' | 'tube25' | 'tube29'
  label: string
  section: TorsionSection
}

/**
 * Sections with exactly the same area (314 mm², so the same mass per metre): D² − d² = 20² mm²
 * for each, so only the placement of the material changes.
 */
export const DEMO_SHAFT_SECTIONS: readonly DemoShaftSection[] = [
  { id: 'solid20', label: 'Solid bar, 20 mm', section: { kind: 'circle', diameterM: 0.02 } },
  { id: 'tube25', label: 'Tube, 25 mm with a 15 mm bore', section: { kind: 'tube', outerDiameterM: 0.025, innerDiameterM: 0.015 } },
  { id: 'tube29', label: 'Tube, 29 mm with a 21 mm bore', section: { kind: 'tube', outerDiameterM: 0.029, innerDiameterM: 0.021 } },
]

export interface ShaftInput {
  torqueNm: number
  lengthM: number
  shearModulusPa: number
  section: TorsionSection
}

export interface ShaftResponse {
  areaM2: number
  /** Polar moment of area J. */
  polarMomentM4: number
  outerDiameterM: number
  /** 0 for a solid shaft. */
  innerDiameterM: number
  /** Angle of twist of the free end, radians. */
  twistRad: number
  /** Peak shear stress, on the outer surface. */
  maxShearStressPa: number
  /** Torque per radian of twist, GJ/L. */
  stiffnessNmPerRad: number
}

export function shaftResponse({ torqueNm, lengthM, shearModulusPa, section }: ShaftInput): ShaftResponse {
  const props = shaftSectionProperties(section)
  const { d } = shaftDiameters(section)
  const J = props.polarMomentM4
  return {
    areaM2: props.areaM2,
    polarMomentM4: J,
    outerDiameterM: props.outerDiameterM,
    innerDiameterM: d,
    twistRad: twistAngle(torqueNm, lengthM, shearModulusPa, J),
    maxShearStressPa: maxShearStress(torqueNm, props.outerDiameterM, J),
    stiffnessNmPerRad: torsionalStiffness(shearModulusPa, J, lengthM),
  }
}

/**
 * Shear stress at a fraction of the outer radius (0 = the axis, 1 = the outer surface), Pa. The
 * fraction is clamped to [0, 1]; inside a tube's bore there is no material, so callers keep to the
 * wall when the section is hollow.
 */
export function shearStressAt(input: ShaftInput, radiusFraction: number): number {
  const { outerDiameterM, polarMomentM4 } = shaftResponse(input)
  const r = (Math.min(Math.max(radiusFraction, 0), 1) * outerDiameterM) / 2
  return shearStressAtRadius(input.torqueNm, r, polarMomentM4)
}

/** Ranges and starting values for each demonstration's control. Diameters in mm for the slider. */
export const TORSION_DEMO_DEFAULTS = {
  torqueNm: 100,
  lengthM: 1,
  diameterMm: 20,
  sectionId: 'solid20' as DemoShaftSection['id'],
  torque: { min: 25, max: 150, step: 25 },
  length: { min: 0.5, max: 2, step: 0.25 },
  diameter: { min: 20, max: 40, step: 5 },
  /** Points across the radius for the stress demo, in mm from the axis of the 20 mm shaft. */
  radius: { min: 0, max: 10, step: 1 },
} as const

export function demoShaftSection(id: DemoShaftSection['id']): DemoShaftSection {
  return DEMO_SHAFT_SECTIONS.find((s) => s.id === id)!
}

/** A solid round section of the given diameter in millimetres. */
export function solidSection(diameterMm: number): TorsionSection {
  return { kind: 'circle', diameterM: mmToM(diameterMm) }
}

/** The baseline demo shaft: 1 m of steel, solid Ø20 mm, 100 N·m of torque at the free end. */
export function baseShaft(overrides: Partial<ShaftInput> = {}): ShaftInput {
  return {
    torqueNm: TORSION_DEMO_DEFAULTS.torqueNm,
    lengthM: TORSION_DEMO_DEFAULTS.lengthM,
    shearModulusPa: DEMO_SHAFT_MATERIAL.shearModulusPa,
    section: solidSection(TORSION_DEMO_DEFAULTS.diameterMm),
    ...overrides,
  }
}

/**
 * Largest angle of twist a demonstration can produce over its control range, so its drawing keeps
 * one exaggerated scale and every change is drawn in true proportion (LRN-05).
 */
export function demoMaxTwistRad(kind: TorsionDemoKind): number {
  const twistOf = (overrides: Partial<ShaftInput>) => shaftResponse(baseShaft(overrides)).twistRad
  switch (kind) {
    case 'torsion-torque':
      return twistOf({ torqueNm: TORSION_DEMO_DEFAULTS.torque.max })
    case 'torsion-length':
      return twistOf({ lengthM: TORSION_DEMO_DEFAULTS.length.max })
    case 'torsion-diameter':
      return twistOf({ section: solidSection(TORSION_DEMO_DEFAULTS.diameter.min) })
    case 'torsion-hollow':
      return Math.max(...DEMO_SHAFT_SECTIONS.map((s) => twistOf({ section: s.section })))
    case 'torsion-stress':
      return twistOf({})
  }
}
