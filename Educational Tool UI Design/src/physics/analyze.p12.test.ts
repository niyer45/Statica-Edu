// Feature: engineering-intuition-mvp, Property 12: Extreme fiber
// **Validates: Requirements 8.9, 9.1, 9.10**
//
// For every valid design and orientation, analyze(...).extremeFiberM equals half the oriented
// Envelope height (Y) within GEOM_TOL, and nominalMaxStressPa = F·L·c/I_bend (relative 1e-12)
// using the analysis's own c and bendingInertiaM4. A rectangle with h ≠ b must use a different
// extreme fiber at 0° (h/2) than at 90° (b/2), and its stress must follow the matching closed
// form (6M/(b·h²) at 0°, 6M/(h·b²) at 90°).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbDesign, arbDesignWith, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { orientedEnvelope } from '../geometry/envelope'
import { GEOM_TOL, type BeamDesign } from '../geometry/sections'
import { analyze } from './analyze'

const ch = bundledChallenge()
const F = ch.load.forceN

const REL = 1e-12

function relClose(a: number, b: number, rel = REL): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b))
}

function expectRelClose(actual: number, expected: number, label: string): void {
  if (!relClose(actual, expected)) {
    throw new Error(`${label}: ${String(actual)} vs expected ${String(expected)} (rel ${String(REL)})`)
  }
}

describe('Property 12: extreme fiber', () => {
  it('c = envelope height / 2 and σ = F·L·c/I_bend for every valid design and orientation', () => {
    assertProperty(
      fc.property(arbDesign(ch), (d) => {
        const a = analyze(d, ch)
        const env = orientedEnvelope(d.section, d.orientationDeg)

        expect(Math.abs(a.extremeFiberM - env.heightYM / 2)).toBeLessThanOrEqual(GEOM_TOL)

        const expectedStress = (F * d.lengthM * a.extremeFiberM) / a.bendingInertiaM4
        expectRelClose(a.nominalMaxStressPa, expectedStress, 'nominalMaxStressPa')
      }),
    )
  })

  it('rectangle with h ≠ b uses h/2 at 0° and b/2 at 90°, with matching stress', () => {
    const arbRect = arbDesignWith(ch, { kinds: ['rectangle'] }).filter(
      (d) => d.section.kind === 'rectangle' && Math.abs(d.section.heightM - d.section.widthM) > 1e-6,
    )
    assertProperty(
      fc.property(arbRect, (d) => {
        if (d.section.kind !== 'rectangle') throw new Error('expected rectangle')
        const { widthM: b, heightM: h } = d.section
        const a0 = analyze({ ...d, orientationDeg: 0 }, ch)
        const a90 = analyze({ ...d, orientationDeg: 90 }, ch)

        expect(Math.abs(a0.extremeFiberM - h / 2)).toBeLessThanOrEqual(GEOM_TOL)
        expect(Math.abs(a90.extremeFiberM - b / 2)).toBeLessThanOrEqual(GEOM_TOL)
        expect(a0.extremeFiberM).not.toBe(a90.extremeFiberM)

        const M = F * d.lengthM
        expectRelClose(a0.nominalMaxStressPa, (6 * M) / (b * h * h), 'σ at 0°')
        expectRelClose(a90.nominalMaxStressPa, (6 * M) / (h * b * b), 'σ at 90°')
      }),
    )
  })

  it('example: rectTall 15 × 45 mm gives c = 22.5 mm at 0° and 7.5 mm at 90°', () => {
    const base: BeamDesign = {
      ...structuredClone(ch.initialDesign),
      section: { kind: 'rectangle', widthM: 0.015, heightM: 0.045 },
    }
    const a0 = analyze({ ...base, orientationDeg: 0 }, ch)
    const a90 = analyze({ ...base, orientationDeg: 90 }, ch)
    expect(a0.extremeFiberM).toBeCloseTo(0.0225, 12)
    expect(a90.extremeFiberM).toBeCloseTo(0.0075, 12)
    // Tall at 0° is stiffer and less stressed than the same rectangle laid flat.
    expect(a0.nominalMaxStressPa).toBeLessThan(a90.nominalMaxStressPa)
  })
})
