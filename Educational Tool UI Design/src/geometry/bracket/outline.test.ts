import { describe, expect, it } from 'vitest'
import { bracket, bracketChallenge } from '../../../test/fixtures/bracket'
import { BEND_ARC_SEGMENTS, bracketArmLengthM, bracketBendSection, bracketBoltRowHeightM, bracketOuterRadiusM, bracketOutline } from './outline'

// Display-only L-bracket side-view geometry (task 55).

const ch = bracketChallenge()
const L = bracketArmLengthM(ch)

describe('bracketOutline', () => {
  it('runs from the flange top down the wall face, round the bend, out the arm and back', () => {
    // t 7, H 80, r_i 6 mm: r_o = 13 mm.
    const pts = bracketOutline(bracket('ref', 0.007, 0.04, 0.08, 0.006), L)
    const n = BEND_ARC_SEGMENTS
    const ro = 0.006 + 0.007
    expect(pts).toHaveLength(2 * (n + 1) + 4)
    expect(pts[0]).toEqual({ x: 0, y: 0.08 })
    expect(pts[1]).toEqual({ x: 0, y: ro })
    expect(pts[n + 1]).toEqual({ x: ro, y: 0 })
    expect(pts[n + 2]).toEqual({ x: L, y: 0 })
    expect(pts[n + 3]).toEqual({ x: L, y: 0.007 })
    expect(pts[n + 4]).toEqual({ x: ro, y: 0.007 })
    expect(pts[2 * n + 4]).toEqual({ x: 0.007, y: ro })
    expect(pts.at(-1)).toEqual({ x: 0.007, y: 0.08 })
    // Outer arc on radius r_o and inner arc on radius r_i, both centred at (r_o, r_o).
    for (const p of pts.slice(1, n + 2)) expect(Math.hypot(p.x - 0.013, p.y - 0.013)).toBeCloseTo(0.013, 12)
    for (const p of pts.slice(n + 4, 2 * n + 5)) expect(Math.hypot(p.x - 0.013, p.y - 0.013)).toBeCloseTo(0.006, 12)
  })

  it('is counter-clockwise (positive signed area) and stays inside the bracket envelope', () => {
    const pts = bracketOutline(bracket('b', 0.003, 0.12, 0.055, 0.001), L)
    let s = 0
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const q = pts[(i + 1) % pts.length]
      s += p.x * q.y - q.x * p.y
    }
    expect(s).toBeGreaterThan(0)
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-15)
      expect(p.x).toBeLessThanOrEqual(L)
      expect(p.y).toBeGreaterThanOrEqual(-1e-15)
      expect(p.y).toBeLessThanOrEqual(0.055)
    }
  })

  it('uses at least one arc segment', () => {
    expect(bracketOutline(bracket('b', 0.003, 0.12, 0.055, 0.001), L, 0)).toHaveLength(2 * 2 + 4)
  })
})

describe('display helpers', () => {
  it('arm length, bolt row height and outer radius', () => {
    expect(L).toBeCloseTo(0.135, 15)
    expect(bracketBoltRowHeightM({ flangeHeightM: 0.08 }, ch)).toBeCloseTo(0.065, 15)
    expect(bracketOuterRadiusM({ innerRadiusM: 0.006, thicknessM: 0.007 })).toBeCloseTo(0.013, 15)
  })

  it('the bend section runs radially across the middle of the bend, from the inner to the outer fibre', () => {
    const { inner, outer } = bracketBendSection({ innerRadiusM: 0.006, thicknessM: 0.007 })
    expect(Math.hypot(inner.x - 0.013, inner.y - 0.013)).toBeCloseTo(0.006, 15)
    expect(Math.hypot(outer.x - 0.013, outer.y - 0.013)).toBeCloseTo(0.013, 15)
    expect(inner.x).toBeCloseTo(inner.y, 15)
    expect(outer.x).toBeCloseTo(outer.y, 15)
  })
})
