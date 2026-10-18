import { describe, expect, it } from 'vitest'
import type { HeatSinkChallenge } from '../../src/challenge/heatSink/types'
import { analyzeHeatSink } from '../../src/physics/heatSink/analyze'
import type { HeatSinkAnalysis } from '../../src/physics/heatSink/types'
import { HEAT_SINK_WORKSHEET, heatSinkChallenge, relClose, worksheetFixture, type HeatSinkFixture } from './heatSink'

// HSK-13 alternative-method and limiting checks (heat-sink-1 design.md "Independent checks").
// These check the closed-form corrected-length model against independent routes: an energy
// balance, a second-order finite-difference fin with the exact convective tip, the exact
// convective-tip solution, and the h → 0 / k → ∞ limits. None of this code is used by the app.

const ch = heatSinkChallenge()
const h = ch.convection.coefficientWPerM2K
const k = ch.material.thermalConductivityWPerMK

/** Solves the tridiagonal system (sub a, diagonal b, super c, right side d) by the Thomas algorithm. Test code only. */
function thomas(a: number[], b: number[], c: number[], d: number[]): number[] {
  const n = b.length
  const cp = new Array<number>(n)
  const dp = new Array<number>(n)
  cp[0] = c[0] / b[0]
  dp[0] = d[0] / b[0]
  for (let i = 1; i < n; i++) {
    const den = b[i] - a[i] * cp[i - 1]
    cp[i] = c[i] / den
    dp[i] = (d[i] - a[i] * dp[i - 1]) / den
  }
  const x = new Array<number>(n)
  x[n - 1] = dp[n - 1]
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1]
  return x
}

/**
 * Second-order central-difference solution of θ'' = m²θ on [0, L] with θ(0) = 1 and a tip
 * condition −θ'(L) = β θ(L) (β = h/k: exact convective tip; β = 0: adiabatic), using a ghost node
 * θ_{n+1} = θ_{n−1} − 2Δx β θ_n. Returns the nodal profile θ_0..θ_n and the fin heat per k A_c θ_b
 * in energy form, m² ∫θ dx (trapezoid) + β θ(L).
 */
function fdFin(m: number, L: number, beta: number, n: number): { theta: number[]; heat: number } {
  const dx = L / n
  const diag = 2 + m * m * dx * dx
  const a: number[] = [], b: number[] = [], c: number[] = [], d: number[] = []
  for (let i = 1; i <= n; i++) {
    const tip = i === n
    a.push(tip ? 2 : 1)
    b.push(tip ? -(diag + 2 * dx * beta) : -diag)
    c.push(tip ? 0 : 1)
    d.push(i === 1 ? -1 : 0)
  }
  const theta = [1, ...thomas(a, b, c, d)]
  let integral = 0
  for (let i = 0; i < n; i++) integral += ((theta[i] + theta[i + 1]) / 2) * dx
  return { theta, heat: m * m * integral + beta * theta[n] }
}

/** Exact convective-tip fin heat per k A_c θ_b: m (sinh mH + (h/mk) cosh mH)/(cosh mH + (h/mk) sinh mH). */
function exactConvectiveTip(m: number, H: number): number {
  const r = h / (m * k)
  const mH = m * H
  return (m * (Math.sinh(mH) + r * Math.cosh(mH))) / (Math.cosh(mH) + r * Math.sinh(mH))
}

/** The model's fin heat per k A_c θ_b from stored values: η_f h A_f / (k D t). */
function modelFinHeat(f: HeatSinkFixture, a: HeatSinkAnalysis): number {
  return (a.finEfficiency * h * a.finAreaM2) / (k * ch.base.depthM * f.design.finThicknessM)
}

const rows = HEAT_SINK_WORKSHEET.map((f) => [f.name, f] as const)

describe('(a) energy balance', () => {
  it.each(rows)('%s: Q_fins + Q_base closes to Q within 1e-12', (_n, f) => {
    const a = analyzeHeatSink(f.design, ch)
    const N = f.design.finCount
    const qFins = N * a.finEfficiency * h * a.finAreaM2 * a.finRootExcessK
    const qBase = h * a.exposedBaseAreaM2 * a.finRootExcessK
    expect(relClose(qFins + qBase, ch.heatLoadW, 1e-12)).toBe(true)
    // Parallel-network form of the same resistance.
    expect(relClose(1 / a.convectionResistanceKPerW, N * a.finEfficiency * h * a.finAreaM2 + h * a.exposedBaseAreaM2, 1e-12)).toBe(true)
    // The stored fin heat share is Q_fins / Q.
    expect(relClose(a.finHeatShare, qFins / ch.heatLoadW, 1e-12)).toBe(true)
  })
})

describe('(b) finite-difference fin with the exact convective tip', () => {
  it.each(rows)('%s: FD at n = 400 matches the exact tip within 1e-6 and converges at second order', (_n, f) => {
    const a = analyzeHeatSink(f.design, ch)
    const m = a.finParameterPerM
    const H = f.design.finHeightM
    const exact = exactConvectiveTip(m, H)
    const e200 = Math.abs(fdFin(m, H, h / k, 200).heat / exact - 1)
    const e400 = Math.abs(fdFin(m, H, h / k, 400).heat / exact - 1)
    expect(e400).toBeLessThan(1e-6)
    expect(e200 / e400).toBeGreaterThan(3.9)
    expect(e200 / e400).toBeLessThan(4.1)
  })

  it.each(rows)('%s: the corrected-length model under-predicts the exact tip by less than 1e-5', (_n, f) => {
    const a = analyzeHeatSink(f.design, ch)
    const error = modelFinHeat(f, a) / exactConvectiveTip(a.finParameterPerM, f.design.finHeightM) - 1
    // Two different formulations: a stated 1e-5 bound, never 1e-9.
    expect(error).toBeLessThan(0)
    expect(Math.abs(error)).toBeLessThan(1e-5)
    // Matches the worksheet's measured value to its quoted three significant figures.
    expect(Number(error.toPrecision(3))).toBe(f.expected.correctedLengthError)
  })

  it('the corrected-length error is largest for the 5 mm thick baseline and smallest for deepChannels', () => {
    const errs = HEAT_SINK_WORKSHEET.map((f) => Math.abs(f.expected.correctedLengthError))
    expect(Math.max(...errs)).toBe(Math.abs(worksheetFixture('baseline').expected.correctedLengthError))
    expect(Math.min(...errs)).toBe(Math.abs(worksheetFixture('deepChannels').expected.correctedLengthError))
  })

  it.each(rows)('%s: FD on the model fin (adiabatic tip at L_c, n = 4000) matches tanh(m L_c) and the stored profile within 1e-6', (_n, f) => {
    const a = analyzeHeatSink(f.design, ch)
    const m = a.finParameterPerM
    const Lc = a.correctedFinLengthM
    const n = 4000
    const fd = fdFin(m, Lc, 0, n)
    expect(relClose(fd.heat, modelFinHeat(f, a), 1e-6)).toBe(true)
    expect(relClose(fd.heat, m * Math.tanh(m * Lc), 1e-6)).toBe(true)
    let worst = 0
    fd.theta.forEach((th, i) => {
      worst = Math.max(worst, Math.abs(th - Math.cosh(m * (Lc - (i * Lc) / n)) / Math.cosh(m * Lc)))
    })
    expect(worst).toBeLessThan(1e-6)
    // Stored profile samples lie on the FD solution (linear interpolation between nodes).
    for (const p of a.finProfile) {
      const x = p.xOverH * f.design.finHeightM
      const j = Math.min(n - 1, Math.floor((x / Lc) * n))
      const w = (x / Lc) * n - j
      expect(Math.abs(p.excessRatio - ((1 - w) * fd.theta[j] + w * fd.theta[j + 1]))).toBeLessThan(1e-6)
    }
  })
})

describe('(c) limits on the reference geometry', () => {
  const reference = worksheetFixture('reference').design
  const withH = (hh: number): HeatSinkChallenge => ({ ...ch, convection: { ...ch.convection, coefficientWPerM2K: hh } })
  const withK = (kk: number): HeatSinkChallenge => ({ ...ch, material: { ...ch.material, thermalConductivityWPerMK: kk } })
  const deficit = (c: HeatSinkChallenge) => {
    const a = analyzeHeatSink(reference, c)
    const mLc = a.finParameterPerM * a.correctedFinLengthM
    return { a, mLc, deficit: 1 - a.finEfficiency, asymptote: (mLc * mLc) / 3 }
  }

  it('h = 1e-2: 1 − η_f = 2.840042e-5 against the asymptote 2.840139e-5', () => {
    const r = deficit(withH(1e-2))
    expect(Number(r.deficit.toPrecision(7))).toBe(2.840042e-5)
    expect(Number(r.asymptote.toPrecision(7))).toBe(2.840139e-5)
    expect(r.deficit).toBeLessThanOrEqual(r.asymptote)
    expect(r.mLc).toBeLessThanOrEqual(0.01)
    expect(Math.abs(r.deficit / r.asymptote - 1)).toBeLessThan(1e-3)
  })

  it('h = 1e-8: 1 − η_f and the asymptote agree at 2.840139e-11', () => {
    const r = deficit(withH(1e-8))
    expect(Number(r.deficit.toPrecision(7))).toBe(2.840139e-11)
    expect(Number(r.asymptote.toPrecision(7))).toBe(2.840139e-11)
    // Here the true gap below the asymptote (2(mLc)⁴/15 ≈ 1e-21) is far below double rounding of
    // 1 − η_f (≈ 1e-16), so the bound is asserted with that rounding allowance.
    expect(r.deficit).toBeLessThanOrEqual(r.asymptote + 2 ** -52)
    expect(Math.abs(r.deficit / r.asymptote - 1)).toBeLessThan(1e-3)
  })

  it('k = 2e9 W/m·K: 1 − η_f = 7.100347e-9, equal to the asymptote', () => {
    const r = deficit(withK(2e9))
    expect(Number(r.deficit.toPrecision(7))).toBe(7.100347e-9)
    expect(Number(r.asymptote.toPrecision(7))).toBe(7.100347e-9)
    expect(r.deficit).toBeLessThanOrEqual(r.asymptote + 2 ** -52)
    expect(Math.abs(r.deficit / r.asymptote - 1)).toBeLessThan(1e-3)
  })

  it('η_f and η_o increase monotonically toward 1 as h → 0 and as k → ∞', () => {
    for (const series of [[25, 1, 1e-2, 1e-4, 1e-8].map(withH), [200, 2e3, 2e5, 2e9].map(withK)]) {
      const as = series.map((c) => analyzeHeatSink(reference, c))
      for (let i = 1; i < as.length; i++) {
        expect(as[i].finEfficiency).toBeGreaterThan(as[i - 1].finEfficiency)
        expect(as[i].overallEfficiency).toBeGreaterThan(as[i - 1].overallEfficiency)
        expect(as[i].finEfficiency).toBeLessThanOrEqual(1)
        expect(as[i].overallEfficiency).toBeLessThanOrEqual(1)
      }
      expect(1 - as[as.length - 1].overallEfficiency).toBeLessThan(1e-8)
    }
  })

  it('1 − η_f ≤ (m L_c)²/3 on every worksheet row', () => {
    for (const f of HEAT_SINK_WORKSHEET) {
      const a = analyzeHeatSink(f.design, ch)
      const mLc = a.finParameterPerM * a.correctedFinLengthM
      expect(1 - a.finEfficiency).toBeLessThanOrEqual((mLc * mLc) / 3)
    }
  })
})
