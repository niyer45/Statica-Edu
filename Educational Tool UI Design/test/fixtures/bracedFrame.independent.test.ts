import { describe, expect, it } from 'vitest'
import type { BracedFrameChallenge } from '../../src/challenge/bracedFrame/types'
import type { BracedFrameDesign } from '../../src/geometry/bracedFrame/design'
import { DIAGONAL_IDS, FRAME_MEMBER_IDS, type FrameMemberId } from '../../src/geometry/bracedFrame/template'
import { analyzeBracedFrame, assembleBracedFrame, solveBracedFrame } from '../../src/physics/bracedFrame/analyze'
import type { BracedFrameSolvedAnalysis } from '../../src/physics/bracedFrame/types'
import {
  C,
  determinateTopology,
  forceMethod,
  methodOfJoints,
  S,
  UNIT_FLOOR,
  UNIT_J6_DOWN,
  UNIT_ROOF,
  virtualWork,
  WORKSHEET_LOADS,
  type FreeLoads,
} from '../bracedFrameStatics'
import {
  bracedFrameChallenge,
  DESIGN_SPACE,
  FORCE_METHOD_FIXTURES,
  frameDesign,
  GRAVITY_ONLY_X_DIAGONAL_N,
  hasUnbracedStorey,
  relClose,
  worksheetFixture,
} from './bracedFrame'

// BFR-15 independent checks (design.md "Independent checks" and "Limiting, scaling and invalid
// cases"). The hand methods live in test/bracedFrameStatics.ts; the stiffness solution must agree
// with them. Forces compare within 1e-9 × max|N|, displacements at 1e-9 relative.

const ch = bracedFrameChallenge()

function solved(d: BracedFrameDesign, c: BracedFrameChallenge = ch): BracedFrameSolvedAnalysis {
  const a = analyzeBracedFrame(d, c)
  if (a.status !== 'solved') throw new Error(`${d.id} did not solve`)
  return a
}

function expectForces(a: BracedFrameSolvedAnalysis, expected: Partial<Record<FrameMemberId, number>>, what: string, rel = 1e-9) {
  expect(Object.keys(a.members).sort(), what).toEqual(Object.keys(expected).sort())
  const scale = Math.max(...Object.values(a.members).map((m) => Math.abs(m!.forceN)))
  for (const [id, N] of Object.entries(expected) as [FrameMemberId, number][]) {
    expect(Math.abs(a.members[id]!.forceN - N), `${what} ${id}: ${a.members[id]!.forceN} vs ${N}`).toBeLessThanOrEqual(rel * scale)
  }
}

const expectRel = (actual: number, expected: number, what: string, rel = 1e-9) =>
  expect(relClose(actual, expected, rel), `${what}: ${actual} vs ${expected}`).toBe(true)

const DETERMINATE = ['baseline', 'uniform60', 'reference', 'bucklingBeam', 'lightLowerDiagonal', 'uniformS3Tension', 'mixedLight'] as const

/** Challenge with the given free-joint loads (test-only config). */
function withLoads(loads: FreeLoads): BracedFrameChallenge {
  const list = (Object.entries(loads) as ['j3' | 'j4' | 'j5' | 'j6', readonly [number, number]][]).map(([jointId, [fxN, fyN]]) => ({ jointId, fxN, fyN }))
  return { ...ch, loads: list }
}

describe('(a) method of joints for determinate topologies', () => {
  it.each(DETERMINATE.map((n) => [n] as const))('%s: stiffness forces and reactions equal the statics values', (name) => {
    const f = worksheetFixture(name)
    const topology = determinateTopology(f.design)!
    const statics = methodOfJoints(topology, WORKSHEET_LOADS)
    const a = solved(f.design)
    expectForces(a, statics.forces, name)
    const scale = Math.max(...Object.values(statics.forces).map((v) => Math.abs(v!)))
    const r = a.reactionsN
    ;[r.j1.x, r.j1.y, r.j2.x, r.j2.y].forEach((v, i) => expect(Math.abs(v - statics.reactions[i])).toBeLessThanOrEqual(1e-9 * scale))
  })

  it('the configured loads give diag1a = 1.25(H1 + H2), diag2a = 1.25 H2, beam1 = −(H1 + H2), beam2 = −H2, col1R = −G − 0.75 H1 − 1.5 H2', () => {
    const H1 = 20000
    const H2 = 40000
    const G = 40000
    const t = methodOfJoints('tension', WORKSHEET_LOADS).forces
    expectRel(t.diag1a!, 1.25 * (H1 + H2), 'diag1a')
    expectRel(t.diag2a!, 1.25 * H2, 'diag2a')
    expectRel(t.beam1!, -(H1 + H2), 'beam1')
    expectRel(t.beam2!, -H2, 'beam2')
    expectRel(t.col1R!, -G - 0.75 * H1 - 1.5 * H2, 'col1R')
    expect(C * C + S * S).toBeCloseTo(1, 15)
  })

  it('all four single-diagonal topologies match statics under general loads, independently of sections', () => {
    const loads: FreeLoads = { j3: [13000, -7000], j4: [-5000, -21000], j5: [27000, 9000], j6: [-11000, -33000] }
    const c = withLoads(loads)
    const sizesA = [48, 60, 76, 89, 60, 48] as const
    const sizesB = [89, 76, 48, 60, 89, 76] as const
    for (const [lower, upper] of [['diag1a', 'diag2a'], ['diag1b', 'diag2b'], ['diag1a', 'diag2b'], ['diag1b', 'diag2a']] as const) {
      for (const sizes of [sizesA, sizesB]) {
        const d = frameDesign('g', sizes, { [lower]: 60, [upper]: 89 })
        expectForces(solved(d, c), methodOfJoints(determinateTopology(d)!, loads).forces, `${lower}+${upper}`)
      }
    }
  })
})

describe('(b) unit-load (virtual work) displacements', () => {
  it.each(DETERMINATE.map((n) => [n] as const))('%s: roof drift, floor drift and j6 vertical agree at 1e-9', (name) => {
    const f = worksheetFixture(name)
    const topology = determinateTopology(f.design)!
    const N = methodOfJoints(topology, WORKSHEET_LOADS).forces
    const a = solved(f.design)
    expectRel(virtualWork(f.design, N, methodOfJoints(topology, UNIT_ROOF).forces), a.roofDriftM, 'roof')
    expectRel(virtualWork(f.design, N, methodOfJoints(topology, UNIT_FLOOR).forces), a.floorDriftM, 'floor')
    // A unit load downward at j6 measures the downward displacement −u_j6y.
    expectRel(virtualWork(f.design, N, methodOfJoints(topology, UNIT_J6_DOWN).forces), -a.displacementsM.j6.y, 'j6 vertical')
  })

  it('reproduces the worksheet reference roof drift 0.0103833770829032 m by virtual work', () => {
    const d = worksheetFixture('reference').design
    const N = methodOfJoints('tension', WORKSHEET_LOADS).forces
    expectRel(virtualWork(d, N, methodOfJoints('tension', UNIT_ROOF).forces), 0.0103833770829032, 'reference roof')
  })
})

describe('(c) force method for X-braced (redundant) storeys', () => {
  it.each(['xBracedLight', 'bruteForce'] as const)('%s: flexibility, δ₀, redundants and forces agree', (name) => {
    const d = worksheetFixture(name).design
    const fm = forceMethod(d, WORKSHEET_LOADS)
    const fx = FORCE_METHOD_FIXTURES[name]
    fm.f.forEach((row, i) => row.forEach((v, j) => expectRel(v, fx.f[i][j], `f${i}${j}`)))
    fm.delta0.forEach((v, i) => expectRel(v, fx.delta0[i], `δ${i}0`))
    fm.X.forEach((v, i) => expectRel(v, fx.X[i], `X${i}`))
    // The storeys couple only through beam1, which carries −c in both unit systems.
    expectRel(fm.f[0][1], C * C * (4 / (200e9 * (name === 'bruteForce' ? 1.31789811818092e-3 : 4.53394651766079e-4))), 'f12')
    const a = solved(d)
    expectForces(a, fm.forces, name)
    // Roof drift by virtual work with the primary structure's unit-load system (reduction theorem).
    expectRel(virtualWork(d, fm.forces, methodOfJoints('tension', UNIT_ROOF).forces), a.roofDriftM, 'roof drift', 1e-9)
  })

  it('lowerXUpperSingle: one redundant (f₁₁, δ₁₀, X₁) and forces agree', () => {
    const d = worksheetFixture('lowerXUpperSingle').design
    const fm = forceMethod(d, WORKSHEET_LOADS)
    const fx = FORCE_METHOD_FIXTURES.lowerXUpperSingle
    expectRel(fm.f[0][0], fx.f11, 'f11')
    expectRel(fm.delta0[0], fx.delta10, 'δ10')
    expectRel(fm.X[0], fx.X1, 'X1')
    const a = solved(d)
    expectForces(a, fm.forces, 'lowerXUpperSingle')
    expectRel(virtualWork(d, fm.forces, methodOfJoints('tension', UNIT_ROOF).forces), a.roofDriftM, 'roof drift')
  })
})

describe('(d) equilibrium', () => {
  const solvedNames = ['baseline', 'uniform60', 'reference', 'uniformS3Tension', 'bucklingBeam', 'lightLowerDiagonal', 'xBracedLight', 'lowerXUpperSingle', 'mixedLight', 'bruteForce']

  it.each(solvedNames.map((n) => [n] as const))('%s: global force and moment equilibrium within 1e-9 of the load scale', (name) => {
    const a = solved(worksheetFixture(name).design)
    const r = a.reactionsN
    const fx = r.j1.x + r.j2.x + 20000 + 40000
    const fy = r.j1.y + r.j2.y - 40000 - 40000
    // Moments about j1 (counterclockwise positive): M = x Fy − y Fx.
    const m = 4 * r.j2.y - (3 * 20000 + 6 * 40000) + 0 * -40000 + 4 * -40000
    expect(Math.abs(fx)).toBeLessThanOrEqual(1e-9 * 140000)
    expect(Math.abs(fy)).toBeLessThanOrEqual(1e-9 * 140000)
    expect(Math.abs(m)).toBeLessThanOrEqual(1e-9 * 140000 * 6)
  })

  it.each(solvedNames.map((n) => [n] as const))('%s: the stiffness solve leaves a residual ≤ 1e-9', (name) => {
    const s = solveBracedFrame(assembleBracedFrame(worksheetFixture(name).design, ch))
    if (s.status !== 'solved') throw new Error('expected solved')
    expect(s.relativeResidual).toBeLessThanOrEqual(1e-9)
  })
})

describe('scaling, superposition and symmetry', () => {
  const reference = worksheetFixture('reference').design
  const xBraced = worksheetFixture('xBracedLight').design

  it('doubling every load doubles u and N', () => {
    for (const d of [reference, xBraced]) {
      const a = solved(d)
      const b = solved(d, { ...ch, loads: ch.loads.map((l) => ({ ...l, fxN: 2 * l.fxN, fyN: 2 * l.fyN })) })
      expectRel(b.roofDriftM, 2 * a.roofDriftM, 'roof drift', 1e-12)
      for (const id of Object.keys(a.members) as FrameMemberId[]) {
        expect(Math.abs(b.members[id]!.forceN - 2 * a.members[id]!.forceN)).toBeLessThanOrEqual(1e-9 * 2 * 115000)
      }
    }
  })

  it('doubling E halves u and leaves N unchanged', () => {
    for (const d of [reference, xBraced]) {
      const a = solved(d)
      const b = solved(d, { ...ch, material: { ...ch.material, elasticModulusPa: 2 * ch.material.elasticModulusPa } })
      expectRel(b.roofDriftM, a.roofDriftM / 2, 'roof drift')
      expectRel(b.displacementsM.j6.y, a.displacementsM.j6.y / 2, 'j6 y')
      for (const id of Object.keys(a.members) as FrameMemberId[]) {
        expect(Math.abs(b.members[id]!.forceN - a.members[id]!.forceN)).toBeLessThanOrEqual(1e-9 * 115000)
      }
    }
  })

  it('lateral and gravity loads superpose', () => {
    const lateral = withLoads({ j3: [20000, 0], j5: [40000, 0] })
    const gravity = withLoads({ j5: [0, -40000], j6: [0, -40000] })
    for (const d of [reference, xBraced]) {
      const a = solved(d)
      const l = solved(d, lateral)
      const g = solved(d, gravity)
      expectRel(l.roofDriftM + g.roofDriftM, a.roofDriftM, 'roof drift', 1e-12)
      for (const id of Object.keys(a.members) as FrameMemberId[]) {
        expect(Math.abs(l.members[id]!.forceN + g.members[id]!.forceN - a.members[id]!.forceN)).toBeLessThanOrEqual(1e-9 * 115000)
      }
    }
  })

  it('under gravity only the determinate reference has ≈ 0 diagonals and beams and −40 kN columns', () => {
    const g = solved(reference, withLoads({ j5: [0, -40000], j6: [0, -40000] }))
    for (const id of ['beam1', 'beam2', 'diag1a', 'diag2a'] as const) {
      // Worksheet: |N| ≤ 4e-12 N (round-off); the ≈ 0 classification threshold is 1e-9 × max|N|.
      expect(Math.abs(g.members[id]!.forceN)).toBeLessThanOrEqual(1e-9 * 40000)
      expect(g.members[id]!.sense).toBe('zero')
    }
    for (const id of ['col1L', 'col1R', 'col2L', 'col2R'] as const) expectRel(g.members[id]!.forceN, -40000, id)
  })

  it('under gravity only full X bracing develops diagonal compression from column shortening', () => {
    const g = solved(worksheetFixture('xBracedLight').design, withLoads({ j5: [0, -40000], j6: [0, -40000] }))
    expectRel(g.members.diag1a!.forceN, GRAVITY_ONLY_X_DIAGONAL_N, 'diag1a')
    expectRel(g.members.diag1b!.forceN, GRAVITY_ONLY_X_DIAGONAL_N, 'diag1b')
  })

  it('the mirrored reference reproduces mirrored forces and the opposite roof drift', () => {
    const r = worksheetFixture('reference').design.members
    const mirrored: BracedFrameDesign = {
      ...reference,
      members: {
        col1L: r.col1R, col1R: r.col1L, col2L: r.col2R, col2R: r.col2L, beam1: r.beam1, beam2: r.beam2,
        diag1a: { present: false, sectionId: r.diag1a.sectionId }, diag1b: { present: true, sectionId: r.diag1a.sectionId },
        diag2a: { present: false, sectionId: r.diag2a.sectionId }, diag2b: { present: true, sectionId: r.diag2a.sectionId },
      },
    }
    const c = withLoads({ j4: [-20000, 0], j6: [-40000, -40000], j5: [0, -40000] })
    const a = solved(reference)
    const m = solved(mirrored, c)
    const map: Record<FrameMemberId, FrameMemberId> = {
      col1L: 'col1R', col1R: 'col1L', col2L: 'col2R', col2R: 'col2L', beam1: 'beam1', beam2: 'beam2', diag1a: 'diag1b', diag1b: 'diag1a', diag2a: 'diag2b', diag2b: 'diag2a',
    }
    for (const id of Object.keys(a.members) as FrameMemberId[]) {
      expect(Math.abs(m.members[map[id]]!.forceN - a.members[id]!.forceN)).toBeLessThanOrEqual(1e-9 * 115000)
    }
    expectRel(m.roofDriftM, -a.roofDriftM, 'roof drift')
  })
})

describe('mechanism detection (BFR-11)', () => {
  const combos = Array.from({ length: 16 }, (_, k) => DIAGONAL_IDS.filter((_, i) => (k >> i) & 1))

  it.each(combos.map((ids) => [ids.join('+') || 'none', ids] as const))('%s: mechanism iff a storey has no diagonal', (_n, ids) => {
    const d = frameDesign('t', [48, 89, 60, 76, 76, 76], Object.fromEntries(ids.map((id) => [id, 76])))
    const a = analyzeBracedFrame(d, ch)
    expect(a.status).toBe(hasUnbracedStorey(d) ? 'mechanism' : 'solved')
    expect(a.unbracedStoreys).toEqual([1, 2].filter((st) => !ids.some((id) => id.startsWith(`diag${st}`))))
  })

  it('pivot ratios separate cleanly: mechanisms ≤ 8.4e-16 in magnitude, stable designs ≥ 1.52e-2', () => {
    for (const ids of combos) {
      for (const size of [48, 60, 76, 89] as const) {
        const d = frameDesign('t', [size, 89, size, 48, 60, 76], Object.fromEntries(ids.map((id) => [id, size])))
        const s = solveBracedFrame(assembleBracedFrame(d, ch))
        if (hasUnbracedStorey(d)) {
          expect(s.status).toBe('mechanism')
          expect(Math.abs(s.minPivotRatio)).toBeLessThanOrEqual(DESIGN_SPACE.maxMechanismPivotRatio)
        } else {
          expect(s.status).toBe('solved')
          expect(s.minPivotRatio).toBeGreaterThanOrEqual(DESIGN_SPACE.minStablePivotRatio * (1 - 1e-9))
        }
      }
    }
  })

  it('counts independent sway modes: two for no diagonals, one for a single unbraced storey', () => {
    const modes = (name: string) => analyzeBracedFrame(worksheetFixture(name).design, ch).notApplicableReasons[0]?.value
    expect(modes('unbraced')).toBe(2)
    expect(modes('upperUnbraced')).toBe(1)
    expect(modes('lowerXOnly')).toBe(1)
    expect(modes('upperXOnly')).toBe(1)
  })

  it('every member id is covered by the template order used in the checks', () => {
    expect(FRAME_MEMBER_IDS).toHaveLength(10)
  })
})
