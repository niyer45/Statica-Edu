import { describe, expect, it } from 'vitest'
import { bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import { analyzeBracket } from '../../physics/bracket/analyze'
import { BRACKET_COMPARISON_METRICS, BRACKET_PRIMARY_METRIC } from './metrics'

// Bracket prediction and comparison metrics (task 55 L-bracket; MM-13).

const ch = bracketChallenge()
const a = analyzeBracket(worksheetFixture('reference').design, ch)

describe('BRACKET_PRIMARY_METRIC', () => {
  it('reads the stored bend stress and is named "bend stress"', () => {
    expect(BRACKET_PRIMARY_METRIC.id).toBe('bendStressPa')
    expect(BRACKET_PRIMARY_METRIC.label).toBe('bend stress')
    expect(BRACKET_PRIMARY_METRIC.read(a)).toBe(a.bendStressPa)
  })

  it('returns undefined (not scorable) for a non-finite or non-positive stored value', () => {
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(BRACKET_PRIMARY_METRIC.read({ ...a, bendStressPa: v })).toBeUndefined()
    }
  })
})

describe('BRACKET_COMPARISON_METRICS', () => {
  it('lists the stored comparison metrics, bend stress first', () => {
    expect(BRACKET_COMPARISON_METRICS.map((m) => m.id)).toEqual([
      'bendStressPa',
      'curvedBeamFactor',
      'nominalBendStressPa',
      'deflectionM',
      'boltTensionN',
      'boltLeverArmM',
      'massKg',
    ])
    for (const m of BRACKET_COMPARISON_METRICS) {
      expect(m.read(a)).toBe(a[m.id])
      expect(m.label).not.toMatch(/\d/)
    }
    expect(Object.isFrozen(BRACKET_COMPARISON_METRICS)).toBe(true)
  })
})
