import { describe, expect, it } from 'vitest'
import { torsionChallenge, worksheetFixture } from '../../../test/fixtures/torsion'
import { analyzeShaft } from '../../physics/torsion/analyze'
import { TORSION_COMPARISON_METRICS, TORSION_PRIMARY_METRIC } from './metrics'

// Torsion prediction and comparison metrics (task 47.2; TSH-06, TSH-08, MM-13).

const ch = torsionChallenge()
const a = analyzeShaft(worksheetFixture('reference').design, ch)

describe('TORSION_PRIMARY_METRIC', () => {
  it('reads the stored twist angle and is named "twist angle", never deflection', () => {
    expect(TORSION_PRIMARY_METRIC.id).toBe('twistRad')
    expect(TORSION_PRIMARY_METRIC.label).toBe('twist angle')
    expect(TORSION_PRIMARY_METRIC.label).not.toMatch(/deflection/i)
    expect(TORSION_PRIMARY_METRIC.read(a)).toBe(a.twistRad)
  })

  it('returns undefined (not scorable) for non-finite or non-positive values', () => {
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(TORSION_PRIMARY_METRIC.read({ ...a, twistRad: v })).toBeUndefined()
    }
  })
})

describe('TORSION_COMPARISON_METRICS', () => {
  it('lists the TSH-06 metrics from stored values, twist first', () => {
    expect(TORSION_COMPARISON_METRICS.map((m) => m.id)).toEqual([
      'twistRad',
      'maxShearStressPa',
      'massKg',
      'outerDiameterM',
      'torsionalStiffnessNmPerRad',
      'polarMomentM4',
    ])
    for (const m of TORSION_COMPARISON_METRICS) {
      expect(m.read(a)).toBe(a[m.id])
      expect(m.label).not.toMatch(/\d|deflection/i)
    }
    expect(Object.isFrozen(TORSION_COMPARISON_METRICS)).toBe(true)
  })
})
