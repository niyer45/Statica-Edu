import { describe, expect, it } from 'vitest'
import { assembleStiffness, memberGeometry, solveTruss, type TrussProblem } from './directStiffness'

// Direct stiffness solver (task 49.2; BFR-10, BFR-11), on small trusses with hand solutions.

const TOL = { pivotRelTol: 1e-9, residualRelTol: 1e-9 }

/** A two-bar truss: supports at (0, 0) and (2, 0), apex at (1, 1), load (Px, Py) at the apex. */
function twoBar(Px: number, Py: number, EA = 1e6): TrussProblem {
  return {
    nodes: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
    members: [{ i: 0, j: 2, axialRigidityN: EA }, { i: 1, j: 2, axialRigidityN: EA }],
    fixedDofs: [0, 1, 2, 3],
    loadsN: [0, 0, 0, 0, Px, Py],
  }
}

describe('memberGeometry', () => {
  it('returns length and direction cosines from i to j', () => {
    expect(memberGeometry({ x: 0, y: 0 }, { x: 4, y: 3 })).toEqual({ lengthM: 5, c: 0.8, s: 0.6 })
    expect(memberGeometry({ x: 4, y: 0 }, { x: 0, y: 3 })).toEqual({ lengthM: 5, c: -0.8, s: 0.6 })
  })
})

describe('assembleStiffness', () => {
  it('builds k v vᵀ per member: a horizontal bar couples only the x DOFs', () => {
    const K = assembleStiffness({ nodes: [{ x: 0, y: 0 }, { x: 2, y: 0 }], members: [{ i: 0, j: 1, axialRigidityN: 10 }] })
    expect(K).toEqual([
      [5, 0, -5, 0],
      [0, 0, 0, 0],
      [-5, 0, 5, 0],
      [0, 0, 0, 0],
    ].map((r) => r.map((v) => v + 0)))
  })
})

describe('solveTruss', () => {
  it('matches the method of joints for a symmetric two-bar truss under a vertical load', () => {
    const s = solveTruss(twoBar(0, -1000), TOL)
    if (s.status !== 'solved') throw new Error('expected solved')
    // Each bar carries −P / (2 sin 45°) = −707.1 N (compression).
    for (const N of s.memberForcesN) expect(N).toBeCloseTo(-1000 / (2 * Math.SQRT1_2), 9)
    // Reactions: each support carries 500 N up; the compressed bars push the supports apart.
    s.reactionsN.forEach((r, i) => expect(r).toBeCloseTo([500, 500, -500, 500][i], 9))
    expect(s.displacementsM.slice(0, 4)).toEqual([0, 0, 0, 0])
    expect(s.relativeResidual).toBeLessThanOrEqual(1e-12)
    expect(s.minPivotRatio).toBeGreaterThan(0.1)
  })

  it('reports a mechanism with its mode count when a joint is under-restrained', () => {
    // One bar only: the apex can rotate about the left support (one free mode).
    const p: TrussProblem = { ...twoBar(1, 0), members: [{ i: 0, j: 2, axialRigidityN: 1e6 }] }
    expect(solveTruss(p, TOL)).toMatchObject({ status: 'mechanism', mechanismModes: 1 })
    // No bars at all: both apex DOFs are free.
    expect(solveTruss({ ...p, members: [] }, TOL)).toMatchObject({ status: 'mechanism', mechanismModes: 2 })
  })

  it('reports a mechanism when the residual check fails even though every pivot passed', () => {
    // An impossible residual tolerance forces the defense-in-depth branch.
    const s = solveTruss(twoBar(3, -7), { pivotRelTol: 1e-9, residualRelTol: -1 })
    expect(s).toMatchObject({ status: 'mechanism', mechanismModes: 1 })
    expect(s.minPivotRatio).toBeGreaterThan(0)
  })

  it('reports a mechanism for non-finite displacements', () => {
    expect(solveTruss(twoBar(Infinity, 0), TOL).status).toBe('mechanism')
  })

  it('returns zero displacements for a zero load (absolute residual)', () => {
    const s = solveTruss(twoBar(0, 0), TOL)
    if (s.status !== 'solved') throw new Error('expected solved')
    expect(s.relativeResidual).toBe(0)
    expect(s.memberForcesN.every((N) => N === 0)).toBe(true)
  })

  it('scales displacements with 1/EA and keeps forces', () => {
    const a = solveTruss(twoBar(200, -300), TOL)
    const b = solveTruss(twoBar(200, -300, 2e6), TOL)
    if (a.status !== 'solved' || b.status !== 'solved') throw new Error('expected solved')
    a.displacementsM.forEach((u, i) => expect(b.displacementsM[i]).toBeCloseTo(u / 2, 15))
    a.memberForcesN.forEach((N, i) => expect(b.memberForcesN[i]).toBeCloseTo(N, 9))
  })
})
