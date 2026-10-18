import { describe, expect, it } from 'vitest'
import { torsionChallenge } from '../../../../test/fixtures/torsion'
import { displayedTwist } from './shared'
import { shaftOuterDiameterM, torsionSceneFrame, TWIST_LINE_SAMPLES, TWIST_LINE_START_RAD, twistLinePoints } from './shaftLayout'

// Display-only 3D shaft layout (task 54.2).

const ch = torsionChallenge()

describe('displayedTwist', () => {
  it('exaggerates the stored angle by the configured factor', () => {
    expect(displayedTwist(0.01, ch.visualization)).toEqual({ shownRad: 0.01 * ch.visualization.twistExaggerationFactor, capped: false })
  })
  it('caps the drawn angle at maxVisualTwistRad and reports it', () => {
    expect(displayedTwist(1, ch.visualization)).toEqual({ shownRad: ch.visualization.maxVisualTwistRad, capped: true })
  })
})

describe('twistLinePoints', () => {
  it('runs root to free end on the outer surface, turning by exactly the shown angle', () => {
    const points = twistLinePoints(0.015, 0.8, 0.5)
    expect(points).toHaveLength(TWIST_LINE_SAMPLES + 1)
    expect(points[0]![0]).toBe(0)
    expect(points.at(-1)![0]).toBeCloseTo(0.8, 12)
    const angle = ([, y, z]: number[]) => Math.atan2(z!, y!)
    expect(angle(points[0]!)).toBeCloseTo(TWIST_LINE_START_RAD, 12)
    expect(angle(points.at(-1)!)).toBeCloseTo(TWIST_LINE_START_RAD + 0.5, 12)
    for (const [, y, z] of points) {
      const r = Math.hypot(y, z)
      expect(r).toBeGreaterThan(0.015)
      expect(r).toBeLessThan(0.016)
    }
  })
  it('is a straight line along the shaft when the shown angle is zero', () => {
    const points = twistLinePoints(0.02, 0.8, 0)
    for (const [, y, z] of points) {
      expect(y).toBeCloseTo(points[0]![1], 12)
      expect(z).toBeCloseTo(points[0]![2], 12)
    }
  })
})

describe('torsionSceneFrame', () => {
  it('keeps the wall from the challenge and fits the clamp and torque arrow around the draft', () => {
    const small = torsionSceneFrame(0.8, 0.03, 0.06)
    const large = torsionSceneFrame(0.8, 0.05, 0.06)
    expect(small.wall).toEqual(large.wall)
    expect(small.floorY).toBe(large.floorY)
    expect(small.clamp.sizeM).toBeGreaterThan(0.03)
    expect(large.clamp.sizeM).toBeGreaterThan(0.05)
    expect(small.torque.radiusM).toBeGreaterThan(0.015)
    expect(small.torque.x).toBeGreaterThan(0.8)
    expect(small.floorY).toBeLessThan(-0.03)
  })
  it('reads the outer diameter of either shaft section', () => {
    expect(shaftOuterDiameterM({ kind: 'circle', diameterM: 0.03 })).toBe(0.03)
    expect(shaftOuterDiameterM({ kind: 'tube', outerDiameterM: 0.05, innerDiameterM: 0.044 })).toBe(0.05)
  })
})
