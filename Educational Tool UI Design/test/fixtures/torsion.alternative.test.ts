import { describe, expect, it } from 'vitest'
import { sectionProperties } from '../../src/physics/sectionProperties'
import { shaftSectionProperties } from '../../src/physics/torsion/shaft'
import { relClose, THIN_WALL_ERRORS, TORSION_WORKSHEET, tube } from './torsion'

// TSH-13 alternative-method and limiting checks (torsion-shaft-1 design.md). These check the
// closed-form polar moment against independent routes; none of them is used by the app.

/** Composite Simpson rule for ∫ f over [a, b] with n (even) subintervals. Test code only. */
function simpson(f: (x: number) => number, a: number, b: number, n: number): number {
  const h = (b - a) / n
  let sum = f(a) + f(b)
  for (let i = 1; i < n; i++) sum += (i % 2 === 1 ? 4 : 2) * f(a + i * h)
  return (sum * h) / 3
}

const diameters = (s: (typeof TORSION_WORKSHEET)[number]['design']['section']) =>
  s.kind === 'circle' ? { D: s.diameterM, d: 0 } : { D: s.outerDiameterM, d: s.innerDiameterM }

describe('numerical quadrature: J = ∫ 2π r³ dr', () => {
  it.each(TORSION_WORKSHEET.map((f) => [f.name, f] as const))('%s agrees with the closed form within 1e-12', (_n, f) => {
    const { D, d } = diameters(f.design.section)
    const quad = simpson((r) => 2 * Math.PI * r ** 3, d / 2, D / 2, 64)
    const closed = shaftSectionProperties(f.design.section).polarMomentM4
    expect(relClose(closed, quad, 1e-12), `${closed} vs ${quad}`).toBe(true)
  })
})

describe('circular identity: J = Ixx + Iyy (beam sectionProperties, circles/tubes only)', () => {
  it.each(TORSION_WORKSHEET.map((f) => [f.name, f] as const))('%s agrees within 1e-12', (_n, f) => {
    const beam = sectionProperties(f.design.section)
    const shaft = shaftSectionProperties(f.design.section)
    expect(relClose(shaft.polarMomentM4, beam.IxxM4 + beam.IyyM4, 1e-12)).toBe(true)
    // The same circle/tube area as the beam model.
    expect(relClose(shaft.areaM2, beam.areaM2, 1e-12)).toBe(true)
  })
})

describe('thin-wall limit: 2π r_m³ t / J − 1 → 0 as O(t²) (D = 50 mm)', () => {
  const D = 0.05
  const errors = THIN_WALL_ERRORS.map(({ wallM }) => {
    const J = shaftSectionProperties(tube(D, D - 2 * wallM)).polarMomentM4
    const rm = (D - wallM) / 2
    return (2 * Math.PI * rm ** 3 * wallM) / J - 1
  })

  it('matches the worksheet values to the quoted three significant figures', () => {
    THIN_WALL_ERRORS.forEach(({ error }, i) => {
      expect(Math.abs(errors[i] - error), `t = ${THIN_WALL_ERRORS[i].wallM}`).toBeLessThanOrEqual(0.006 * Math.abs(error))
    })
  })

  it('is negative, decreases monotonically in magnitude, and is below 2e-3 for t ≤ 2 mm', () => {
    for (const e of errors) expect(e).toBeLessThan(0)
    for (let i = 1; i < errors.length; i++) expect(Math.abs(errors[i])).toBeLessThan(Math.abs(errors[i - 1]))
    THIN_WALL_ERRORS.forEach(({ wallM }, i) => {
      if (wallM <= 0.002) expect(Math.abs(errors[i])).toBeLessThan(2e-3)
    })
  })

  it('falls about 4× per halving of t (second order)', () => {
    for (let i = 1; i < errors.length; i++) {
      const ratio = errors[i - 1] / errors[i]
      expect(ratio).toBeGreaterThan(3.5)
      expect(ratio).toBeLessThan(4.5)
    }
  })
})
