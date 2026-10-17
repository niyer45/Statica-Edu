import { describe, expect, it } from 'vitest'
import type { VibrationChallenge } from '../../src/challenge/vibration/types'
import { analyzeIsolator } from '../../src/physics/vibration/analyze'
import { STANDARD_GRAVITY_MS2 } from '../../src/physics/vibration/constants'
import {
  naturalFrequencyHz,
  relativeDisplacementPeakRatio,
  relativeDisplacementRatio,
  staticDeflection,
  transmissibility,
  transmissibilityPeakRatio,
} from '../../src/physics/vibration/response'
import { isolator, relClose, VIBRATION_MATERIAL_TABLE, VIBRATION_WORKSHEET, vibrationChallenge, worksheetFixture, type WorksheetZeta } from './vibration'

// VIB-13 alternative-method and limiting checks (vibration-isolation-1 design.md
// "Alternative-method and limiting checks"). Every independent route below lives in test code
// only: the golden-section search, the dense frequency grid (evaluated from the complex
// receptance with k, c, m and ω rather than the r/ζ formulas), the bisection and the RK4
// integrator are never used by the app.

const ch = vibrationChallenge()
const m = ch.component.massKg
const Y = ch.excitation.amplitudeM
const { minHz, maxHz } = ch.excitation.operatingBandHz
const CONFIGURED_ZETAS: readonly WorksheetZeta[] = [0.02, 0.05, 0.1, 0.2, 0.3]
const zetaOf = (materialId: string): number => ch.materials.find((x) => x.id === materialId)!.dampingRatio

/** |a + ib|. */
const abs = (re: number, im: number): number => Math.hypot(re, im)

/** X/Y = |k + icω| / |k − mω² + icω| from physical parameters (independent of the r/ζ form). */
function receptanceTR(k: number, c: number, fHz: number): number {
  const w = 2 * Math.PI * fHz
  return abs(k, c * w) / abs(k - m * w * w, c * w)
}

/** Z/Y = mω² / |k − mω² + icω|. */
function receptanceZ(k: number, c: number, fHz: number): number {
  const w = 2 * Math.PI * fHz
  return (m * w * w) / abs(k - m * w * w, c * w)
}

const cOf = (k: number, zeta: number) => 2 * zeta * Math.sqrt(k * m)

/** Golden-section maximization of a unimodal f on [a, b]. Test code only. */
function goldenMax(f: (x: number) => number, a: number, b: number, iterations = 200): number {
  const g = (Math.sqrt(5) - 1) / 2
  let lo = a
  let hi = b
  let x1 = hi - g * (hi - lo)
  let x2 = lo + g * (hi - lo)
  let f1 = f(x1)
  let f2 = f(x2)
  for (let i = 0; i < iterations && hi - lo > 1e-15; i++) {
    if (f1 < f2) {
      lo = x1
      x1 = x2
      f1 = f2
      x2 = lo + g * (hi - lo)
      f2 = f(x2)
    } else {
      hi = x2
      x2 = x1
      f2 = f1
      x1 = hi - g * (hi - lo)
      f1 = f(x1)
    }
  }
  return (lo + hi) / 2
}

/** Maximum of f over `n` uniformly spaced points on [a, b], both ends included. */
function gridMax(f: (x: number) => number, a: number, b: number, n: number): number {
  let best = -Infinity
  for (let i = 0; i < n; i++) best = Math.max(best, f(i === n - 1 ? b : a + ((b - a) * i) / (n - 1)))
  return best
}

describe('peak formula against numerical maximization', () => {
  const zetas = [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0]

  it.each(zetas)('ζ = %s: golden-section r_p within 1e-6 and TR_peak within 1e-12', (zeta) => {
    const rNum = goldenMax((r) => transmissibility(r, zeta), 0.01, 3)
    const rp = transmissibilityPeakRatio(zeta)
    expect(relClose(rp, rNum, 1e-6), `${rp} vs ${rNum}`).toBe(true)
    expect(relClose(transmissibility(rp, zeta), transmissibility(rNum, zeta), 1e-12)).toBe(true)
  })

  it('TR is monotonic on either side of r_p over a 1e-3 scan of (0, 20) for every configured ζ', () => {
    for (const zeta of CONFIGURED_ZETAS) {
      const rp = transmissibilityPeakRatio(zeta)
      let violations = 0
      let prev = transmissibility(1e-3, zeta)
      let prevR = 1e-3
      for (let i = 2; i < 20000; i++) {
        const r = i * 1e-3
        const tr = transmissibility(r, zeta)
        if (r <= rp && tr < prev) violations++
        if (prevR >= rp && tr > prev) violations++
        prev = tr
        prevR = r
      }
      expect(violations, `ζ = ${zeta}`).toBe(0)
    }
  })

  it('matches the spec form √[(√(1 + 8ζ²) − 1)/(4ζ²)] and the derivative root 2ζ²x² + x − 1 = 0', () => {
    for (const zeta of [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0]) {
      const spec = Math.sqrt((Math.sqrt(1 + 8 * zeta * zeta) - 1) / (4 * zeta * zeta))
      const rp = transmissibilityPeakRatio(zeta)
      expect(relClose(rp, spec, 1e-12), `ζ = ${zeta}`).toBe(true)
      const x = rp * rp
      // d(TR²)/dx has the sign of 2 − 2x − 4ζ²x²: zero at x = r_p², positive below, negative above.
      expect(Math.abs(2 * zeta * zeta * x * x + x - 1)).toBeLessThan(1e-15)
      const slope = (y: number) => 2 - 2 * y - 4 * zeta * zeta * y * y
      expect(slope(x * 0.999)).toBeGreaterThan(0)
      expect(slope(x * 1.001)).toBeLessThan(0)
    }
    expect(transmissibilityPeakRatio(0)).toBe(1)
  })
})

describe('dense grid against the closed-form maxima', () => {
  /**
   * At least 20001 uniformly spaced frequencies. The grid is refined further where the
   * resonance is sharp (spacing ≤ ζ f_n / 2000), so the stated 1e-7 agreement is a property of
   * the closed form rather than of a coarse grid around a lightly damped peak.
   */
  const points = (a: number, b: number, zeta: number, fn: number) => Math.max(20001, Math.ceil((b - a) / ((zeta * fn) / 2000)) + 1)

  /** Closed form must bound the grid (≤ 1e-15 excess) and agree with it within 1e-7. */
  function expectBoundsGrid(closed: number, grid: number, what: string) {
    expect(grid <= closed * (1 + 1e-15), `${what}: grid ${grid} exceeds closed ${closed}`).toBe(true)
    expect((closed - grid) / closed, `${what}: ${closed} vs ${grid}`).toBeLessThanOrEqual(1e-7)
  }

  const inBandResonance = CONFIGURED_ZETAS.flatMap((zeta) => [1.3e6, 1.8e6, 2e6].map((k) => isolator(`res-${k}-${zeta}`, k, zeta)))
  const designs = [...VIBRATION_WORKSHEET.map((f) => f.design), ...inBandResonance]

  it.each(designs.map((d) => [d.id, d] as const))('%s: worst in-band TR, TR_peak and Z_peak bound the grid', (_id, d) => {
    const zeta = zetaOf(d.materialId)
    const k = d.stiffnessNPerM
    const c = cOf(k, zeta)
    const fn = naturalFrequencyHz(k, m)
    const a = analyzeIsolator(d, ch)
    expectBoundsGrid(a.worstInBandTransmissibility, gridMax((f) => receptanceTR(k, c, f), minHz, maxHz, points(minHz, maxHz, zeta, fn)), 'TR_worst')
    expectBoundsGrid(a.peakTransmissibility, gridMax((f) => receptanceTR(k, c, f), 0, maxHz, points(0, maxHz, zeta, fn)), 'TR_peak')
    expectBoundsGrid(a.peakRelativeDisplacementM, Y * gridMax((f) => receptanceZ(k, c, f), 0, maxHz, points(0, maxHz, zeta, fn)), 'Z_peak')
  })
})

describe('isolation threshold', () => {
  /** Larger root x of T²x² + (4ζ²T² − 4ζ² − 2T²)x + (T² − 1) = 0; r_iso = √x. Test code only. */
  function rIsoClosed(zeta: number, T: number): number {
    const a = T * T
    const b = 4 * zeta * zeta * T * T - 4 * zeta * zeta - 2 * T * T
    const c = T * T - 1
    return Math.sqrt((-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a))
  }

  /** 200-iteration bisection of TR(r, ζ) = T on r ∈ (√2, 100], where TR decreases. */
  function rIsoBisect(zeta: number, T: number): number {
    let lo = Math.SQRT2
    let hi = 100
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2
      if (transmissibility(mid, zeta) > T) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }

  it.each(VIBRATION_MATERIAL_TABLE.map((r) => [r.zeta, r] as const))('ζ = %s: closed form, bisection and worksheet agree', (_z, r) => {
    const closed = rIsoClosed(r.zeta, 0.12)
    expect(relClose(closed, rIsoBisect(r.zeta, 0.12), 1e-15)).toBe(true)
    expect(relClose(closed, r.rIso, 1e-9)).toBe(true)
  })

  it('k = m(2π·25/r_iso)² puts the worst in-band TR exactly on 0.12 (isoBoundary)', () => {
    const k = m * (2 * Math.PI * (minHz / rIsoClosed(0.2, 0.12))) ** 2
    expect(relClose(k, worksheetFixture('isoBoundary').design.stiffnessNPerM, 1e-12)).toBe(true)
    expect(relClose(analyzeIsolator(isolator('iso', k, 0.2), ch).worstInBandTransmissibility, 0.12, 1e-12)).toBe(true)
  })
})

describe('RK4 steady state (test code only)', () => {
  /**
   * Integrates m ẍ + c ẋ + k x = c ẏ + k y with y = Y sin ωt from rest using classical RK4 at
   * `stepsPerPeriod`, for 30/(ζω_n) seconds rounded up to whole periods, then projects x and
   * z = x − y onto sin ωt and cos ωt over 10 whole periods (rectangle rule).
   */
  function steadyState(k: number, zeta: number, fHz: number, stepsPerPeriod = 200): { xOverY: number; zOverY: number } {
    const c = cOf(k, zeta)
    const w = 2 * Math.PI * fHz
    const period = 1 / fHz
    const dt = period / stepsPerPeriod
    const wn = Math.sqrt(k / m)
    const settle = Math.ceil(30 / (zeta * wn) / period)
    const accel = (t: number, x: number, v: number) => (c * Y * w * Math.cos(w * t) + k * Y * Math.sin(w * t) - c * v - k * x) / m
    let x = 0
    let v = 0
    let step = 0
    const advance = () => {
      const t = step * dt
      const k1x = v
      const k1v = accel(t, x, v)
      const k2x = v + (dt / 2) * k1v
      const k2v = accel(t + dt / 2, x + (dt / 2) * k1x, v + (dt / 2) * k1v)
      const k3x = v + (dt / 2) * k2v
      const k3v = accel(t + dt / 2, x + (dt / 2) * k2x, v + (dt / 2) * k2v)
      const k4x = v + dt * k3v
      const k4v = accel(t + dt, x + dt * k3x, v + dt * k3v)
      x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x)
      v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)
      step++
    }
    for (let i = 0; i < settle * stepsPerPeriod; i++) advance()
    const n = 10 * stepsPerPeriod
    let xs = 0
    let xc = 0
    let zs = 0
    let zc = 0
    for (let i = 0; i < n; i++) {
      const t = step * dt
      const s = Math.sin(w * t)
      const co = Math.cos(w * t)
      const z = x - Y * s
      xs += x * s
      xc += x * co
      zs += z * s
      zc += z * co
      advance()
    }
    return { xOverY: (2 / n) * abs(xs, xc) / Y, zOverY: (2 / n) * abs(zs, zc) / Y }
  }

  const cases = [
    ['baseline at its worst in-band frequency', 'baseline', worksheetFixture('baseline').expected.worstInBandFrequencyHz],
    ['reference at the band minimum', 'reference', 25],
    ['reference at its TR peak', 'reference', worksheetFixture('reference').expected.secondary!.peakTransmissibilityFrequencyHz],
    ['heavyAtSag at the band minimum', 'heavyAtSag', 25],
  ] as const

  it.each(cases)('%s: X/Y matches TR and Z/Y matches the closed form within 1e-6', (_label, name, fHz) => {
    const d = worksheetFixture(name).design
    const zeta = zetaOf(d.materialId)
    const r = fHz / naturalFrequencyHz(d.stiffnessNPerM, m)
    const { xOverY, zOverY } = steadyState(d.stiffnessNPerM, zeta, fHz)
    expect(relClose(xOverY, transmissibility(r, zeta), 1e-6), `X/Y ${xOverY} vs ${transmissibility(r, zeta)}`).toBe(true)
    expect(relClose(zOverY, relativeDisplacementRatio(r, zeta), 1e-6), `Z/Y ${zOverY} vs ${relativeDisplacementRatio(r, zeta)}`).toBe(true)
  })
})

describe('identities and limits', () => {
  it('TR(√2, ζ) = 1 for ζ ∈ {0, 0.01, …, 1.0}', () => {
    for (let i = 0; i <= 100; i++) {
      const zeta = i / 100
      expect(relClose(transmissibility(Math.SQRT2, zeta), 1, 1e-15), `ζ = ${zeta}`).toBe(true)
    }
  })

  it('with ζ = 0 in the pure formula, TR = 1/|1 − r²| for r ≠ 1', () => {
    for (const r of [0.1, 0.5, 0.9, 0.999, 1.001, 1.2, Math.SQRT2, 2, 3.8, 10, 100]) {
      expect(relClose(transmissibility(r, 0), 1 / Math.abs(1 - r * r), 1e-15), `r = ${r}`).toBe(true)
    }
  })

  it('f_n = (1/2π)√(g/δ_st) for every worksheet design', () => {
    for (const f of VIBRATION_WORKSHEET) {
      const k = f.design.stiffnessNPerM
      const delta = staticDeflection(m, STANDARD_GRAVITY_MS2, k)
      expect(relClose(naturalFrequencyHz(k, m), Math.sqrt(STANDARD_GRAVITY_MS2 / delta) / (2 * Math.PI), 1e-15)).toBe(true)
    }
  })

  it('at high frequency Z/Y → 1 and TR → 2ζ/r (r = 1e4)', () => {
    // Quoted worksheet values at r = 1e4 (ζ = 0.1): 1.00000001 and 1.0000001 times the asymptote.
    expect(Math.abs(relativeDisplacementRatio(1e4, 0.1) - 1.00000001)).toBeLessThan(5e-9)
    expect(Math.abs(transmissibility(1e4, 0.1) / (0.2 / 1e4) - 1.0000001)).toBeLessThan(5e-8)
    for (const zeta of CONFIGURED_ZETAS) {
      const r = 1e4
      expect(relClose(relativeDisplacementRatio(r, zeta), 1, 1e-7)).toBe(true)
      // Leading correction: TR/(2ζ/r) − 1 ≈ 1/(8ζ²r²) + (1 − 2ζ²)/r², so the asymptote is
      // approached from above at second order and lightly damped mounts approach it more slowly.
      const err = (n: number) => transmissibility(n, zeta) / ((2 * zeta) / n) - 1
      expect(err(r)).toBeGreaterThan(0)
      expect(err(r)).toBeLessThanOrEqual((1 / (8 * zeta * zeta) + 1 - 2 * zeta * zeta) / (r * r) * (1 + 1e-3))
      expect(err(10 * r)).toBeLessThan(err(r) / 50)
    }
  })

  it('at r = 0, TR = 1 and Z = 0', () => {
    for (const zeta of CONFIGURED_ZETAS) {
      expect(transmissibility(0, zeta)).toBe(1)
      expect(relativeDisplacementRatio(0, zeta)).toBe(0)
    }
  })

  it('Z/Y at r_z equals 1/(2ζ√(1 − ζ²)) for ζ² < 1/2; for ζ² ≥ 1/2, Z_peak is taken at r_max', () => {
    for (const zeta of [0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7]) {
      expect(relClose(relativeDisplacementRatio(relativeDisplacementPeakRatio(zeta), zeta), 1 / (2 * zeta * Math.sqrt(1 - zeta * zeta)), 1e-12)).toBe(true)
    }
    expect(relativeDisplacementPeakRatio(Math.SQRT1_2)).toBe(Number.POSITIVE_INFINITY)
    const heavy: VibrationChallenge = { ...ch, materials: [...ch.materials, { id: 'veryDamped', name: 'Very damped', dampingRatio: 0.8 }] }
    const a = analyzeIsolator({ id: 'v', stiffnessNPerM: 85000, materialId: 'veryDamped' }, heavy)
    expect(a.peakRelativeDisplacementFrequencyHz).toBe(maxHz)
    expect(relClose(a.peakRelativeDisplacementM, Y * relativeDisplacementRatio(a.frequencyRatioAtBandMax, 0.8), 1e-15)).toBe(true)
    expect(a.notApplicableReasons.map((i) => i.code)).toEqual(['DAMPING_RATIO'])
  })
})
