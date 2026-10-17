// Braced Frame I template `oneBayTwoStorey` (task 49.2; braced-frame-1 BFR-03, design
// "Template oneBayTwoStorey"). The joint and member topology belongs to the model's template,
// not to the challenge config: v1 accepts exactly one template, whose bay width and storey
// height come from the config. Pure data plus one coordinate helper; no analysis here.
//
// Joints (x, y): j1 (0, 0) pin, j2 (b, 0) pin, j3 (0, h), j4 (b, h), j5 (0, 2h), j6 (b, 2h).
// Members always present: col1L j1–j3, col1R j2–j4, col2L j3–j5, col2R j4–j6, beam1 j3–j4,
// beam2 j5–j6. Candidate diagonals: diag1a j1–j4 and diag1b j2–j3 (storey 1), diag2a j3–j6 and
// diag2b j4–j5 (storey 2). Crossing diagonals are not connected at the crossing.

export const FRAME_TEMPLATE_ID = 'oneBayTwoStorey'

export type FrameJointId = 'j1' | 'j2' | 'j3' | 'j4' | 'j5' | 'j6'

/** Joint order; DOFs are numbered 2k (x) and 2k + 1 (y) for the joint at index k. */
export const FRAME_JOINT_IDS: readonly FrameJointId[] = Object.freeze(['j1', 'j2', 'j3', 'j4', 'j5', 'j6'] as const)

/** Pinned supports: both translations fixed (they resist uplift; anchorage is not checked). */
export type FrameSupportJointId = 'j1' | 'j2'
export const FRAME_SUPPORT_JOINT_IDS: readonly FrameSupportJointId[] = Object.freeze(['j1', 'j2'] as const)

/** Joints with free translations (8 DOFs in total). */
export type FrameFreeJointId = 'j3' | 'j4' | 'j5' | 'j6'
export const FRAME_FREE_JOINT_IDS: readonly FrameFreeJointId[] = Object.freeze(['j3', 'j4', 'j5', 'j6'] as const)

export type FixedMemberId = 'col1L' | 'col1R' | 'col2L' | 'col2R' | 'beam1' | 'beam2'
export type DiagonalId = 'diag1a' | 'diag1b' | 'diag2a' | 'diag2b'
export type FrameMemberId = FixedMemberId | DiagonalId

export const FIXED_MEMBER_IDS: readonly FixedMemberId[] = Object.freeze(['col1L', 'col1R', 'col2L', 'col2R', 'beam1', 'beam2'] as const)
export const DIAGONAL_IDS: readonly DiagonalId[] = Object.freeze(['diag1a', 'diag1b', 'diag2a', 'diag2b'] as const)

/** Fixed reporting order: the six fixed members, then the four candidate diagonals. */
export const FRAME_MEMBER_IDS: readonly FrameMemberId[] = Object.freeze([...FIXED_MEMBER_IDS, ...DIAGONAL_IDS])

export type FrameStorey = 1 | 2
export const FRAME_STOREYS: readonly FrameStorey[] = Object.freeze([1, 2] as const)

export interface FrameMemberTopology {
  id: FrameMemberId
  /** End i; the member's unit vector points from i to j. */
  i: FrameJointId
  j: FrameJointId
  kind: 'column' | 'beam' | 'diagonal'
  /** The storey the member belongs to (a beam belongs to the storey below it). */
  storey: FrameStorey
}

const m = (id: FrameMemberId, i: FrameJointId, j: FrameJointId, kind: FrameMemberTopology['kind'], storey: FrameStorey) =>
  Object.freeze({ id, i, j, kind, storey })

export const FRAME_MEMBERS: Readonly<Record<FrameMemberId, Readonly<FrameMemberTopology>>> = Object.freeze({
  col1L: m('col1L', 'j1', 'j3', 'column', 1),
  col1R: m('col1R', 'j2', 'j4', 'column', 1),
  col2L: m('col2L', 'j3', 'j5', 'column', 2),
  col2R: m('col2R', 'j4', 'j6', 'column', 2),
  beam1: m('beam1', 'j3', 'j4', 'beam', 1),
  beam2: m('beam2', 'j5', 'j6', 'beam', 2),
  diag1a: m('diag1a', 'j1', 'j4', 'diagonal', 1),
  diag1b: m('diag1b', 'j2', 'j3', 'diagonal', 1),
  diag2a: m('diag2a', 'j3', 'j6', 'diagonal', 2),
  diag2b: m('diag2b', 'j4', 'j5', 'diagonal', 2),
})

/** The candidate diagonals of each storey. */
export const STOREY_DIAGONALS: Readonly<Record<FrameStorey, readonly DiagonalId[]>> = Object.freeze({
  1: Object.freeze(['diag1a', 'diag1b'] as const),
  2: Object.freeze(['diag2a', 'diag2b'] as const),
})

/**
 * Student-facing member names. They contain no digits, so grounded explanation facts can quote
 * them (every number in a fact must come from its basis).
 */
export const FRAME_MEMBER_LABELS: Readonly<Record<FrameMemberId, string>> = Object.freeze({
  col1L: 'lower left column',
  col1R: 'lower right column',
  col2L: 'upper left column',
  col2R: 'upper right column',
  beam1: 'floor beam',
  beam2: 'roof beam',
  diag1a: 'lower diagonal (bottom left to top right)',
  diag1b: 'lower diagonal (bottom right to top left)',
  diag2a: 'upper diagonal (bottom left to top right)',
  diag2b: 'upper diagonal (bottom right to top left)',
})

/** Storey names without digits, for grounded facts. */
export const FRAME_STOREY_LABELS: Readonly<Record<FrameStorey, string>> = Object.freeze({
  1: 'lower storey',
  2: 'upper storey',
})

export interface FrameDimensions {
  bayWidthM: number
  storeyHeightM: number
}

export interface JointPoint {
  x: number
  y: number
}

/** Joint coordinates (m) for the given bay width b and storey height h. */
export function frameJointCoordinates(f: FrameDimensions): Record<FrameJointId, JointPoint> {
  const b = f.bayWidthM
  const h = f.storeyHeightM
  return {
    j1: { x: 0, y: 0 },
    j2: { x: b, y: 0 },
    j3: { x: 0, y: h },
    j4: { x: b, y: h },
    j5: { x: 0, y: 2 * h },
    j6: { x: b, y: 2 * h },
  }
}

export function isDiagonalId(id: unknown): id is DiagonalId {
  return typeof id === 'string' && (DIAGONAL_IDS as readonly string[]).includes(id)
}

export function isFrameMemberId(id: unknown): id is FrameMemberId {
  return typeof id === 'string' && (FRAME_MEMBER_IDS as readonly string[]).includes(id)
}
