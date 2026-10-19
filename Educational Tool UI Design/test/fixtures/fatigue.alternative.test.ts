import { describe, expect, it } from 'vitest'
import { analyzeFatigue } from '../../src/physics/fatigue/analyze'
import { neuberConstantSqrtMm, notchSensitivity, shoulderFilletKt } from '../../src/physics/fatigue/formulas'
import { fatigueChallenge, spindle } from './fatigue'

// Task 70: independent routes to the fatigue model's inputs (design.md, alternative-method checks).
// These are not transcriptions of the implementation: published worked values, numerical
// quadrature and slicing are used instead of the closed forms.

const ch = fatigueChallenge()

/** Composite Simpson rule on [a, b] with n (even) panels. */
function simpson(f: (x: number) => number, a: number, b: number, n = 400): number {
  const h = (b - a) / n
  let s = f(a) + f(b)
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h)
  return (s * h) / 3
}

describe('Fatigue Analysis I alternative-method checks', () => {
  it('Neuber constant and q reproduce a Shigley worked solution (Sut 470 MPa, r 3 mm: √a 0.4933, q 0.78)', () => {
    expect(neuberConstantSqrtMm(470e6)).toBeCloseTo(0.4933, 4)
    expect(notchSensitivity(470e6, 0.003)).toBeCloseTo(0.78, 2)
  })

  it('the Kt fit is within about 6 % (conservative) of a published chart reading', () => {
    // Shigley worked solution: D/d = 50/35, r/d = 3/35, Kt ≈ 1.7 read from the bending chart.
    const kt = shoulderFilletKt(0.05, 0.035, 0.003)
    expect(kt).toBeCloseTo(1.80554427627569, 12)
    expect(kt / 1.7 - 1).toBeGreaterThan(0)
    expect(kt / 1.7 - 1).toBeLessThan(0.07)
  })

  it('Kt falls toward 1 as the step shrinks and grows as the fillet sharpens', () => {
    const series = [0.04, 0.036, 0.033, 0.0315, 0.0305].map((D) => shoulderFilletKt(D, 0.03, 0.002))
    for (let i = 1; i < series.length; i++) expect(series[i]!).toBeLessThan(series[i - 1]!)
    expect(series.at(-1)!).toBeLessThan(1.4)
    expect(series.at(-1)!).toBeGreaterThan(1)
    expect(shoulderFilletKt(0.045, 0.022, 0.0005)).toBeGreaterThan(shoulderFilletKt(0.045, 0.022, 0.005))
  })

  it('the nominal stress equals M c / I with I from quadrature (substitution y = R sin t)', () => {
    for (const d of [0.02, 0.022, 0.0305, 0.04]) {
      const R = d / 2
      const I = simpson((t) => (R * Math.sin(t)) ** 2 * 2 * R * Math.cos(t) * R * Math.cos(t), -Math.PI / 2, Math.PI / 2)
      const a = analyzeFatigue(spindle('q', d, 0.06, 0.0005, 'machined'), ch)
      expect((a.alternatingMomentNm * R) / I / a.nominalAlternatingStressPa).toBeCloseTo(1, 12)
    }
  })

  it('the mass equals the density times the volume from slicing the revolved profile', () => {
    const d = ch.referenceDesign!
    const radius = (x: number) => (x < ch.geometry.collarLengthM ? d.collarDiameterM / 2 : d.neckDiameterM / 2)
    const L = ch.geometry.collarLengthM + ch.geometry.neckLengthM
    // Integrate each piece separately so the step is not smeared by the rule.
    const v =
      simpson((x) => Math.PI * radius(x) ** 2, 0, ch.geometry.collarLengthM - 1e-12) +
      simpson((x) => Math.PI * radius(x) ** 2, ch.geometry.collarLengthM + 1e-12, L)
    expect((ch.material.densityKgM3 * v) / analyzeFatigue(d, ch).massKg).toBeCloseTo(1, 9)
  })
})
