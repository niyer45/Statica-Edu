// Feature: heat-sink-1, Property 4: Heat sink scaling laws and identities
// **Validates: HSK-13 (scaling and identities)**
//
// ΔT and T_s − T∞ are linear in Q; R_base does not depend on fin variables; mass is linear in N for
// fixed t and H; η_f depends on t and H only, not on N; T_base − T_s = Q R_base. Asserted at 1e-12
// relative (on rises, where no large absolute temperature is subtracted), or bitwise where a
// quantity does not depend on the input.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbHeatSinkDesign, heatSinkChallenge, relClose } from '../../../test/fixtures/heatSink'
import { assertProperty } from '../../../test/pbt'
import type { HeatSinkChallenge } from '../../challenge/heatSink/types'
import { finGap } from '../../geometry/heatSink/design'
import { analyzeHeatSink } from './analyze'

const ch = heatSinkChallenge()
const REL = 1e-12
const arbK = fc.double({ min: 0.25, max: 4, noNaN: true })
const withLoad = (k: number): HeatSinkChallenge => ({ ...ch, heatLoadW: ch.heatLoadW * k })

/** Fin counts that keep the gap at or above the floor for thickness t. */
const validCounts = (t: number) => {
  const out: number[] = []
  for (let N = ch.designLimits.finCount.min; N <= ch.designLimits.finCount.max; N++) {
    if (finGap(ch.base.widthM, N, t) >= ch.designLimits.minGeometricGapM - 1e-9) out.push(N)
  }
  return out
}

describe('Property 4: scaling laws and identities', () => {
  it('ΔT and θ_b are linear in Q; resistances, efficiencies, areas and mass do not depend on Q', () => {
    assertProperty(
      fc.property(arbHeatSinkDesign(ch), arbK, (d, k) => {
        const a = analyzeHeatSink(d, ch)
        const b = analyzeHeatSink(d, withLoad(k))
        expect(relClose(b.baseTemperatureRiseK, k * a.baseTemperatureRiseK, REL)).toBe(true)
        expect(relClose(b.finRootExcessK, k * a.finRootExcessK, REL)).toBe(true)
        for (const key of ['totalResistanceKPerW', 'finEfficiency', 'overallEfficiency', 'totalAreaM2', 'massKg', 'finHeatShare'] as const) {
          expect(relClose(b[key], a[key], REL), key).toBe(true)
        }
      }),
    )
  })

  it('T_base − T_s = Q R_base, and R_base is the same for every design', () => {
    const rBase = analyzeHeatSink(ch.initialDesign, ch).baseResistanceKPerW
    assertProperty(
      fc.property(arbHeatSinkDesign(ch), (d) => {
        const a = analyzeHeatSink(d, ch)
        expect(Object.is(a.baseResistanceKPerW, rBase)).toBe(true)
        expect(relClose(a.baseTemperatureRiseK - a.finRootExcessK, ch.heatLoadW * rBase, REL)).toBe(true)
        // The absolute-temperature form, within a few ulps of ~300 K.
        expect(Math.abs(a.baseTemperatureK - a.finnedSurfaceTemperatureK - ch.heatLoadW * rBase)).toBeLessThan(1e-12)
      }),
    )
  })

  it('η_f depends on t and H only; mass is linear in N for fixed t and H', () => {
    assertProperty(
      fc.property(arbHeatSinkDesign(ch), (d) => {
        const counts = validCounts(d.finThicknessM)
        expect(counts.length).toBeGreaterThanOrEqual(3)
        const [n1, n2, n3] = [counts[0], counts[Math.floor(counts.length / 2)], counts[counts.length - 1]]
        const [a1, a2, a3] = [n1, n2, n3].map((finCount) => analyzeHeatSink({ ...d, finCount }, ch))
        const base = analyzeHeatSink(d, ch)
        for (const a of [a1, a2, a3]) {
          expect(Object.is(a.finEfficiency, base.finEfficiency)).toBe(true)
          expect(Object.is(a.finParameterPerM, base.finParameterPerM)).toBe(true)
        }
        // Three points on one line: m(N2) − m(N1) = (N2 − N1)/(N3 − N1) · (m(N3) − m(N1)).
        expect(relClose(a2.massKg - a1.massKg, ((n2 - n1) / (n3 - n1)) * (a3.massKg - a1.massKg), REL)).toBe(true)
      }),
    )
  })
})
