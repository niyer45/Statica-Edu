import { describe, expect, it } from 'vitest'
import { deflectionShape, maxMoment, nominalStress, tipDeflection } from './beam'
import { bendingProperties, sectionProperties } from './sectionProperties'

const expectRel = (actual: number, expected: number, rel = 1e-3) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(rel)

// Cantilever Beam I: F = 300 N, L = 0.6 m, aluminium E = 69 GPa.
const F = 300
const L = 0.6
const E = 69e9

const baseline = bendingProperties(sectionProperties({ kind: 'circle', diameterM: 0.03 }), 0)
const reference = bendingProperties(
  sectionProperties({
    kind: 'iSection',
    widthM: 0.04,
    heightM: 0.06,
    flangeThicknessM: 0.004,
    webThicknessM: 0.003,
  }),
  0,
)

describe('beam formulas', () => {
  it('maxMoment = F·L', () => {
    expect(maxMoment(F, L)).toBeCloseTo(180, 12)
  })

  it('tip deflection for baseline and reference', () => {
    expectRel(tipDeflection(F, L, E, baseline.I), 7.873e-3)
    expectRel(tipDeflection(F, L, E, reference.I), 1.093e-3)
  })

  it('nominal stress for baseline and reference', () => {
    const M = maxMoment(F, L)
    expectRel(nominalStress(M, baseline.c, baseline.I), 67.9e6)
    expectRel(nominalStress(M, reference.c, reference.I), 18.85e6)
  })
})

describe('deflectionShape', () => {
  const I = baseline.I
  const tip = tipDeflection(F, L, E, I)

  it('is exactly 0 at the root and equals the tip deflection at x = L', () => {
    expect(deflectionShape(F, L, E, I, 0)).toBe(0)
    expect(Math.abs(deflectionShape(F, L, E, I, L) - tip) / tip).toBeLessThan(1e-12)
  })

  it('is monotone non-decreasing over 50 samples', () => {
    let prev = -Infinity
    for (let i = 0; i <= 50; i++) {
      const w = deflectionShape(F, L, E, I, (L * i) / 50)
      expect(w).toBeGreaterThanOrEqual(prev)
      prev = w
    }
  })

  it('clamps x outside [0, L]', () => {
    expect(deflectionShape(F, L, E, I, -0.1)).toBe(0)
    expect(deflectionShape(F, L, E, I, 2 * L)).toBe(deflectionShape(F, L, E, I, L))
  })
})
