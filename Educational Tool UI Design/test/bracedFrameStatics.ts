import type { BracedFrameDesign } from '../src/geometry/bracedFrame/design'
import type { FrameMemberId } from '../src/geometry/bracedFrame/template'
import { MEMBER_LENGTH_M, SECTION_TABLE, type SectionShorthand } from './fixtures/bracedFrame'

// Independent hand methods for Braced Frame I (task 49.2; braced-frame-1 design.md "Independent
// checks"). TEST CODE ONLY: nothing here is used by the app, and nothing here calls the app's
// solver, section or capacity code. Section areas come from the transcribed worksheet table.
//   (a) method of joints for the four determinate topologies, general joint loads;
//   (b) unit-load (virtual work) displacements Δ = Σ N n L / (E A);
//   (c) force method for X-braced storeys (primary structure diag1a + diag2a).
// Geometry is the worksheet template: b = 4 m, h = 3 m, L_d = 5 m, c = 0.8, s = 0.6.

export const C = 0.8
export const S = 0.6
export const E_PA = 200e9

/** Joint loads on the free joints, (Px, Py) in N. Missing joints carry no load. */
export type FreeLoads = Partial<Record<'j3' | 'j4' | 'j5' | 'j6', readonly [number, number]>>

export type DeterminateTopology = 'tension' | 'compression' | 'mixed' | 'mirroredMixed'

export interface StaticsResult {
  forces: Partial<Record<FrameMemberId, number>>
  /** (R_j1x, R_j1y, R_j2x, R_j2y), N. */
  reactions: readonly [number, number, number, number]
}

/** The worksheet load case: P_j3 = (20 kN, 0), P_j5 = (40 kN, −40 kN), P_j6 = (0, −40 kN). */
export const WORKSHEET_LOADS: FreeLoads = { j3: [20000, 0], j5: [40000, -40000], j6: [0, -40000] }

/**
 * Method of joints (design.md check (a)), solving joints in the order that leaves two unknowns:
 *   tension       diag1a + diag2a  (j5, j6, j3, j4)
 *   compression   diag1b + diag2b  (j6, j5, j4, j3)
 *   mixed         diag1a + diag2b  (j6, j5, j3, j4)
 *   mirroredMixed diag1b + diag2a  (j5, j6, j4, j3), derived by the same joint equilibrium.
 */
export function methodOfJoints(topology: DeterminateTopology, loads: FreeLoads): StaticsResult {
  const [P3x, P3y] = loads.j3 ?? [0, 0]
  const [P4x, P4y] = loads.j4 ?? [0, 0]
  const [P5x, P5y] = loads.j5 ?? [0, 0]
  const [P6x, P6y] = loads.j6 ?? [0, 0]
  const upperTension = () => {
    const beam2 = -P5x
    const col2L = P5y
    const diag2a = (P6x + P5x) / C
    const col2R = P6y - S * diag2a
    return { beam2, col2L, diag2a, col2R }
  }
  const upperCompression = () => {
    const beam2 = P6x
    const col2R = P6y
    const diag2b = -(P5x + beam2) / C
    const col2L = P5y - S * diag2b
    return { beam2, col2R, diag2b, col2L }
  }
  switch (topology) {
    case 'tension': {
      const u = upperTension()
      const beam1 = -P3x - C * u.diag2a
      const col1L = u.col2L + S * u.diag2a + P3y
      const diag1a = (P4x - beam1) / C
      const col1R = u.col2R - S * diag1a + P4y
      return { forces: { ...u, beam1, col1L, diag1a, col1R }, reactions: [-C * diag1a, -col1L - S * diag1a, 0, -col1R] }
    }
    case 'compression': {
      const u = upperCompression()
      const beam1 = P4x - C * u.diag2b
      const col1R = u.col2R + S * u.diag2b + P4y
      const diag1b = -(P3x + beam1) / C
      const col1L = u.col2L - S * diag1b + P3y
      return { forces: { ...u, beam1, col1R, diag1b, col1L }, reactions: [0, -col1L, C * diag1b, -col1R - S * diag1b] }
    }
    case 'mixed': {
      const u = upperCompression()
      const beam1 = -P3x
      const col1L = u.col2L + P3y
      const diag1a = (P4x - beam1 - C * u.diag2b) / C
      const col1R = u.col2R + S * u.diag2b - S * diag1a + P4y
      return { forces: { ...u, beam1, col1L, diag1a, col1R }, reactions: [-C * diag1a, -col1L - S * diag1a, 0, -col1R] }
    }
    case 'mirroredMixed': {
      const u = upperTension()
      const beam1 = P4x
      const col1R = u.col2R + P4y
      const diag1b = -(P3x + beam1 + C * u.diag2a) / C
      const col1L = P3y + u.col2L - S * diag1b + S * u.diag2a
      return { forces: { ...u, beam1, col1R, diag1b, col1L }, reactions: [0, -col1L, C * diag1b, -col1R - S * diag1b] }
    }
  }
}

/** The determinate topology of a design with exactly one diagonal per storey, else undefined. */
export function determinateTopology(d: BracedFrameDesign): DeterminateTopology | undefined {
  const m = d.members
  const lower = m.diag1a.present !== m.diag1b.present ? (m.diag1a.present ? 'a' : 'b') : undefined
  const upper = m.diag2a.present !== m.diag2b.present ? (m.diag2a.present ? 'a' : 'b') : undefined
  if (lower === undefined || upper === undefined) return undefined
  const table: Record<string, DeterminateTopology> = { aa: 'tension', bb: 'compression', ab: 'mixed', ba: 'mirroredMixed' }
  return table[lower + upper]
}

const SHORTHAND_BY_ID: Readonly<Record<string, SectionShorthand>> = Object.fromEntries(
  (Object.keys(SECTION_TABLE) as unknown as SectionShorthand[]).map((k) => [SECTION_TABLE[k].id, Number(k) as SectionShorthand]),
)

/** Flexibility L / (E A) of a member of the design (worksheet section area), m/N. */
export function flexibility(d: BracedFrameDesign, id: FrameMemberId, elasticModulusPa: number = E_PA): number {
  const area = SECTION_TABLE[SHORTHAND_BY_ID[d.members[id].sectionId]].areaM2
  return MEMBER_LENGTH_M[id] / (elasticModulusPa * area)
}

/** Unit-load theorem: Δ = Σ N n L / (E A) over the members both force sets name. */
export function virtualWork(d: BracedFrameDesign, N: StaticsResult['forces'], n: StaticsResult['forces']): number {
  let sum = 0
  for (const id of Object.keys(N) as FrameMemberId[]) {
    if (n[id] === undefined) continue
    sum += (N[id] as number) * (n[id] as number) * flexibility(d, id)
  }
  return sum
}

/** Unit-load systems: ½ at j5 and ½ at j6 (roof drift), ½ at j3 and ½ at j4 (floor drift), 1 down at j6. */
export const UNIT_ROOF: FreeLoads = { j5: [0.5, 0], j6: [0.5, 0] }
export const UNIT_FLOOR: FreeLoads = { j3: [0.5, 0], j4: [0.5, 0] }
export const UNIT_J6_DOWN: FreeLoads = { j6: [0, -1] }

/** Unit tension in diag1b applied to the primary structure: (c, −s) at j3, plus 1 in diag1b. */
export function redundantStorey1(): StaticsResult['forces'] {
  return { ...methodOfJoints('tension', { j3: [C, -S] }).forces, diag1b: 1 }
}

/** Unit tension in diag2b applied to the primary structure: (−c, s) at j4 and (c, −s) at j5, plus 1. */
export function redundantStorey2(): StaticsResult['forces'] {
  return { ...methodOfJoints('tension', { j4: [-C, S], j5: [C, -S] }).forces, diag2b: 1 }
}

export interface ForceMethodResult {
  /** Flexibility matrix f_ij = Σ n_i n_j L / (E A), m/N. */
  f: number[][]
  /** δ_i0 = Σ N₀ n_i L / (E A), m. */
  delta0: number[]
  /** Redundants X solving f X = −δ₀, N. */
  X: number[]
  /** Final forces N = N₀ + Σ X_i n_i. */
  forces: StaticsResult['forces']
}

/**
 * Force method (design.md check (c)) with primary structure diag1a + diag2a; redundants are
 * N_diag1b (if present) and N_diag2b (if present). Solves the 1 × 1 or 2 × 2 compatibility
 * equations by Cramer's rule.
 */
export function forceMethod(d: BracedFrameDesign, loads: FreeLoads): ForceMethodResult {
  const N0 = methodOfJoints('tension', loads).forces
  const ns: StaticsResult['forces'][] = []
  if (d.members.diag1b.present) ns.push(redundantStorey1())
  if (d.members.diag2b.present) ns.push(redundantStorey2())
  const f = ns.map((ni) => ns.map((nj) => virtualWork(d, ni, nj)))
  const delta0 = ns.map((ni) => virtualWork(d, N0, ni))
  let X: number[]
  if (ns.length === 1) {
    X = [-delta0[0] / f[0][0]]
  } else {
    const det = f[0][0] * f[1][1] - f[0][1] * f[1][0]
    X = [(-delta0[0] * f[1][1] + delta0[1] * f[0][1]) / det, (-delta0[1] * f[0][0] + delta0[0] * f[1][0]) / det]
  }
  const forces: StaticsResult['forces'] = { ...N0 }
  ns.forEach((n, i) => {
    for (const id of Object.keys(n) as FrameMemberId[]) forces[id] = (forces[id] ?? 0) + X[i] * (n[id] as number)
  })
  return { f, delta0, X, forces }
}
