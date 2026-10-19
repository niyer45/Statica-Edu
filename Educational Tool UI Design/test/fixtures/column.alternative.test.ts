import { describe, expect, it } from 'vitest'
import type { ColumnChallenge } from '../../src/challenge/column/types'
import { evaluateColumn } from '../../src/evaluation/column/evaluate'
import { analyzeColumn } from '../../src/physics/column/analyze'
import { annulusArea, annulusSecondMoment, radiusOfGyration } from '../../src/physics/column/formulas'
import { COLUMN_WORKSHEET, column, columnChallenge, columnGrid, solid, tube } from './column'

// Column Buckling I alternative methods and limiting cases (task 68; CBK-17, design.md). Each check
// reaches the application's numbers by a different route than the closed form it implements.

const ch = columnChallenge()

/** I = ∫ π r³ dr from r_i to r_o, composite Simpson (test code only). */
function quadratureI(outerM: number, innerM: number, n = 2000): number {
  const ro = outerM / 2
  const ri = innerM / 2
  const h = (ro - ri) / n
  let sum = 0
  for (let i = 0; i <= n; i++) sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * Math.PI * (ri + i * h) ** 3
  return (sum * h) / 3
}

/**
 * Smallest eigenvalue of tridiag(−1, 2, −1) of size n by inverse iteration (Thomas solve). Times
 * EI/h² it is the finite-difference buckling load of EI w'' + P w = 0 with w(0) = w(L) = 0.
 */
function smallestTridiagonalEigenvalue(n: number, iterations = 200): number {
  let v = Array.from({ length: n }, (_, i) => Math.sin((Math.PI * (i + 1)) / (n + 1)) + 0.1 * (((i * 7919) % 13) / 13))
  let lambda = 0
  for (let it = 0; it < iterations; it++) {
    const c = new Array<number>(n)
    const d = new Array<number>(n)
    c[0] = -1 / 2
    d[0] = v[0]! / 2
    for (let i = 1; i < n; i++) {
      const m = 2 + c[i - 1]!
      c[i] = -1 / m
      d[i] = (v[i]! + d[i - 1]!) / m
    }
    const w = new Array<number>(n)
    w[n - 1] = d[n - 1]!
    for (let i = n - 2; i >= 0; i--) w[i] = d[i]! - c[i]! * w[i + 1]!
    const norm = Math.hypot(...w)
    lambda = Math.hypot(...v) / norm
    v = w.map((x) => x / norm)
  }
  return lambda
}

const inner = (d: { section: { kind: string; outerDiameterM?: number; wallThicknessM?: number } }) =>
  d.section.kind === 'solid' ? 0 : d.section.outerDiameterM! - 2 * d.section.wallThicknessM!

describe('alternative methods', () => {
  it.each(COLUMN_WORKSHEET.map((f) => [f.name, f] as const))('%s: quadrature second moment within 1e-12', (_n, f) => {
    const a = analyzeColumn(f.design, ch)
    const D = a.outerDiameterM
    expect(Math.abs(quadratureI(D, inner(f.design)) / a.secondMomentM4 - 1)).toBeLessThan(1e-12)
  })

  it('finite-difference eigenvalue converges to the Euler load at second order', () => {
    const a = analyzeColumn(column('r', tube(0.06, 0.002)), ch)
    const E = ch.material.elasticModulusPa
    const L = a.effectiveLengthM
    const fd = (n: number) => (E * a.secondMomentM4 * smallestTridiagonalEigenvalue(n)) / (L / (n + 1)) ** 2
    const e100 = Math.abs(fd(100) / a.criticalLoadN - 1)
    const e200 = Math.abs(fd(200) / a.criticalLoadN - 1)
    expect(e200).toBeLessThan(3e-5)
    // O(h²): halving h cuts the error by about four.
    expect(e100 / e200).toBeGreaterThan(3.8)
    expect(e100 / e200).toBeLessThan(4.2)
  })

  it('a Rayleigh quotient with a polynomial shape is an upper bound, 12/π² times the Euler load', () => {
    const a = analyzeColumn(column('r', tube(0.06, 0.002)), ch)
    // w = x(L − x): EI ∫w''² / ∫w'² = EI · 4L / (L³/3) = 12 EI / L².
    const rayleigh = (12 * ch.material.elasticModulusPa * a.secondMomentM4) / a.effectiveLengthM ** 2
    expect(rayleigh).toBeGreaterThan(a.criticalLoadN)
    expect(rayleigh / a.criticalLoadN).toBeCloseTo(1.2158542037080533, 12)
  })

  it('thin-wall limit: π R_m³ t underestimates I by O(t²)', () => {
    const errors = [0.004, 0.002, 0.001, 0.0005].map((t) => {
      const I = annulusSecondMoment(0.06, 0.06 - 2 * t)
      return (Math.PI * ((0.06 - t) / 2) ** 3 * t) / I - 1
    })
    for (const e of errors) expect(e).toBeLessThan(0)
    for (let i = 1; i < errors.length; i++) {
      expect(Math.abs(errors[i]!)).toBeLessThan(Math.abs(errors[i - 1]!))
      expect(Math.abs(errors[i - 1]! / errors[i]!)).toBeGreaterThan(3.9)
    }
    expect(errors[1]).toBeCloseTo(-1.188e-3, 5)
  })

  it('identities: a solid bar is a tube with wall D/2, and its radius of gyration is D/4', () => {
    for (const D of [0.01, 0.0245, 0.06]) {
      expect(annulusArea(D, 0)).toBe(annulusArea(D, D - 2 * (D / 2)))
      expect(annulusSecondMoment(D, 0)).toBe(annulusSecondMoment(D, D - 2 * (D / 2)))
      expect(radiusOfGyration(annulusSecondMoment(D, 0), annulusArea(D, 0))).toBeCloseTo(D / 4, 15)
      expect(analyzeColumn(column('s', solid(D)), ch).diameterToWall).toBe(2)
    }
  })
})

describe('scaling (the length-squared lesson)', () => {
  const at = (overrides: Partial<ColumnChallenge>) => ({ ...ch, ...overrides }) as ColumnChallenge
  const d = column('r', tube(0.06, 0.002))
  const base = analyzeColumn(d, ch)

  it('doubling the length quarters the critical load; mass doubles; stress is unchanged', () => {
    const longer = at({ lengthM: 4 })
    const a = analyzeColumn({ ...d, lengthM: 4 }, longer)
    expect(a.criticalLoadN / base.criticalLoadN).toBeCloseTo(0.25, 14)
    expect(a.massKg / base.massKg).toBeCloseTo(2, 14)
    expect(a.axialStressPa).toBe(base.axialStressPa)
  })

  it('the critical load is proportional to E and independent of the load; the stress follows the load', () => {
    const stiffer = at({ material: { ...ch.material, elasticModulusPa: 2 * ch.material.elasticModulusPa } })
    expect(analyzeColumn(d, stiffer).criticalLoadN / base.criticalLoadN).toBeCloseTo(2, 14)
    const heavier = at({ load: { ...ch.load, forceN: 3 * ch.load.forceN } })
    const h = analyzeColumn(d, heavier)
    expect(h.criticalLoadN).toBe(base.criticalLoadN)
    expect(h.axialStressPa / base.axialStressPa).toBeCloseTo(3, 14)
    expect(h.bucklingSafetyFactor / base.bucklingSafetyFactor).toBeCloseTo(1 / 3, 14)
  })
})

describe('the strength check never governs a slender column (design.md)', () => {
  it('every applicable grid design that passes buckling has P/A ≤ σ_y / (2 n_req), half the allowable', () => {
    let checked = 0
    for (const g of columnGrid(ch)) {
      const a = analyzeColumn(g, ch)
      const e = evaluateColumn(g, a, ch)
      if (!a.applicable || e.failures.includes('buckling')) continue
      checked++
      expect(a.axialStressPa).toBeLessThanOrEqual((ch.material.yieldStressPa / (2 * ch.constraints.minBucklingSafetyFactor)) * (1 + 1e-12))
      expect(e.failures).not.toContain('axialStress')
    }
    expect(checked).toBeGreaterThan(100)
  })
})
