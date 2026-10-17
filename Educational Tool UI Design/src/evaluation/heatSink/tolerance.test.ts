import { describe, expect, it } from 'vitest'
import { lowerToleranceEdge, nextDown } from '../../../test/heatSinkNumeric'
import { REL_TOL } from '../tolerance'
import { withinLowerLimit } from './tolerance'

// Inclusive lower-bound comparison (task 48.2; HSK-07). Mirrors withinLimit (design D-09).

describe('withinLowerLimit', () => {
  it('passes at and above the limit, inclusive', () => {
    expect(withinLowerLimit(0.004, 0.004)).toBe(true)
    expect(withinLowerLimit(0.005, 0.004)).toBe(true)
    expect(withinLowerLimit(0.0039, 0.004)).toBe(false)
  })

  it('allows exactly REL_TOL relative slack below the limit, then fails one double past it', () => {
    const edge = lowerToleranceEdge(0.004, REL_TOL)
    expect(withinLowerLimit(edge, 0.004)).toBe(true)
    expect(withinLowerLimit(nextDown(edge), 0.004)).toBe(false)
    expect(withinLowerLimit(0.004 * (1 - 0.5 * REL_TOL), 0.004)).toBe(true)
    expect(withinLowerLimit(0.004 * (1 - 4 * REL_TOL), 0.004)).toBe(false)
  })

  it('takes the slack from |limit| so it loosens the limit for any sign', () => {
    expect(withinLowerLimit(-1 - 0.5 * REL_TOL, -1)).toBe(true)
    expect(withinLowerLimit(-1 - 4 * REL_TOL, -1)).toBe(false)
    expect(withinLowerLimit(0, 0)).toBe(true)
    expect(withinLowerLimit(-Number.MIN_VALUE, 0)).toBe(false)
  })

  it('accepts a custom tolerance', () => {
    expect(withinLowerLimit(0.99, 1, 0.01)).toBe(true)
    expect(withinLowerLimit(0.98, 1, 0.01)).toBe(false)
  })

  it('never passes non-finite inputs', () => {
    for (const [v, l] of [
      [Number.NaN, 1],
      [Number.POSITIVE_INFINITY, 1],
      [Number.NEGATIVE_INFINITY, 1],
      [1, Number.NaN],
      [1, Number.NEGATIVE_INFINITY],
    ]) {
      expect(withinLowerLimit(v, l)).toBe(false)
    }
  })
})
