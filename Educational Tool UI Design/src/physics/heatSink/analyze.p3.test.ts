// Feature: heat-sink-1, Property 3: Valid heat sinks analyze to finite, positive, deterministic results
// **Validates: HSK-06, HSK-13, MM-10**
//
// For every valid design, analyzeHeatSink returns a deep-frozen analysis naming plateFinHeatSink v1
// with every numeric field finite and > 0, identical on repeated calls, with `applicable` true iff
// there are no not-applicable reasons and each code listed at most once. Physical bounds hold:
// 0 < η_f ≤ 1, η_f ≤ η_o ≤ 1, T_base > T_s > T∞, the stored profile falls from the root to the tip
// and stays above T∞, and the fin heat share lies in (0, 1).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbHeatSinkDesign, heatSinkChallenge } from '../../../test/fixtures/heatSink'
import { assertProperty } from '../../../test/pbt'
import { analyzeHeatSink } from './analyze'

const ch = heatSinkChallenge()
const NUMERIC = [
  'finGapM', 'finHeightM', 'channelAspectRatio', 'finBiotNumber', 'finParameterPerM', 'correctedFinLengthM', 'finEfficiency',
  'finAreaM2', 'exposedBaseAreaM2', 'totalAreaM2', 'overallEfficiency', 'effectiveAreaM2', 'baseResistanceKPerW',
  'convectionResistanceKPerW', 'totalResistanceKPerW', 'baseTemperatureK', 'baseTemperatureRiseK', 'finnedSurfaceTemperatureK',
  'finRootExcessK', 'massKg', 'finHeatShare',
] as const

describe('Property 3: finite, positive, deterministic analysis', () => {
  it('holds for every valid design', () => {
    assertProperty(
      fc.property(arbHeatSinkDesign(ch), (d) => {
        const a = analyzeHeatSink(d, ch)
        expect(a.modelId).toBe('plateFinHeatSink')
        expect(a.modelVersion).toBe(1)
        for (const k of NUMERIC) expect(Number.isFinite(a[k]) && a[k] > 0, k).toBe(true)
        expect(Object.isFrozen(a)).toBe(true)
        expect(analyzeHeatSink(d, ch)).toEqual(a)
        expect(a.applicable).toBe(a.notApplicableReasons.length === 0)
        const all = [...a.warnings, ...a.notApplicableReasons].map((i) => i.code)
        expect(new Set(all).size).toBe(all.length)

        expect(a.finEfficiency).toBeLessThanOrEqual(1)
        expect(a.overallEfficiency).toBeGreaterThanOrEqual(a.finEfficiency)
        expect(a.overallEfficiency).toBeLessThanOrEqual(1)
        expect(a.baseTemperatureK).toBeGreaterThan(a.finnedSurfaceTemperatureK)
        expect(a.finnedSurfaceTemperatureK).toBeGreaterThan(ch.ambientTemperatureK)
        expect(a.finHeatShare).toBeLessThan(1)
        expect(a.finProfile[0].excessRatio).toBe(1)
        for (let i = 1; i < a.finProfile.length; i++) {
          expect(a.finProfile[i].excessRatio).toBeLessThan(a.finProfile[i - 1].excessRatio)
          expect(a.finProfile[i].temperatureK).toBeGreaterThan(ch.ambientTemperatureK)
        }
      }),
    )
  })
})
