import { describe, expect, it } from 'vitest'
import type { Section } from '../geometry/sections'
import { bendingProperties, sectionProperties } from './sectionProperties'

/** Relative closeness for hand-calculated fixtures rounded to 5 significant figures. */
const expectRel = (actual: number, expected: number, rel = 1e-4) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(rel)

describe('sectionProperties', () => {
  it('baseline circle Ø30 mm', () => {
    const p = sectionProperties({ kind: 'circle', diameterM: 0.03 })
    expectRel(p.areaM2, 7.0686e-4)
    expectRel(p.IxxM4, 3.9761e-8)
    expect(p.IyyM4).toBe(p.IxxM4)
    expect(p.cVerticalM).toBe(0.015)
    expect(p.cHorizontalM).toBe(0.015)
  })

  it('reference I-section h60 b40 tf4 tw3', () => {
    const s: Section = {
      kind: 'iSection',
      widthM: 0.04,
      heightM: 0.06,
      flangeThicknessM: 0.004,
      webThicknessM: 0.003,
    }
    const p = sectionProperties(s)
    expectRel(p.areaM2, 4.76e-4)
    expectRel(p.IxxM4, 2.8646e-7)
    // Iyy = (2·0.004·0.04³ + 0.052·0.003³)/12 = 4.2784e-8
    expectRel(p.IyyM4, 4.2784e-8)
    expect(p.cVerticalM).toBe(0.03)
    expect(p.cHorizontalM).toBe(0.02)
  })

  it('rectangle 20 × 40 mm', () => {
    const p = sectionProperties({ kind: 'rectangle', widthM: 0.02, heightM: 0.04 })
    expectRel(p.areaM2, 8e-4)
    expectRel(p.IxxM4, 1.0667e-7)
    expectRel(p.IyyM4, 2.6667e-8)
    expect(p.cVerticalM).toBe(0.02)
    expect(p.cHorizontalM).toBe(0.01)
    // Req 8.5: I0/I90 = (h/b)²
    expect(Math.abs(p.IxxM4 / p.IyyM4 - 4) / 4).toBeLessThan(1e-12)
  })

  it('tube D50 d40', () => {
    const p = sectionProperties({ kind: 'tube', outerDiameterM: 0.05, innerDiameterM: 0.04 })
    expectRel(p.areaM2, 7.0686e-4)
    expectRel(p.IxxM4, 1.8113e-7)
    expect(p.IyyM4).toBe(p.IxxM4)
    expect(p.cVerticalM).toBe(0.025)
    expect(p.cHorizontalM).toBe(0.025)
  })

  it('does not mutate the input', () => {
    const s: Section = Object.freeze({ kind: 'rectangle', widthM: 0.02, heightM: 0.04 })
    expect(() => sectionProperties(s)).not.toThrow()
    expect(s).toEqual({ kind: 'rectangle', widthM: 0.02, heightM: 0.04 })
  })
})

describe('bendingProperties', () => {
  it('uses Ixx and h/2 at 0°, Iyy and b/2 at 90°', () => {
    const p = sectionProperties({ kind: 'rectangle', widthM: 0.02, heightM: 0.04 })
    expect(bendingProperties(p, 0)).toEqual({ I: p.IxxM4, c: 0.02 })
    expect(bendingProperties(p, 90)).toEqual({ I: p.IyyM4, c: 0.01 })
  })
})
