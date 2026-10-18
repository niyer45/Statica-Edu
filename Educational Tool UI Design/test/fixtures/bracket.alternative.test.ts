import { describe, expect, it } from 'vitest'
import { bracketArmLengthM, bracketOutline } from '../../src/geometry/bracket/outline'
import { analyzeBracket } from '../../src/physics/bracket/analyze'
import { bendRadiusRatio, curvedBeamInnerStress, nominalBendingStress } from '../../src/physics/bracket/formulas'
import { BRACKET_WORKSHEET, bracketChallenge, relClose, ROARK_RECTANGLE_KI } from './bracket'

// Task 55 alternative-method checks for the bolted L-bracket. Every alternative route here is test
// code only, built from first principles rather than the closed forms in physics/bracket; none of
// it is used by the app.

const ch = bracketChallenge()
const P = ch.load.forceN
const a = ch.loadOffsetM
const E = ch.material.elasticModulusPa
const rows = BRACKET_WORKSHEET.map((f) => [f.name, f] as const)

/** Composite Simpson rule with n (even) intervals. */
function simpson(f: (x: number) => number, x0: number, x1: number, n = 2000): number {
  const h = (x1 - x0) / n
  let s = f(x0) + f(x1)
  for (let i = 1; i < n; i++) s += f(x0 + i * h) * (i % 2 === 1 ? 4 : 2)
  return (s * h) / 3
}

// ---------------------------------------------------------------------------
// (a) Curved-beam stress from Winkler's hypothesis solved numerically.

/**
 * Plane sections rotate about the neutral radius r_n, so the fibre strain and stress vary as
 * σ(r) = k (r − r_n) / r. r_n is found by bisection so the axial force ∫σ w dr vanishes (no
 * logarithm), k so the moment ∫σ (r − r_n) w dr equals M. Returns σ at the inner and outer fibres.
 */
function winklerByQuadrature(M: number, w: number, t: number, ri: number): { inner: number; outer: number } {
  const ro = ri + t
  const force = (rn: number) => simpson((r) => (r - rn) / r, ri, ro)
  let lo = ri
  let hi = ro
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (force(mid) > 0) lo = mid
    else hi = mid
  }
  const rn = (lo + hi) / 2
  const k = M / (w * simpson((r) => (r - rn) ** 2 / r, ri, ro))
  return { inner: Math.abs((k * (ri - rn)) / ri), outer: Math.abs((k * (ro - rn)) / ro) }
}

describe('(a) curved-beam bend stress: Winkler hypothesis by numerical integration', () => {
  it.each(rows)('%s: quadrature agrees with the closed form within 1e-7', (_n, f) => {
    const { thicknessM: t, widthM: w, innerRadiusM: ri } = f.design
    const M = P * a
    const q = winklerByQuadrature(M, w, t, ri)
    const closed = analyzeBracket(f.design, ch).bendStressPa
    expect(relClose(q.inner, closed, 1e-7), `${q.inner} vs ${closed}`).toBe(true)
    // The inner fibre always carries more than the outer fibre and the straight-beam value.
    expect(q.inner).toBeGreaterThan(q.outer)
    expect(q.inner).toBeGreaterThan(nominalBendingStress(M, w, t))
  })
})

describe('(b) curved-beam factor against the tabulated rectangle values (Roark Table 9.1)', () => {
  it.each(ROARK_RECTANGLE_KI.map((r) => [r.rOverC, r.ki] as const))('R/c = %s gives k_i = %s to three decimals', (rOverC, ki) => {
    const t = 0.01
    const ri = ((rOverC - 1) * t) / 2
    expect(bendRadiusRatio(ri, t)).toBeCloseTo(rOverC, 12)
    const k = curvedBeamInnerStress(1, 1, t, ri) / nominalBendingStress(1, 1, t)
    expect(Math.abs(k - ki)).toBeLessThanOrEqual(0.0005 + 1e-9)
  })

  it('tends to the straight-beam value for a gentle bend', () => {
    const t = 0.005
    const k = curvedBeamInnerStress(1, 1, t, 1000 * t) / nominalBendingStress(1, 1, t)
    expect(k).toBeGreaterThan(1)
    expect(k - 1).toBeLessThan(1e-3)
  })
})

// ---------------------------------------------------------------------------
// (c) Deflection at the load by double integration of the curvature along the load path.

/**
 * Flange span between the heel (s = 0) and the bolt row (s = h): M(s) = P a (1 − s/h), simply
 * supported. The end rotation is found by shooting: integrate v'' = κ twice by cumulative
 * trapezoid from v(0) = 0 with v'(0) = θ, and choose θ so v(h) = 0 (v(h) is linear in θ). The arm
 * is then a cantilever from the wall face turned through θ: δ = θ a + ∬ κ_arm. Test code only.
 */
function deflectionByIntegration(I: number, h: number, n = 4000): number {
  const endDisplacement = (theta: number, length: number, kappa: (s: number) => number): number => {
    const ds = length / n
    let slope = theta
    let v = 0
    for (let i = 0; i < n; i++) {
      const s = i * ds
      const next = slope + ((kappa(s) + kappa(s + ds)) / 2) * ds
      v += ((slope + next) / 2) * ds
      slope = next
    }
    return v
  }
  const flangeKappa = (s: number) => (P * a * (1 - s / h)) / (E * I)
  const v0 = endDisplacement(0, h, flangeKappa)
  const v1 = endDisplacement(1, h, flangeKappa)
  const theta = -v0 / (v1 - v0)
  // Arm from the wall face (x = 0) to the load (x = a): M(x) = P (a − x), clamped direction θ.
  const armKappa = (x: number) => (P * (a - x)) / (E * I)
  return Math.abs(theta) * a + endDisplacement(0, a, armKappa)
}

/** Unit-load (virtual work) integral δ = ∫ M m / (E I) ds over the arm and the flange span, by Simpson. */
function deflectionByVirtualWork(I: number, h: number): number {
  const arm = simpson((x) => (P * x) * x, 0, a)
  const flange = simpson((s) => P * a * (1 - s / h) * (a * (1 - s / h)), 0, h)
  return (arm + flange) / (E * I)
}

describe('(c) deflection at the load', () => {
  it.each(rows)('%s: curvature integration and virtual work agree with the closed form', (_n, f) => {
    const an = analyzeBracket(f.design, ch)
    const I = (f.design.widthM * f.design.thicknessM ** 3) / 12
    const h = an.boltLeverArmM
    expect(relClose(deflectionByVirtualWork(I, h), an.deflectionM, 1e-9)).toBe(true)
    expect(relClose(deflectionByIntegration(I, h), an.deflectionM, 1e-6)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// (d) Bolt tension from full rigid-body equilibrium.

/** Solves a 3 × 3 linear system by Cramer's rule. */
function solve3(A: number[][], b: number[]): number[] {
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const d = det(A)
  return [0, 1, 2].map((j) => det(A.map((row, i) => row.map((v, k) => (k === j ? b[i] : v)))) / d)
}

describe('(d) bolt tension: equilibrium of the whole bracket', () => {
  it.each(rows)('%s: ΣFx = ΣFy = 0 and moments about the load point give the same tension', (_n, f) => {
    const an = analyzeBracket(f.design, ch)
    // Unknowns [C, T, V]: heel push C (+x, from the wall, at (0, y_heel)), total bolt pull T (−x, at
    // (0, y_bolt)), vertical bolt shear V (+y, at (0, y_bolt)). Load P (−y) at (a, 0).
    const yHeel = f.design.innerRadiusM + f.design.thicknessM
    const yBolt = f.design.flangeHeightM - ch.bolts.edgeDistanceM
    // Moments about the load point (a, 0), counter-clockwise positive: r × F = rx Fy − ry Fx.
    const A = [
      [1, -1, 0],
      [0, 0, 1],
      [-(yHeel - 0) * 1, (yBolt - 0) * 1, (0 - a) * 1],
    ]
    const [C, T, V] = solve3(A, [0, P, 0])
    expect(relClose(V, P, 1e-12)).toBe(true)
    expect(relClose(C, T, 1e-12)).toBe(true)
    expect(relClose(T / ch.bolts.count, an.boltTensionN, 1e-12)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// (e) Mass from the display outline.

/** Shoelace area of a closed polygon. */
function polygonArea(pts: { x: number; y: number }[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    s += p.x * q.y - q.x * p.y
  }
  return Math.abs(s) / 2
}

describe('(e) mass: polygon area of the side-view outline', () => {
  it.each(rows)('%s: ρ w × shoelace area (finely sampled arcs) agrees with the closed form within 1e-6', (_n, f) => {
    const area = polygonArea(bracketOutline(f.design, bracketArmLengthM(ch), 4000))
    const mass = ch.material.densityKgM3 * f.design.widthM * area
    expect(relClose(mass, analyzeBracket(f.design, ch).massKg, 1e-6)).toBe(true)
  })
})
