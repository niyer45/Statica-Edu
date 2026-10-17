import { choleskySolve, matVec, norm2, pivotedCholesky } from './pivotedCholesky'

// Direct stiffness method for a 2D pin-jointed truss (task 49.2; braced-frame-1 BFR-10, BFR-11,
// design "Equations"). Pure and dependency-free apart from the sibling factorization; small
// dense matrices only. Linear elastic, small displacements: equilibrium is written on the
// undeformed geometry. Tension is positive. Knows nothing about the frame template, sections or
// the challenge; physics/bracedFrame/analyze.ts builds the problem.
//
// DOFs: node k has x at 2k and y at 2k + 1. For member m from node i to node j with unit vector
// (c, s) and axial stiffness k = EA/L, the global element matrix is k v vᵀ with
// v = (−c, −s, c, s) on (u_ix, u_iy, u_jx, u_jy). The fixed DOFs are deleted and K_ff u_f = P_f
// is solved by pivoted Cholesky. Mechanism if a pivot is ≤ τ_p · max diag(K_ff), or if the
// solved system fails the residual check ‖K_ff u − P_f‖₂ / ‖P_f‖₂ ≤ τ_r, or any u is not finite.
// Member forces N = k [c (u_jx − u_ix) + s (u_jy − u_iy)]; reactions R = K u − P at fixed DOFs.
// References: McGuire, Gallagher & Ziemian, Matrix Structural Analysis (direct stiffness method,
// truss element, supports, singularity). Edition and equation numbers pending owner review (29.2).

export interface TrussNode {
  x: number
  y: number
}

export interface TrussMember {
  /** Index of end i (the unit vector points from i to j). */
  i: number
  j: number
  /** E·A, N. */
  axialRigidityN: number
}

export interface TrussProblem {
  nodes: readonly TrussNode[]
  members: readonly TrussMember[]
  /** Restrained DOF indices (each listed once). */
  fixedDofs: readonly number[]
  /** Applied joint loads on every DOF (length 2 × nodes), N. */
  loadsN: readonly number[]
}

export interface TrussTolerances {
  /** τ_p: relative pivot threshold against max diag(K_ff). */
  pivotRelTol: number
  /** τ_r: relative equilibrium residual threshold. */
  residualRelTol: number
}

export type TrussSolution =
  | {
      status: 'solved'
      /** Every DOF (fixed DOFs are exactly 0), m. */
      displacementsM: number[]
      /** Axial force per member, in input order, tension positive, N. */
      memberForcesN: number[]
      /** Reaction per fixed DOF, in `fixedDofs` order, N. */
      reactionsN: number[]
      /** Smallest accepted pivot / max diag(K_ff). */
      minPivotRatio: number
      /** ‖K_ff u − P_f‖₂ / ‖P_f‖₂ (absolute when P_f = 0). */
      relativeResidual: number
    }
  | {
      status: 'mechanism'
      /**
       * Independent mechanism modes: n_free − numerical rank of K_ff, and at least 1 when the
       * residual or finiteness check failed.
       */
      mechanismModes: number
      /** The rejected pivot ratio, or the smallest accepted one when the residual check failed. */
      minPivotRatio: number
    }

/** Length and direction cosines of the segment from node i to node j. */
export function memberGeometry(a: TrussNode, b: TrussNode): { lengthM: number; c: number; s: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthM = Math.hypot(dx, dy)
  return { lengthM, c: dx / lengthM, s: dy / lengthM }
}

/** The full 2n × 2n global stiffness matrix. */
export function assembleStiffness(p: Pick<TrussProblem, 'nodes' | 'members'>): number[][] {
  const size = 2 * p.nodes.length
  const K: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0))
  for (const m of p.members) {
    const { lengthM, c, s } = memberGeometry(p.nodes[m.i], p.nodes[m.j])
    const k = m.axialRigidityN / lengthM
    const dofs = [2 * m.i, 2 * m.i + 1, 2 * m.j, 2 * m.j + 1]
    const v = [-c, -s, c, s]
    for (let a = 0; a < 4; a++) {
      for (let b = 0; b < 4; b++) K[dofs[a]][dofs[b]] += k * v[a] * v[b]
    }
  }
  return K
}

/** Solves the truss. Deterministic; never throws for finite inputs. */
export function solveTruss(p: TrussProblem, tol: TrussTolerances): TrussSolution {
  const size = 2 * p.nodes.length
  const fixed = new Set(p.fixedDofs)
  const free = Array.from({ length: size }, (_, d) => d).filter((d) => !fixed.has(d))
  const K = assembleStiffness(p)
  const Kff = free.map((r) => free.map((c) => K[r][c]))
  const Pf = free.map((d) => p.loadsN[d])

  const factor = pivotedCholesky(Kff, tol.pivotRelTol)
  if (!factor.ok) return { status: 'mechanism', mechanismModes: free.length - factor.rank, minPivotRatio: factor.minPivotRatio }

  const uf = choleskySolve(factor, Pf)
  const residual = matVec(Kff, uf).map((v, i) => v - Pf[i])
  const pNorm = norm2(Pf)
  const relativeResidual = pNorm > 0 ? norm2(residual) / pNorm : norm2(residual)
  if (!uf.every(Number.isFinite) || !(relativeResidual <= tol.residualRelTol)) {
    // Full numerical rank but no equilibrium: count it as one (undetermined) mechanism mode.
    return { status: 'mechanism', mechanismModes: 1, minPivotRatio: factor.minPivotRatio }
  }

  const u = new Array<number>(size).fill(0)
  free.forEach((d, i) => (u[d] = uf[i]))
  const memberForcesN = p.members.map((m) => {
    const { lengthM, c, s } = memberGeometry(p.nodes[m.i], p.nodes[m.j])
    const k = m.axialRigidityN / lengthM
    return k * (c * (u[2 * m.j] - u[2 * m.i]) + s * (u[2 * m.j + 1] - u[2 * m.i + 1]))
  })
  const Ku = matVec(K, u)
  const reactionsN = p.fixedDofs.map((d) => Ku[d] - p.loadsN[d])
  return { status: 'solved', displacementsM: u, memberForcesN, reactionsN, minPivotRatio: factor.minPivotRatio, relativeResidual }
}
