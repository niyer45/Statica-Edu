import { describe, expect, it } from 'vitest'
import { vibrationChallenge, worksheetFixture } from '../../../test/fixtures/vibration'
import { analyzeIsolator } from '../../physics/vibration/analyze'
import { VIBRATION_COMPARISON_METRICS, VIBRATION_PRIMARY_METRIC } from './metrics'

// Vibration prediction and comparison metrics (task 50.2; VIB-06, VIB-08, MM-13).

const ch = vibrationChallenge()
const a = analyzeIsolator(worksheetFixture('reference').design, ch)

describe('VIBRATION_PRIMARY_METRIC', () => {
  it('reads the stored worst in-band transmissibility, named for students, never deflection or twist', () => {
    expect(VIBRATION_PRIMARY_METRIC.id).toBe('worstInBandTransmissibility')
    expect(VIBRATION_PRIMARY_METRIC.label).toBe('worst vibration transmitted in the operating band')
    expect(VIBRATION_PRIMARY_METRIC.label).not.toMatch(/deflection|twist/i)
    expect(VIBRATION_PRIMARY_METRIC.read(a)).toBe(a.worstInBandTransmissibility)
  })

  it('returns undefined (not scorable) for non-finite or non-positive values', () => {
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(VIBRATION_PRIMARY_METRIC.read({ ...a, worstInBandTransmissibility: v })).toBeUndefined()
    }
  })
})

describe('VIBRATION_COMPARISON_METRICS', () => {
  it('lists the VIB-06 metrics from stored values, the primary metric first', () => {
    expect(VIBRATION_COMPARISON_METRICS.map((m) => m.id)).toEqual([
      'worstInBandTransmissibility',
      'naturalFrequencyHz',
      'staticDeflectionM',
      'peakTransmissibility',
      'peakRelativeDisplacementM',
      'stiffnessNPerM',
      'dampingRatio',
    ])
    for (const m of VIBRATION_COMPARISON_METRICS) {
      expect(m.read(a)).toBe(a[m.id])
      expect(m.label).not.toMatch(/\d|twist/i)
    }
    expect(Object.isFrozen(VIBRATION_COMPARISON_METRICS)).toBe(true)
  })
})
