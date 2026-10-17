import { describe, expect, it } from 'vitest'
import { bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import { analyzeBracket } from '../../physics/bracket/analyze'
import { BRACKET_COMPARISON_METRICS, BRACKET_PRIMARY_METRIC } from './metrics'

// Bracket prediction and comparison metrics (task 46.2; MBR-07, MBR-09, MM-13).

const ch = bracketChallenge()
const a = analyzeBracket(worksheetFixture('reference').design, ch)

describe('BRACKET_PRIMARY_METRIC', () => {
  it('reads the stored peak stress and is named "peak stress", never deflection', () => {
    expect(BRACKET_PRIMARY_METRIC.id).toBe('peakStressPa')
    expect(BRACKET_PRIMARY_METRIC.label).toBe('peak stress')
    expect(BRACKET_PRIMARY_METRIC.label).not.toMatch(/deflection/i)
    expect(BRACKET_PRIMARY_METRIC.read(a)).toBe(a.peakStressPa)
  })

  it('returns undefined (not scorable) when the peak stress is absent, non-finite or non-positive', () => {
    expect(BRACKET_PRIMARY_METRIC.read(analyzeBracket(worksheetFixture('fitShallowNA').design, ch))).toBeUndefined()
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(BRACKET_PRIMARY_METRIC.read({ ...a, peakStressPa: v })).toBeUndefined()
    }
  })
})

describe('BRACKET_COMPARISON_METRICS', () => {
  it('lists the MBR-07 metrics from stored values, peak stress first', () => {
    expect(BRACKET_COMPARISON_METRICS.map((m) => m.id)).toEqual([
      'peakStressPa',
      'ktStep',
      'rootStressPa',
      'stepNominalStressPa',
      'stepPeakStressPa',
      'tipDeflectionM',
      'massKg',
      'envelopeDepthM',
    ])
    for (const m of BRACKET_COMPARISON_METRICS) {
      expect(m.read(a)).toBe(a[m.id])
      expect(m.label).not.toMatch(/\d/)
    }
    expect(Object.isFrozen(BRACKET_COMPARISON_METRICS)).toBe(true)
  })

  it('reads absent step metrics of a uniform bar as undefined', () => {
    const u = analyzeBracket(worksheetFixture('uniformDeep').design, ch)
    expect(BRACKET_COMPARISON_METRICS.filter((m) => m.read(u) === undefined).map((m) => m.id)).toEqual(['ktStep', 'stepNominalStressPa', 'stepPeakStressPa'])
  })
})
