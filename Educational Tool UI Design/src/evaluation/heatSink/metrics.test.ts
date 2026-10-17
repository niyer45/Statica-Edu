import { describe, expect, it } from 'vitest'
import { heatSinkChallenge, worksheetFixture } from '../../../test/fixtures/heatSink'
import { analyzeHeatSink } from '../../physics/heatSink/analyze'
import { HEAT_SINK_COMPARISON_METRICS, HEAT_SINK_PRIMARY_METRIC } from './metrics'

// Heat sink prediction and comparison metrics (task 48.2; HSK-06, HSK-08, MM-13).

const ch = heatSinkChallenge()
const a = analyzeHeatSink(worksheetFixture('reference').design, ch)

describe('HEAT_SINK_PRIMARY_METRIC', () => {
  it('reads the stored base temperature rise and is named "base temperature rise", never deflection or stress', () => {
    expect(HEAT_SINK_PRIMARY_METRIC.id).toBe('baseTemperatureRiseK')
    expect(HEAT_SINK_PRIMARY_METRIC.label).toBe('base temperature rise')
    expect(HEAT_SINK_PRIMARY_METRIC.label).not.toMatch(/deflection|stress/i)
    expect(HEAT_SINK_PRIMARY_METRIC.read(a)).toBe(a.baseTemperatureRiseK)
  })

  it('is independent of the °C/K offset: the ratio uses the rise, not the absolute temperature', () => {
    const warmer = analyzeHeatSink(worksheetFixture('reference').design, { ...ch, ambientTemperatureK: 318.15 })
    expect(HEAT_SINK_PRIMARY_METRIC.read(warmer)).toBe(HEAT_SINK_PRIMARY_METRIC.read(a))
  })

  it('returns undefined (not scorable) for non-finite or non-positive values', () => {
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(HEAT_SINK_PRIMARY_METRIC.read({ ...a, baseTemperatureRiseK: v })).toBeUndefined()
    }
  })
})

describe('HEAT_SINK_COMPARISON_METRICS', () => {
  it('lists the HSK-06 metrics from stored values, the rise first', () => {
    expect(HEAT_SINK_COMPARISON_METRICS.map((m) => m.id)).toEqual([
      'baseTemperatureRiseK',
      'baseTemperatureK',
      'massKg',
      'finEfficiency',
      'overallEfficiency',
      'totalAreaM2',
      'effectiveAreaM2',
      'finGapM',
      'finHeightM',
      'finHeatShare',
      'totalResistanceKPerW',
    ])
    for (const m of HEAT_SINK_COMPARISON_METRICS) {
      expect(m.read(a)).toBe(a[m.id])
      expect(m.label).not.toMatch(/\d|deflection|stress/i)
    }
    expect(Object.isFrozen(HEAT_SINK_COMPARISON_METRICS)).toBe(true)
  })
})
