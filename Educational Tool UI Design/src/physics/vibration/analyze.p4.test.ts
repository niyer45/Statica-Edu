// Feature: vibration-isolation-1, Property 4: Vibration scaling laws
// **Validates: VIB-13 (scaling)**
//
// Scaling m and k by the same λ leaves f_n, every TR, Z and δ_st unchanged. Z is linear in Y;
// TR, f_n and δ_st are independent of Y. δ_st ∝ m/k and f_n ∝ √(k/m). Relative 1e-12, or bitwise
// identical where the quantity does not depend on the scaled input.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbVibrationDesign, relClose, vibrationChallenge } from '../../../test/fixtures/vibration'
import { assertProperty } from '../../../test/pbt'
import type { VibrationChallenge } from '../../challenge/vibration/types'
import type { VibrationDesign } from '../../geometry/vibration/design'
import { analyzeIsolator } from './analyze'

const ch = vibrationChallenge()
const REL = 1e-12
const arbK = fc.double({ min: 0.25, max: 4, noNaN: true })

const withMass = (s: number): VibrationChallenge => ({ ...ch, component: { massKg: ch.component.massKg * s } })
const withAmplitude = (s: number): VibrationChallenge => ({ ...ch, excitation: { ...ch.excitation, amplitudeM: ch.excitation.amplitudeM * s } })
const scaledK = (d: VibrationDesign, s: number): VibrationDesign => ({ ...d, stiffnessNPerM: d.stiffnessNPerM * s })

describe('Property 4: scaling laws', () => {
  it('scaling m and k by the same λ leaves f_n, TR, Z and δ_st unchanged', () => {
    assertProperty(
      fc.property(arbVibrationDesign(ch), arbK, (d, s) => {
        const a = analyzeIsolator(d, ch)
        const b = analyzeIsolator(scaledK(d, s), withMass(s))
        for (const k of ['naturalFrequencyHz', 'worstInBandTransmissibility', 'peakTransmissibility', 'peakRelativeDisplacementM', 'staticDeflectionM', 'worstInBandFrequencyHz'] as const) {
          expect(relClose(b[k], a[k], REL), k).toBe(true)
        }
      }),
    )
  })

  it('Z is linear in Y; TR, f_n and δ_st are independent of Y', () => {
    assertProperty(
      fc.property(arbVibrationDesign(ch), arbK, (d, s) => {
        const a = analyzeIsolator(d, ch)
        const b = analyzeIsolator(d, withAmplitude(s))
        expect(relClose(b.peakRelativeDisplacementM, s * a.peakRelativeDisplacementM, REL)).toBe(true)
        for (const k of ['naturalFrequencyHz', 'worstInBandTransmissibility', 'peakTransmissibility', 'staticDeflectionM'] as const) {
          expect(Object.is(b[k], a[k]), k).toBe(true)
        }
      }),
    )
  })

  it('δ_st ∝ m/k and f_n ∝ √(k/m)', () => {
    assertProperty(
      fc.property(arbVibrationDesign(ch), arbK, arbK, (d, sm, sk) => {
        const a = analyzeIsolator(d, ch)
        const b = analyzeIsolator(scaledK(d, sk), withMass(sm))
        expect(relClose(b.staticDeflectionM, (a.staticDeflectionM * sm) / sk, REL)).toBe(true)
        expect(relClose(b.naturalFrequencyHz, a.naturalFrequencyHz * Math.sqrt(sk / sm), REL)).toBe(true)
      }),
    )
  })
})
