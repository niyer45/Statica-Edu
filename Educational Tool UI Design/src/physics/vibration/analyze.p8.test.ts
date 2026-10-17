// Feature: vibration-isolation-1, Property 8: Exact peaks bound the sampled response
// **Validates: VIB-06, VIB-13 (exact, not sampled)**
//
// For every valid design, the closed-form worst in-band TR, peak TR and peak relative displacement
// are never exceeded (beyond 1e-12 relative) by the response sampled at 401 uniformly spaced
// frequencies over their ranges, and the response at each reported frequency equals the reported
// value. The fixture-level dense-grid check at 1e-7 is in test/fixtures/vibration.alternative.test.ts.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbVibrationDesign, relClose, vibrationChallenge } from '../../../test/fixtures/vibration'
import { assertProperty } from '../../../test/pbt'
import { analyzeIsolator } from './analyze'
import { relativeDisplacementRatio, transmissibility } from './response'

const ch = vibrationChallenge()
const { minHz, maxHz } = ch.excitation.operatingBandHz
const Y = ch.excitation.amplitudeM
const N = 401

function sampledMax(f: (hz: number) => number, a: number, b: number): number {
  let best = -Infinity
  for (let i = 0; i < N; i++) best = Math.max(best, f(a + ((b - a) * i) / (N - 1)))
  return best
}

describe('Property 8: exact peaks bound the sampled response', () => {
  it('holds for every valid design', () => {
    assertProperty(
      fc.property(arbVibrationDesign(ch), (d) => {
        const a = analyzeIsolator(d, ch)
        const fn = a.naturalFrequencyHz
        const zeta = a.dampingRatio
        const tr = (hz: number) => transmissibility(hz / fn, zeta)
        const z = (hz: number) => Y * relativeDisplacementRatio(hz / fn, zeta)
        expect(sampledMax(tr, minHz, maxHz)).toBeLessThanOrEqual(a.worstInBandTransmissibility * (1 + 1e-12))
        expect(sampledMax(tr, 0, maxHz)).toBeLessThanOrEqual(a.peakTransmissibility * (1 + 1e-12))
        expect(sampledMax(z, 0, maxHz)).toBeLessThanOrEqual(a.peakRelativeDisplacementM * (1 + 1e-12))
        expect(relClose(tr(a.worstInBandFrequencyHz), a.worstInBandTransmissibility, 1e-12)).toBe(true)
        expect(relClose(tr(a.peakTransmissibilityFrequencyHz), a.peakTransmissibility, 1e-12)).toBe(true)
        expect(relClose(z(a.peakRelativeDisplacementFrequencyHz), a.peakRelativeDisplacementM, 1e-12)).toBe(true)
      }),
    )
  })
})
