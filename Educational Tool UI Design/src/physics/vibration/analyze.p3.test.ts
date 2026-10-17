// Feature: vibration-isolation-1, Property 3: Valid isolators analyze to finite, positive, deterministic results
// **Validates: VIB-06, VIB-13, MM-10**
//
// For every valid design, analyzeIsolator returns a deep-frozen analysis naming sdofBaseIsolation v1
// with every numeric field finite and > 0, identical on repeated calls, with `applicable` true iff
// there are no not-applicable reasons, each code listed at most once, the reported frequencies
// inside their ranges, isolation efficiency present iff TR_worst < 1, and δ_st·k = m g.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbVibrationDesign, relClose, vibrationChallenge } from '../../../test/fixtures/vibration'
import { assertProperty } from '../../../test/pbt'
import { analyzeIsolator } from './analyze'
import { STANDARD_GRAVITY_MS2 } from './constants'

const ch = vibrationChallenge()
const NUMERIC = [
  'stiffnessNPerM',
  'naturalFrequencyHz',
  'dampingRatio',
  'dampingCoefficientNsPerM',
  'frequencyRatioAtBandMin',
  'frequencyRatioAtBandMax',
  'worstInBandTransmissibility',
  'worstInBandFrequencyHz',
  'peakTransmissibility',
  'peakTransmissibilityFrequencyHz',
  'staticDeflectionM',
  'peakRelativeDisplacementM',
  'peakRelativeDisplacementFrequencyHz',
  'strokeRatio',
] as const
const { minHz, maxHz } = ch.excitation.operatingBandHz

describe('Property 3: finite, positive, deterministic analysis', () => {
  it('holds for every valid design', () => {
    assertProperty(
      fc.property(arbVibrationDesign(ch), (d) => {
        const a = analyzeIsolator(d, ch)
        expect(a.modelId).toBe('sdofBaseIsolation')
        expect(a.modelVersion).toBe(1)
        for (const k of NUMERIC) expect(Number.isFinite(a[k]) && a[k] > 0, k).toBe(true)
        expect(Object.isFrozen(a)).toBe(true)
        expect(analyzeIsolator(d, ch)).toEqual(a)
        expect(a.applicable).toBe(a.notApplicableReasons.length === 0)
        const all = [...a.warnings, ...a.notApplicableReasons].map((i) => i.code)
        expect(new Set(all).size).toBe(all.length)
        expect(a.worstInBandFrequencyHz).toBeGreaterThanOrEqual(minHz)
        expect(a.worstInBandFrequencyHz).toBeLessThanOrEqual(maxHz)
        expect(a.peakTransmissibilityFrequencyHz).toBeLessThanOrEqual(maxHz)
        expect(a.peakRelativeDisplacementFrequencyHz).toBeLessThanOrEqual(maxHz)
        expect(a.peakTransmissibility).toBeGreaterThanOrEqual(a.worstInBandTransmissibility)
        expect(a.isolationEfficiency !== undefined).toBe(a.worstInBandTransmissibility < 1)
        expect(relClose(a.staticDeflectionM * a.stiffnessNPerM, ch.component.massKg * STANDARD_GRAVITY_MS2, 1e-12)).toBe(true)
      }),
    )
  })
})
