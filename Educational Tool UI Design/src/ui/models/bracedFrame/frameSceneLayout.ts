import type { BracedFrameDesign } from '../../../geometry/bracedFrame/design'
import { FRAME_MEMBER_IDS, FRAME_MEMBERS, FRAME_SUPPORT_JOINT_IDS, frameJointCoordinates, isDiagonalId, type FrameJointId, type FrameMemberId } from '../../../geometry/bracedFrame/template'
import type { BracedFrameAnalysis } from '../../../physics/bracedFrame/types'
import type { StudentBracedFrameChallenge } from './shared'

// Display layout of the Braced Frame I 3D scene (task 54.3). Pure drawing data for the lazy
// scene chunk, with no three.js import so it is unit-testable: joint positions come from the
// challenge template, tube diameters from each DRAFT member's chosen catalog section, force
// patterns from the LATEST TESTED stored analysis, and load arrows from the configured loads.
// No structural quantity is computed here; lengths and angles are drawing math only.

export type Vec3 = readonly [number, number, number]

/**
 * Tube diameters are drawn proportionally exaggerated by this factor (not to scale): the real
 * 48–89 mm sections would be only a few pixels wide on a 4 m × 6 m frame. Relative sizes are kept.
 */
export const TUBE_DIAMETER_EXAGGERATION = 4

/** The latest tested force pattern of a present member; `plain` when no tested force exists. */
export type MemberPattern = 'tension' | 'compression' | 'zero' | 'plain'

export interface SceneMember {
  id: FrameMemberId
  start: Vec3
  end: Vec3
  /** Drawn tube radius, m (exaggerated, proportional to the section's outer diameter). */
  radiusM: number
  pattern: MemberPattern
}

export interface SceneAbsentMember {
  id: FrameMemberId
  start: Vec3
  end: Vec3
}

export interface SceneLoadArrow {
  key: string
  /** Arrow tip, just short of the loaded joint. */
  tip: Vec3
  /** Unit direction of the load component (display only). */
  direction: Vec3
}

export interface FrameSceneLayout {
  members: SceneMember[]
  absent: SceneAbsentMember[]
  joints: { id: FrameJointId; position: Vec3 }[]
  supports: { id: FrameJointId; position: Vec3 }[]
  loads: SceneLoadArrow[]
  /** Hinge sphere radius, m: slightly larger than the thickest drawn tube. */
  jointRadiusM: number
  /** Height of the pin support below each base joint, m. */
  supportHeightM: number
  /** Top surface of the ground slab, m. */
  groundY: number
  slab: { minX: number; maxX: number; depthM: number }
  /** Camera framing: centre and radius of a sphere that contains the whole scene. */
  center: Vec3
  radiusM: number
}

/** Load arrow length, m (constant; magnitudes are given in the challenge panel text). */
export const LOAD_ARROW_LENGTH_M = 1.1
const SUPPORT_HEIGHT_M = 0.42
const BASE_PLATE_M = 0.05
const SLAB_MARGIN_M = 1.3

const v = (x: number, y: number): Vec3 => [x, y, 0]

export function frameSceneLayout(ch: Pick<StudentBracedFrameChallenge, 'frame' | 'sections' | 'loads'>, draft: Readonly<BracedFrameDesign>, tested: Readonly<BracedFrameAnalysis>): FrameSceneLayout {
  const joints = frameJointCoordinates(ch.frame)
  const at = (j: FrameJointId) => v(joints[j].x, joints[j].y)
  const radius = (sectionId: string) => ((ch.sections.find((s) => s.id === sectionId) ?? ch.sections[0]!).outerDiameterM * TUBE_DIAMETER_EXAGGERATION) / 2
  const pattern = (id: FrameMemberId): MemberPattern => {
    if (tested.status !== 'solved') return 'plain'
    return tested.members[id]?.sense ?? 'plain'
  }
  const members: SceneMember[] = []
  const absent: SceneAbsentMember[] = []
  for (const id of FRAME_MEMBER_IDS) {
    const t = FRAME_MEMBERS[id]
    const choice = draft.members[id]
    if (isDiagonalId(id) && !draft.members[id].present) absent.push({ id, start: at(t.i), end: at(t.j) })
    else members.push({ id, start: at(t.i), end: at(t.j), radiusM: radius(choice.sectionId), pattern: pattern(id) })
  }
  const jointRadiusM = Math.max(...ch.sections.map((s) => s.outerDiameterM)) * TUBE_DIAMETER_EXAGGERATION * 0.62
  const loads: SceneLoadArrow[] = []
  for (const l of ch.loads) {
    const p = joints[l.jointId]
    if (l.fxN !== 0) {
      const dx = Math.sign(l.fxN)
      loads.push({ key: `${l.jointId}-x`, tip: v(p.x - dx * jointRadiusM, p.y), direction: [dx, 0, 0] })
    }
    if (l.fyN !== 0) {
      const dy = Math.sign(l.fyN)
      loads.push({ key: `${l.jointId}-y`, tip: v(p.x, p.y - dy * jointRadiusM), direction: [0, dy, 0] })
    }
  }
  const b = ch.frame.bayWidthM
  const top = 2 * ch.frame.storeyHeightM
  const groundY = -SUPPORT_HEIGHT_M - BASE_PLATE_M
  // Bounds include the load arrows on either side and above, and the slab below.
  const minX = Math.min(-SLAB_MARGIN_M, -LOAD_ARROW_LENGTH_M - jointRadiusM)
  const maxX = Math.max(b + SLAB_MARGIN_M, b + LOAD_ARROW_LENGTH_M + jointRadiusM)
  const maxY = top + LOAD_ARROW_LENGTH_M + jointRadiusM
  const depthM = 2.2
  return {
    members,
    absent,
    joints: (Object.keys(joints) as FrameJointId[]).map((id) => ({ id, position: at(id) })),
    supports: FRAME_SUPPORT_JOINT_IDS.map((id) => ({ id, position: at(id) })),
    loads,
    jointRadiusM,
    supportHeightM: SUPPORT_HEIGHT_M,
    groundY,
    slab: { minX: -SLAB_MARGIN_M, maxX: b + SLAB_MARGIN_M, depthM },
    center: [(minX + maxX) / 2, (groundY + maxY) / 2, 0],
    radiusM: Math.hypot((maxX - minX) / 2, (maxY - groundY) / 2, depthM / 4),
  }
}

/** Length and in-plane angle of a member, for orienting a tube along it (drawing math only). */
export function memberAxis(start: Vec3, end: Vec3): { midpoint: Vec3; length: number; angleRad: number } {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  return {
    midpoint: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2],
    length: Math.hypot(dx, dy),
    angleRad: Math.atan2(dy, dx),
  }
}
