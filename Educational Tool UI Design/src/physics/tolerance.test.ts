import { describe, expect, it } from 'vitest'
import { REL_TOL, withinLimit } from './tolerance'

describe('withinLimit', () => {
  it('uses REL_TOL = 1e-9', () => {
    expect(REL_TOL).toBe(1e-9)
  })

  it('passes when value equals limit', () => {
    for (const lim of [0.1, 1, 0.001, 180, 1e-12, 0, -5]) {
      expect(withinLimit(lim, lim)).toBe(true)
    }
  })

  it('passes below the limit and within REL_TOL above it', () => {
    expect(withinLimit(0.05, 0.1)).toBe(true)
    expect(withinLimit(0.1 * (1 + 5e-10), 0.1)).toBe(true)
  })

  it('fails beyond REL_TOL above the limit', () => {
    expect(withinLimit(0.1 * (1 + 1e-6), 0.1)).toBe(false)
    expect(withinLimit(2, 1)).toBe(false)
  })

  it('treats the design at-threshold examples as within the limit', () => {
    // Note: in IEEE-754 doubles 0.06 / 0.6 evaluates to exactly 0.1.
    expect(withinLimit(0.06 / 0.6, 0.1)).toBe(true)
    expect(withinLimit(0.09999999999999999, 0.1)).toBe(true)
    expect(withinLimit(0.1000000000000001, 0.1)).toBe(true)
  })

  it('never passes non-finite inputs', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(withinLimit(bad, 1)).toBe(false)
      expect(withinLimit(0.5, bad)).toBe(false)
    }
  })

  it('is monotone in value', () => {
    const lim = 0.02
    const values = [-1, 0, 0.01, 0.02, 0.02 * (1 + 1e-10), 0.02 * (1 + 1e-6), 1]
    const results = values.map((v) => withinLimit(v, lim))
    // Once a value fails, every larger value fails too.
    const firstFail = results.indexOf(false)
    expect(firstFail).toBeGreaterThan(0)
    expect(results.slice(firstFail).every((r) => !r)).toBe(true)
  })

  it('loosens (not tightens) negative limits', () => {
    expect(withinLimit(-1 + 5e-10, -1)).toBe(true)
    expect(withinLimit(-1 + 1e-6, -1)).toBe(false)
  })
})
