import { describe, expect, it } from 'vitest'
import type { BracketChallenge } from '../../src/challenge/bracket/types'
import { analyzeBracket } from '../../src/physics/bracket/analyze'
import { KT_LOWER_BRANCH, KT_UPPER_BRANCH } from '../../src/physics/bracket/constants'
import { ktFitDefined, ktPolynomial, shoulderFilletKt, shoulderRatios } from '../../src/physics/bracket/kt'
import { nextUp } from '../torsionNumeric'
import {
  bracket,
  BRACKET_CHART_REL_TOL,
  BRACKET_KT_CHART,
  BRACKET_KT_EXTERNAL,
  BRACKET_WORKSHEET,
  bracketChallenge,
  gridValues,
  relClose,
  worksheetFixture,
} from './bracket'

// MBR-17 alternative-method, limiting, Kt spot and critical-section checks (mounting-bracket-1
// design.md "Alternative-method and limiting checks"). Every alternative route here is test code
// only; none of it is used by the app.

const ch = bracketChallenge()

/** The next representable double below a finite positive `x` (pairs with torsionNumeric nextUp). */
function nextDown(x: number): number {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, x)
  view.setBigUint64(0, view.getBigUint64(0) - 1n)
  return view.getFloat64(0)
}
const F = ch.load.forceN
const L = ch.lengthM
const b = ch.thicknessM
const E = ch.material.elasticModulusPa

// ---------------------------------------------------------------------------
// (a) Stepped deflection by numerical double integration of M/EI.

/**
 * Integrates the curvature κ(x) = M(x)/(E I(x)) twice from the clamp (θ(0) = v(0) = 0) by
 * cumulative trapezoid with `n` intervals per segment and a node exactly at x = a, using the
 * one-sided I on each segment. Returns the tip deflection. Test code only.
 */
function trapezoidTipDeflection(D: number, d: number, a: number, n: number): number {
  const segments: [number, number, number][] = [
    [0, a, (b * D ** 3) / 12],
    [a, L, (b * d ** 3) / 12],
  ]
  let theta = 0
  let v = 0
  for (const [x0, x1, I] of segments) {
    const h = (x1 - x0) / n
    const kappa = (x: number) => (F * (L - x)) / (E * I)
    for (let i = 0; i < n; i++) {
      const xa = x0 + i * h
      const thetaNext = theta + ((kappa(xa) + kappa(xa + h)) / 2) * h
      v += ((theta + thetaNext) / 2) * h
      theta = thetaNext
    }
  }
  return v
}

/** Unit-load integral δ = ∫ F (L − x)² / (E I(x)) dx by 5-point Gauss–Legendre per segment. Test code only. */
function gaussTipDeflection(D: number, d: number, a: number): number {
  const nodes = [0, -0.5384693101056831, 0.5384693101056831, -0.906179845938664, 0.906179845938664]
  const weights = [0.5688888888888889, 0.47862867049936647, 0.47862867049936647, 0.23692688505618908, 0.23692688505618908]
  const segment = (x0: number, x1: number, I: number) => {
    const half = (x1 - x0) / 2
    const mid = (x0 + x1) / 2
    return nodes.reduce((sum, t, i) => sum + weights[i] * ((F * (L - (mid + half * t)) ** 2) / (E * I)), 0) * half
  }
  return a > 0 ? segment(0, a, (b * D ** 3) / 12) + segment(a, L, (b * d ** 3) / 12) : segment(0, L, (b * d ** 3) / 12)
}

describe('(a) stepped deflection: numerical double integration of M/EI', () => {
  const rows = BRACKET_WORKSHEET.map((f) => [f.name, f] as const)

  it.each(rows)('%s: cumulative trapezoid (n = 1000 per segment) agrees with the closed form within 1e-6', (_n, f) => {
    const { rootDepthM: D, armDepthM: d, stepLocationM: a } = f.design
    const closed = analyzeBracket(f.design, ch).tipDeflectionM
    expect(relClose(trapezoidTipDeflection(D, d, a, 1000), closed, 1e-6)).toBe(true)
  })

  it.each(rows)('%s: unit-load integral by 5-point Gauss–Legendre agrees within 1e-12', (_n, f) => {
    const { rootDepthM: D, armDepthM: d, stepLocationM: a } = f.design
    const closed = analyzeBracket(f.design, ch).tipDeflectionM
    expect(relClose(gaussTipDeflection(D, d, a), closed, 1e-12)).toBe(true)
  })

  it('converges at O(n⁻²) on the baseline, matching the worksheet errors to about 1%', () => {
    const { rootDepthM: D, armDepthM: d, stepLocationM: a } = worksheetFixture('baseline').design
    const closed = analyzeBracket(worksheetFixture('baseline').design, ch).tipDeflectionM
    const quoted = [-4.217e-7, -1.054e-7, -2.636e-8, -6.589e-9]
    const errors = [500, 1000, 2000, 4000].map((n) => trapezoidTipDeflection(D, d, a, n) / closed - 1)
    errors.forEach((e, i) => expect(Math.abs(e / quoted[i] - 1), `n index ${i}: ${e}`).toBeLessThan(0.01))
    for (let i = 1; i < errors.length; i++) {
      const ratio = errors[i - 1] / errors[i]
      expect(ratio).toBeGreaterThan(3.9)
      expect(ratio).toBeLessThan(4.1)
    }
  })
})

// ---------------------------------------------------------------------------
// (b) Uniform-depth limit equals the cantilever rectangle formulas.

describe('(b) uniform limit: d = D equals FL³/(3EI) and 6FL/(bh²)', () => {
  const depths = [0.015, 0.027, 0.03, 0.05]
  const steps = [0.06, 0.15, 0.24]

  it.each(depths)('D = d = %s m for every step location and fillet radius', (h) => {
    const I = (b * h ** 3) / 12
    const delta = (F * L ** 3) / (3 * E * I)
    const sigma = (6 * F * L) / (b * h ** 2)
    const first = analyzeBracket(bracket('u', h, h, steps[0], 0.001), ch)
    for (const a of steps) {
      for (const r of [0.0005, 0.001, 0.01]) {
        const an = analyzeBracket(bracket('u', h, h, a, r), ch)
        expect(relClose(an.tipDeflectionM, delta, 1e-12)).toBe(true)
        expect(relClose(an.peakStressPa as number, sigma, 1e-12)).toBe(true)
        expect(an.peakLocation).toBe('root')
        expect(an.ktStep).toBeUndefined()
        expect('ktStep' in an).toBe(false)
        // a and r have no effect on any output.
        expect(an).toEqual(first)
      }
    }
  })

  it('the stepped closed form tends to the uniform one as d → D (Gauss route agrees)', () => {
    for (const h of depths) {
      const I = (b * h ** 3) / 12
      expect(relClose(gaussTipDeflection(h, h, 0.15), (F * L ** 3) / (3 * E * I), 1e-12)).toBe(true)
      expect(relClose(gaussTipDeflection(h, h, 0), (F * L ** 3) / (3 * E * I), 1e-12)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// (c) Kt fit: independent transcription, spot values, external values and chart readings.

/** design.md coefficient table, transcribed again in test code: [α, β, γ] for C1–C4. */
const TABLE = {
  lower: [[1.006, 0.967, 0.013], [-0.27, -2.372, 0.708], [0.662, 1.157, -0.908], [-0.405, 0.249, -0.2]],
  upper: [[1.058, 1.002, -0.038], [-3.652, 1.639, -0.436], [6.17, -5.687, 1.175], [-2.558, 3.046, -0.701]],
} as const

/** MechaniCalc set (source 5, disagrees; documentation of transcription spread only). */
const MECHANICALC = {
  lower: [[1.007, 1.0, -0.031], [-0.27, -2.404, 0.749], [0.677, 1.133, -0.904], [-0.414, 0.271, 0.186]],
  upper: [[1.042, 0.982, -0.036], [-3.599, 1.619, -0.431], [6.084, -5.607, 1.158], [-2.527, 3.006, -0.691]],
} as const

type Table = { lower: readonly (readonly number[])[]; upper: readonly (readonly number[])[] }

/** Test-side Kt from a coefficient table, lower branch for h/r ≤ 2. */
function ktFrom(table: Table, D: number, d: number, r: number): number {
  const h = (D - d) / 2
  const q = h / r
  const rows = q <= 2 * (1 + 1e-9) ? table.lower : table.upper
  const C = rows.map(([al, be, ga]) => al + be * Math.sqrt(q) + ga * q)
  const x = (2 * h) / D
  return C[0] + C[1] * x + C[2] * x ** 2 + C[3] * x ** 3
}

/** Every configured (D, d) pair with a step and D/d ≤ 1.6, with every configured r inside the fit range. */
function configuredFitSpace(): { D: number; d: number; radii: number[] }[] {
  const out: { D: number; d: number; radii: number[] }[] = []
  for (const D of gridValues(ch.designLimits.rootDepthM)) {
    for (const d of gridValues(ch.designLimits.armDepthM)) {
      if (!(d < D) || D / d > 1.6 * (1 + 1e-9)) continue
      const radii = gridValues(ch.designLimits.filletRadiusM).filter((r) => ktFitDefined(shoulderRatios(D, d, r)))
      if (radii.length > 0) out.push({ D, d, radii })
    }
  }
  return out
}
const SPACE = configuredFitSpace()

describe('(c) Kt fit', () => {
  it('the constants table equals the design.md table digit for digit and sign for sign', () => {
    const asRows = (t: typeof KT_LOWER_BRANCH) => t.map((k) => [k.alpha, k.beta, k.gamma])
    expect(asRows(KT_LOWER_BRANCH)).toEqual(TABLE.lower)
    expect(asRows(KT_UPPER_BRANCH)).toEqual(TABLE.upper)
  })

  it.each(['baseline', 'reference', 'filletOnly', 'rootGoverned', 'plasticWarning'])('%s: spot value equals the transcribed polynomial within 1e-9', (name) => {
    const f = worksheetFixture(name)
    const { rootDepthM: D, armDepthM: d, filletRadiusM: r } = f.design
    const kt = analyzeBracket(f.design, ch).ktStep as number
    expect(relClose(kt, f.expected.kt as number)).toBe(true)
    expect(relClose(ktFrom(TABLE, D, d, r), kt)).toBe(true)
  })

  it.each(BRACKET_KT_EXTERNAL.map((x) => [x.name, x] as const))('%s worked value agrees within 1e-3 (fit value within 1e-9)', (_n, x) => {
    const kt = shoulderFilletKt(shoulderRatios(x.D, x.d, x.r))?.kt as number
    expect(relClose(kt, x.fit)).toBe(true)
    expect(relClose(kt, x.published, 1e-3)).toBe(true)
  })

  it('digitized 1951 chart: D/d = 1.1 and 1.3 rows within ±5%; quoted fit values to four decimals', () => {
    for (const row of BRACKET_KT_CHART) {
      const d = 1
      const D = row.stepRatio * d
      const r = row.rOverD * d
      const ratios = shoulderRatios(D, d, r)
      expect(ratios.heightToRadiusRatio).toBeCloseTo(row.hOverR, 9)
      const kt = ktPolynomial(ratios.heightToRadiusRatio, ratios.depthFraction, ratios.heightToRadiusRatio <= 2 * (1 + 1e-9) ? 'lower' : 'upper')
      expect(Math.abs(kt - row.fit), `${row.stepRatio}/${row.rOverD}`).toBeLessThanOrEqual(5e-5 + 1e-12)
      if (row.stepRatio === 1.1 || row.stepRatio === 1.3) {
        expect(relClose(kt, row.chart, BRACKET_CHART_REL_TOL), `${row.stepRatio}/${row.rOverD}`).toBe(true)
      }
    }
  })

  it('the adopted set is within 2% of the MechaniCalc set over the configured space (transcription spread only)', () => {
    let worst = 0
    for (const { D, d, radii } of SPACE) {
      for (const r of radii) worst = Math.max(worst, Math.abs(ktFrom(TABLE, D, d, r) / ktFrom(MECHANICALC, D, d, r) - 1))
    }
    expect(worst).toBeGreaterThan(0.015)
    expect(worst).toBeLessThanOrEqual(0.02)
  })
})

describe('Kt fit properties on the configured grid', () => {
  it('covers a non-trivial space', () => {
    expect(SPACE.length).toBeGreaterThan(500)
  })

  it('Kt never increases as r increases, for every configured (D, d) with D/d ≤ 1.6', () => {
    for (const { D, d, radii } of SPACE) {
      const kts = radii.map((r) => shoulderFilletKt(shoulderRatios(D, d, r))?.kt as number)
      for (let i = 1; i < kts.length; i++) expect(kts[i], `D ${D}, d ${d}, r ${radii[i]}`).toBeLessThanOrEqual(kts[i - 1])
    }
  })

  it('Kt spans 1.1573–3.3443', () => {
    const all = SPACE.flatMap(({ D, d, radii }) => radii.map((r) => shoulderFilletKt(shoulderRatios(D, d, r))?.kt as number))
    expect(Math.min(...all)).toBeCloseTo(1.1573, 4)
    expect(Math.max(...all)).toBeCloseTo(3.3443, 4)
  })

  it('the branch gap at h/r = 2 is at most 2.6%, in the direction that keeps Kt non-increasing in r', () => {
    let worst = 0
    let reversed = 0
    for (const { D, d } of SPACE) {
      const x = (D - d) / D
      const lower = ktPolynomial(2, x, 'lower')
      const upper = ktPolynomial(2, x, 'upper')
      worst = Math.max(worst, Math.abs(upper / lower - 1))
      // Moving from h/r just above 2 (upper) to 2 (lower) as r grows must not raise Kt. This holds
      // wherever a step is applicable (D/d ≥ 1.1, K-4). Below that the branches cross: the lower
      // one exceeds the upper one by about 0.02% at most, inside the not-applicable small-step band.
      if (D / d >= 1.1 * (1 - 1e-9)) {
        expect(lower, `D ${D}, d ${d}`).toBeLessThanOrEqual(upper)
      } else if (lower > upper) {
        reversed++
        expect(lower / upper - 1).toBeLessThan(3e-4)
      }
    }
    expect(reversed).toBeGreaterThan(0)
    expect(worst).toBeLessThanOrEqual(0.026)
    expect(worst).toBeGreaterThan(0.02)
  })

  it('Kt does not depend on a or F', () => {
    const base = analyzeBracket(worksheetFixture('baseline').design, ch).ktStep
    expect(analyzeBracket(bracket('a', 0.03, 0.02, 0.21, 0.001), ch).ktStep).toBe(base)
    expect(analyzeBracket(worksheetFixture('baseline').design, { ...ch, load: { ...ch.load, forceN: 999 } }).ktStep).toBe(base)
  })
})

// ---------------------------------------------------------------------------
// Critical-section switching root ↔ step.

describe('critical-section switching', () => {
  it('rootGoverned → rootToStep: only r changes and the location flips from root to step', () => {
    const g = worksheetFixture('rootGoverned').design
    const s = worksheetFixture('rootToStep').design
    expect({ ...g, id: '', filletRadiusM: 0 }).toEqual({ ...s, id: '', filletRadiusM: 0 })
    const ag = analyzeBracket(g, ch)
    const as = analyzeBracket(s, ch)
    expect(ag.peakLocation).toBe('root')
    expect(as.peakLocation).toBe('step')
    expect(as.rootStressPa).toBe(ag.rootStressPa)
    expect(as.tipDeflectionM).toBe(ag.tipDeflectionM)
    expect(as.massKg).toBe(ag.massKg)
  })

  it('moving the step outboard lowers σ_step linearly in (L − a) while σ_root is unchanged', () => {
    const base = analyzeBracket(bracket('a', 0.03, 0.02, 0.06, 0.001), ch)
    for (const a of gridValues(ch.designLimits.stepLocationM)) {
      const an = analyzeBracket(bracket('a', 0.03, 0.02, a, 0.001), ch)
      expect(an.rootStressPa).toBe(base.rootStressPa)
      expect(relClose(an.stepNominalStressPa as number, (base.stepNominalStressPa as number) * ((L - a) / (L - 0.06)), 1e-12)).toBe(true)
      expect(relClose(an.stepPeakStressPa as number, (base.stepPeakStressPa as number) * ((L - a) / (L - 0.06)), 1e-12)).toBe(true)
    }
  })

  it('a tie (σ_step = σ_root exactly, constructed through the configured length) goes to the root', () => {
    // σ_root ∝ L/D², σ_step ∝ Kt (L − a)/d²: solve for the tie length, then walk the doubles
    // around it until the two computed stresses are bitwise equal.
    const design = bracket('tie', 0.028, 0.024, 0.17, 0.004)
    const kt = analyzeBracket(design, ch).ktStep as number
    const { rootDepthM: D, armDepthM: d, stepLocationM: a } = design
    const tieL = (kt * a / d ** 2) / (kt / d ** 2 - 1 / D ** 2)
    const withLength = (len: number): BracketChallenge => ({ ...ch, lengthM: len })
    let tie: ReturnType<typeof analyzeBracket> | undefined
    let lo = tieL
    let hi = tieL
    for (let i = 0; i < 4000 && tie === undefined; i++) {
      for (const len of [lo, hi]) {
        const an = analyzeBracket(design, withLength(len))
        if (an.stepPeakStressPa === an.rootStressPa) tie = an
      }
      lo = nextDown(lo)
      hi = nextUp(hi)
    }
    expect(tie, 'no exact tie found near the tie length').toBeDefined()
    expect(tie?.peakLocation).toBe('root')
    expect(tie?.peakStressPa).toBe(tie?.rootStressPa)
  })
})
