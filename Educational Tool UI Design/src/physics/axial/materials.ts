// Typical textbook properties of three structural metals (task 72; stress-strain-1 design
// "Materials"). Typical values for teaching, not certified or supplier data. Structural steel
// follows the values used in Gere & Goodno and Hibbeler; the aluminium and titanium alloys follow
// the typical values tabulated in Callister & Rethwisch. Edition and table numbers pending
// engineering review (29.2). The Learn module reads these; the Stress and Strain I challenge
// carries the same values in its configuration (a test checks they agree).

export interface TypicalMaterial {
  id: 'steel' | 'aluminium' | 'titanium'
  label: string
  /** Young's modulus E, Pa. */
  elasticModulusPa: number
  /** Yield strength σ_y, Pa. */
  yieldStressPa: number
  densityKgM3: number
}

export const TYPICAL_MATERIALS: readonly TypicalMaterial[] = Object.freeze([
  Object.freeze({ id: 'steel', label: 'Structural steel', elasticModulusPa: 200e9, yieldStressPa: 250e6, densityKgM3: 7850 }),
  Object.freeze({ id: 'aluminium', label: 'Aluminium alloy 6061-T6', elasticModulusPa: 69e9, yieldStressPa: 276e6, densityKgM3: 2700 }),
  Object.freeze({ id: 'titanium', label: 'Titanium alloy Ti-6Al-4V', elasticModulusPa: 114e9, yieldStressPa: 830e6, densityKgM3: 4430 }),
] as const satisfies readonly TypicalMaterial[])

export function typicalMaterial(id: TypicalMaterial['id']): TypicalMaterial {
  return TYPICAL_MATERIALS.find((m) => m.id === id)!
}
