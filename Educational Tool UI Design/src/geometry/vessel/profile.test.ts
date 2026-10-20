import { describe, expect, it } from 'vitest'
import { vessel } from '../../../test/fixtures/vessel'
import { vesselHalfExtentM, vesselPressureStations, vesselProfile, vesselWallSection, VESSEL_ARC_SEGMENTS } from './profile'

// Pressure vessel display profile (task 69; PVS-12, PVS-15): the drawn shape is the modeled shape.

const d = vessel('p', 0.4, 0.5, 0.006, 0.003)

describe('vesselProfile', () => {
  const { outer, inner } = vesselProfile(d)

  it('runs from pole to pole on the axis, left to right', () => {
    for (const curve of [outer, inner]) {
      expect(curve[0]!.y).toBeCloseTo(0, 12)
      expect(curve.at(-1)!.y).toBeCloseTo(0, 12)
      for (let i = 1; i < curve.length; i++) expect(curve[i]!.x).toBeGreaterThanOrEqual(curve[i - 1]!.x - 1e-12)
    }
    expect(outer[0]!.x).toBeCloseTo(-vesselHalfExtentM(d), 12)
    expect(outer.at(-1)!.x).toBeCloseTo(vesselHalfExtentM(d), 12)
    expect(inner[0]!.x).toBeCloseTo(-(0.25 + 0.2), 12)
  })

  it('keeps the inner surface at radius r: the shell straight, the heads hemispheres centred on the junctions', () => {
    for (const p of inner) {
      const cx = p.x < 0 ? -0.25 : 0.25
      const radial = Math.abs(p.x) <= 0.25 ? p.y : Math.hypot(p.x - cx, p.y)
      expect(radial).toBeCloseTo(0.2, 12)
    }
  })

  it('draws the shell wall t_s and the head wall t_h, stepping at the junctions', () => {
    const shell = outer.filter((p) => Math.abs(p.x) <= 0.25 && Math.abs(p.y - 0.206) < 1e-12)
    expect(shell.map((p) => p.x)).toEqual([-0.25, 0.25])
    for (const p of outer.filter((q) => Math.abs(q.x) > 0.25 + 1e-12)) {
      expect(Math.hypot(p.x - Math.sign(p.x) * 0.25, p.y)).toBeCloseTo(0.203, 12)
    }
    expect(outer).toHaveLength(2 * (VESSEL_ARC_SEGMENTS + 1) + 2)
    expect(inner).toHaveLength(2 * (VESSEL_ARC_SEGMENTS + 1))
  })

  it('closes the wall section as outer then reversed inner', () => {
    const section = vesselWallSection(d, 4)
    const p = vesselProfile(d, 4)
    expect(section).toEqual([...p.outer, ...[...p.inner].reverse()])
  })
})

describe('vesselPressureStations (internal-pressure arrows)', () => {
  it('puts every station on the inner surface with a unit normal pointing out of the cavity', () => {
    for (const [D, L] of [[0.24, 1.2], [0.4, 0.53], [0.5, 0.1], [0.2, 1.2]] as const) {
      const r = D / 2
      const half = L / 2
      const stations = vesselPressureStations({ innerDiameterM: D, shellLengthM: L })
      for (const { point, normal } of stations) {
        expect(Math.hypot(normal.x, normal.y)).toBeCloseTo(1, 12)
        // On the shell (|x| <= L/2) the surface is at y = r; on a head it is r from the head centre.
        const centre = Math.abs(point.x) <= half + 1e-12 ? { x: point.x, y: 0 } : { x: Math.sign(point.x) * half, y: 0 }
        expect(Math.hypot(point.x - centre.x, point.y - centre.y)).toBeCloseTo(r, 12)
        // Outward: a small step along the normal moves away from the centre line or head centre.
        const step = { x: point.x + 1e-3 * normal.x, y: point.y + 1e-3 * normal.y }
        expect(Math.hypot(step.x - centre.x, step.y - centre.y)).toBeGreaterThan(r)
      }
      const xs = stations.map((s) => s.point.x)
      expect([...xs].sort((a, b) => a - b)).toEqual(xs)
    }
  })

  it('scales the shell stations with length (1 to 5) and always marks both heads', () => {
    const shellCount = (D: number, L: number) => vesselPressureStations({ innerDiameterM: D, shellLengthM: L }).filter((s) => s.normal.x === 0).length
    expect(shellCount(0.5, 0.1)).toBe(1)
    expect(shellCount(0.4, 0.53)).toBe(3)
    expect(shellCount(0.2, 1.2)).toBe(5)
    const ends = vesselPressureStations({ innerDiameterM: 0.4, shellLengthM: 0.53 })
    expect(ends[0]!.normal).toEqual({ x: -1, y: 0 })
    expect(ends[ends.length - 1]!.normal).toEqual({ x: 1, y: 0 })
  })
})
