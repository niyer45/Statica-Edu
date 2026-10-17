import { describe, expect, it } from 'vitest'
import { bracket } from '../../../test/fixtures/bracket'
import { bracketOutline, FILLET_ARC_SEGMENTS } from './outline'

// Display-only bracket elevation outline (task 46.2; MBR-18).

const L = 0.3

describe('bracketOutline', () => {
  it('draws a uniform bar as a rectangle, ignoring a and r', () => {
    const pts = bracketOutline(bracket('u', 0.03, 0.03, 0.15, 0.004), L)
    expect(pts).toEqual([
      { x: 0, y: 0.015 },
      { x: L, y: 0.015 },
      { x: L, y: -0.015 },
      { x: 0, y: -0.015 },
    ])
    expect(bracketOutline(bracket('u', 0.03, 0.03, 0.2, 0.001), L)).toEqual(pts)
  })

  it('for r < h, runs down the shoulder face, then along a fillet arc tangent to the arm face', () => {
    // D 30, d 20, a 150, r 1 mm: h = 5 mm > r.
    const pts = bracketOutline(bracket('b', 0.03, 0.02, 0.15, 0.001), L)
    const upper = pts.slice(0, pts.length / 2)
    expect(upper).toHaveLength(FILLET_ARC_SEGMENTS + 4)
    expect(upper[0]).toEqual({ x: 0, y: 0.015 })
    expect(upper[1]).toEqual({ x: 0.15, y: 0.015 })
    expect(upper[2].x).toBeCloseTo(0.15, 15)
    expect(upper[2].y).toBeCloseTo(0.011, 15)
    expect(upper.at(-2)).toEqual({ x: 0.151, y: 0.01 })
    expect(upper.at(-1)).toEqual({ x: L, y: 0.01 })
    // Arc points lie on the fillet circle centred at (a + r, d/2 + r).
    for (const p of upper.slice(2, -1)) expect(Math.hypot(p.x - 0.151, p.y - 0.011)).toBeCloseTo(0.001, 12)
  })

  it('for r > h, the arc meets the deep face directly', () => {
    // D 30, d 29, r 5 mm: h = 0.5 mm < r.
    const pts = bracketOutline(bracket('s', 0.03, 0.029, 0.15, 0.005), L, 8)
    const upper = pts.slice(0, pts.length / 2)
    expect(upper).toHaveLength(8 + 3)
    expect(upper[1].y).toBe(0.015)
    expect(upper[1].x).toBeGreaterThan(0.15)
    expect(upper[1].x).toBeCloseTo(0.155 - Math.sqrt(0.005 ** 2 - 0.0045 ** 2), 12)
    expect(upper.at(-2)).toEqual({ x: 0.155, y: 0.0145 })
    for (const p of upper.slice(1, -1)) expect(Math.hypot(p.x - 0.155, p.y - (0.0145 + 0.005))).toBeCloseTo(0.005, 12)
  })

  it('for r = h, the arc starts at the shoulder corner without a duplicate point', () => {
    const upper = bracketOutline(bracket('e', 0.03, 0.02, 0.15, 0.005), L, 4).slice(0, 4 + 3)
    expect(upper[1]).toEqual({ x: 0.15, y: 0.015 })
    expect(upper[2].x).toBeGreaterThan(0.15)
  })

  it('is symmetric about the centreline, closed clockwise, and monotone in x along the top', () => {
    const pts = bracketOutline(bracket('b', 0.03, 0.02, 0.15, 0.003), L)
    const n = pts.length / 2
    for (let i = 0; i < n; i++) expect(pts[pts.length - 1 - i]).toEqual({ x: pts[i].x, y: -pts[i].y })
    for (let i = 1; i < n; i++) expect(pts[i].x).toBeGreaterThanOrEqual(pts[i - 1].x)
    for (let i = 1; i < n; i++) expect(pts[i].y).toBeLessThanOrEqual(pts[i - 1].y + 1e-15)
  })

  it('uses at least one arc segment', () => {
    const pts = bracketOutline(bracket('b', 0.03, 0.02, 0.15, 0.001), L, 0)
    expect(pts).toHaveLength(2 * (1 + 4))
  })
})
