import { describe, expect, it } from 'vitest'
import { APPLICABILITY_CODES, ASSUMPTIONS, THRESHOLDS, UNSUPPORTED_EFFECTS } from './constants'

describe('applicability thresholds', () => {
  it('defines the 14 values from the design table', () => {
    const values = Object.fromEntries(
      Object.entries(THRESHOLDS).map(([code, th]) => [code, [th.warning, th.notApplicable]]),
    )
    expect(values).toEqual({
      DEPTH_SPAN: [0.1, 0.2],
      LARGE_DEFLECTION: [0.02, 0.1],
      PLASTICITY: [0.8, 1.0],
      TUBE_SLENDERNESS: [40, 100],
      FLANGE_OUTSTAND: [10, 20],
      WEB_SLENDERNESS: [60, 120],
      RECT_ASPECT: [8, 20],
    })
  })

  it('has one entry per code, each naming a metric and an effect, warning < notApplicable', () => {
    expect(Object.keys(THRESHOLDS).sort()).toEqual([...APPLICABILITY_CODES].sort())
    for (const th of Object.values(THRESHOLDS)) {
      expect(th.warning).toBeLessThan(th.notApplicable)
      expect(th.metric.length).toBeGreaterThan(0)
      expect(th.effect.length).toBeGreaterThan(0)
    }
  })
})

describe('model metadata', () => {
  it('lists exactly the nine unsupported effects', () => {
    expect(UNSUPPORTED_EFFECTS).toEqual([
      'torsion',
      'shear deformation',
      'local buckling',
      'lateral-torsional buckling',
      'plasticity',
      'large deflection',
      'root stress concentrations',
      'joint/fastener compliance',
      'self-weight',
    ])
  })

  it('lists the model assumptions', () => {
    expect(ASSUMPTIONS.length).toBe(8)
  })

  it('freezes all exported collections', () => {
    expect(Object.isFrozen(THRESHOLDS)).toBe(true)
    for (const th of Object.values(THRESHOLDS)) expect(Object.isFrozen(th)).toBe(true)
    expect(Object.isFrozen(UNSUPPORTED_EFFECTS)).toBe(true)
    expect(Object.isFrozen(ASSUMPTIONS)).toBe(true)
    expect(Object.isFrozen(APPLICABILITY_CODES)).toBe(true)
    expect(() => (UNSUPPORTED_EFFECTS as string[]).push('x')).toThrow()
  })
})
