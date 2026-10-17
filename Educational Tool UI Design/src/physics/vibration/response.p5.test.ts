// Feature: vibration-isolation-1, Property 5: Damping crossover at r = √2
// **Validates: VIB-02, VIB-13 (damping crossover)**
//
// For r > √2, TR increases strictly with ζ (more damping transmits more vibration in the isolation
// region); for r < √2 it decreases (damping controls resonance). Random r and ζ pairs, excluding a
// 1e-6 neighborhood of √2 where the two TR values coincide to rounding.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { assertProperty } from '../../../test/pbt'
import { transmissibility } from './response'

const arbR = fc.double({ min: 1e-3, max: 20, noNaN: true }).filter((r) => Math.abs(r - Math.SQRT2) > 1e-6)
const arbZetaPair = fc
  .tuple(fc.double({ min: 0.005, max: 1, noNaN: true }), fc.double({ min: 0.005, max: 1, noNaN: true }))
  .filter(([a, b]) => Math.abs(a - b) > 1e-3)
  .map(([a, b]): readonly [number, number] => (a < b ? [a, b] : [b, a]))

describe('Property 5: damping crossover', () => {
  it('TR increases with ζ above √2 and decreases below it', () => {
    assertProperty(
      fc.property(arbR, arbZetaPair, (r, [lo, hi]) => {
        const light = transmissibility(r, lo)
        const heavy = transmissibility(r, hi)
        if (r > Math.SQRT2) expect(heavy).toBeGreaterThan(light)
        else expect(heavy).toBeLessThan(light)
      }),
    )
  })
})
