import { deepFreeze } from '../../challenge/deepFreeze'
import { BRACED_FRAME_MODEL_REF, type BracedFrameChallenge } from '../../challenge/bracedFrame/types'
import type { BracedFrameDesign } from '../../geometry/bracedFrame/design'
import {
  FRAME_FREE_JOINT_IDS,
  FRAME_JOINT_IDS,
  FRAME_MEMBER_IDS,
  FRAME_MEMBERS,
  FRAME_STOREYS,
  FRAME_SUPPORT_JOINT_IDS,
  STOREY_DIAGONALS,
  frameJointCoordinates,
  isDiagonalId,
  type FrameFreeJointId,
  type FrameMemberId,
  type FrameSupportJointId,
  type JointPoint,
} from '../../geometry/bracedFrame/template'
import { PhysicsInvariantError } from '../analyze'
import { checkBracedFrameScreens, mechanismIssue } from './applicability'
import { BRACED_FRAME_ASSUMPTIONS, BRACED_FRAME_SOLVER_TOLERANCES, BRACED_FRAME_UNSUPPORTED_EFFECTS } from './constants'
import { memberGeometry, solveTruss, type TrussProblem, type TrussSolution } from './directStiffness'
import { chsProperties, classifyForce, criticalSlenderness, johnsonLoad, memberCapacity, type ChsProperties } from './members'
import type { BracedFrameAnalysis, BracedFrameAnalysisCommon, BracedFrameMemberResult, BracedFrameSolvedAnalysis } from './types'

// Braced frame analysis entry point (task 49.2; BFR-06, BFR-10–BFR-14, MM-03, MM-10).
// Pure and deterministic: reads only the typed design and challenge, never UI state, clocks or
// randomness, and never mutates its inputs. Only the six fixed members plus the present
// diagonals are assembled; an absent diagonal contributes nothing to stiffness or mass. The
// status is decided numerically by the solver (pivoted Cholesky + residual check), with no
// topology shortcut. A mechanism stores mass and the unbraced-storey list only (MM-10).

export const BRACED_FRAME_MODEL_ID = BRACED_FRAME_MODEL_REF.id
export const BRACED_FRAME_MODEL_VERSION = BRACED_FRAME_MODEL_REF.version

/**
 * Thrown when a computed value is non-finite (or a required positive value is not positive), or
 * when a design names a section outside the catalog (MM-10). It extends the beam's
 * PhysicsInvariantError so the engine's handling (a notice, no appended result) applies.
 */
export class BracedFrameInvariantError extends PhysicsInvariantError {
  constructor(field: string, value: number) {
    super(field, value)
    this.name = 'BracedFrameInvariantError'
  }
}

/** One present member, ready for assembly and capacity checks. */
export interface AssembledMember {
  id: FrameMemberId
  lengthM: number
  section: ChsProperties
}

/** The truss problem for a design plus the present members in fixed order. */
export interface AssembledFrame {
  problem: TrussProblem
  members: AssembledMember[]
}

/** True for fixed members and for present diagonals. */
export function isMemberPresent(d: BracedFrameDesign, id: FrameMemberId): boolean {
  return !isDiagonalId(id) || d.members[id].present === true
}

/**
 * Builds the truss problem (joints in FRAME_JOINT_IDS order, supports j1/j2 fully fixed, the
 * challenge loads) for the present members. Throws BracedFrameInvariantError for a section id
 * outside the catalog (a design that skipped validation).
 */
export function assembleBracedFrame(d: BracedFrameDesign, ch: BracedFrameChallenge): AssembledFrame {
  const coords = frameJointCoordinates(ch.frame)
  const nodes = FRAME_JOINT_IDS.map((j) => coords[j])
  const index = (j: string) => FRAME_JOINT_IDS.indexOf(j as (typeof FRAME_JOINT_IDS)[number])
  const E = ch.material.elasticModulusPa
  const members: AssembledMember[] = []
  const trussMembers: TrussProblem['members'][number][] = []
  for (const id of FRAME_MEMBER_IDS) {
    if (!isMemberPresent(d, id)) continue
    const sectionId = d.members[id].sectionId
    const section = ch.sections.find((s) => s.id === sectionId)
    if (section === undefined) throw new BracedFrameInvariantError(`members.${id}.sectionId`, Number.NaN)
    const props = chsProperties(section.outerDiameterM, section.wallM)
    const topo = FRAME_MEMBERS[id]
    const i = index(topo.i)
    const j = index(topo.j)
    members.push({ id, lengthM: memberGeometry(nodes[i], nodes[j]).lengthM, section: props })
    trussMembers.push({ i, j, axialRigidityN: E * props.areaM2 })
  }
  const fixedDofs = FRAME_SUPPORT_JOINT_IDS.flatMap((j) => [2 * index(j), 2 * index(j) + 1])
  const loadsN = new Array<number>(2 * nodes.length).fill(0)
  for (const load of ch.loads) {
    const k = index(load.jointId)
    loadsN[2 * k] += load.fxN
    loadsN[2 * k + 1] += load.fyN
  }
  return { problem: { nodes, members: trussMembers, fixedDofs, loadsN }, members }
}

/** Solves an assembled frame with the model's tolerances (exposed for verification tests). */
export function solveBracedFrame(frame: AssembledFrame): TrussSolution {
  return solveTruss(frame.problem, BRACED_FRAME_SOLVER_TOLERANCES)
}

function check(field: string, v: number, positive = false): number {
  if (!Number.isFinite(v) || (positive && v <= 0)) throw new BracedFrameInvariantError(field, v)
  return v
}

/** `+ 0` turns −0 into 0 so no stored force or displacement reads as "−0" (BFR-14). */
const plain = (v: number): number => v + 0

/**
 * Analyzes a braced-frame design under the challenge load case.
 *
 * Precondition: `validateBracedFrameDesign(d, ch)` returns `[]`; callers validate first (invalid
 * input is rejected before analysis). Every diagonal combination is valid; mechanisms return
 * `status: 'mechanism'` with `applicable: false`, notApplicableReasons [MECHANISM], and no
 * displacement, force, reaction, drift or utilization keys. Otherwise every numeric field is
 * finite; a violation throws BracedFrameInvariantError naming the field.
 *
 * The returned analysis is deep-frozen and names `pinJointedBracedFrame` v1. `applicable` is true
 * iff `notApplicableReasons` is empty, regardless of `warnings`.
 */
export function analyzeBracedFrame(d: BracedFrameDesign, ch: BracedFrameChallenge): BracedFrameAnalysis {
  const frame = assembleBracedFrame(d, ch)
  const E = ch.material.elasticModulusPa
  const fy = ch.material.yieldStressPa
  const rho = ch.material.densityKgM3

  const massKg = check('massKg', rho * frame.members.reduce((sum, m) => sum + m.section.areaM2 * m.lengthM, 0), true)
  const common: Omit<BracedFrameAnalysisCommon, 'applicable' | 'warnings' | 'notApplicableReasons'> = {
    modelId: BRACED_FRAME_MODEL_ID,
    modelVersion: BRACED_FRAME_MODEL_VERSION,
    unsupportedEffects: BRACED_FRAME_UNSUPPORTED_EFFECTS,
    assumptions: BRACED_FRAME_ASSUMPTIONS,
    massKg,
    unbracedStoreys: FRAME_STOREYS.filter((st) => STOREY_DIAGONALS[st].every((id) => !isMemberPresent(d, id))),
  }

  const solution = solveBracedFrame(frame)
  if (solution.status === 'mechanism') {
    return deepFreeze({
      ...common,
      status: 'mechanism' as const,
      applicable: false,
      warnings: [],
      notApplicableReasons: [mechanismIssue(solution.mechanismModes)],
    })
  }

  const u = solution.displacementsM
  const jointIndex = (j: string) => FRAME_JOINT_IDS.indexOf(j as (typeof FRAME_JOINT_IDS)[number])
  const point = (field: string, x: number, y: number): JointPoint => ({ x: plain(check(`${field}.x`, x)), y: plain(check(`${field}.y`, y)) })

  const displacementsM = {} as Record<FrameFreeJointId, JointPoint>
  for (const j of FRAME_FREE_JOINT_IDS) {
    const k = jointIndex(j)
    displacementsM[j] = point(`displacementsM.${j}`, u[2 * k], u[2 * k + 1])
  }
  const reactionsN = {} as Record<FrameSupportJointId, JointPoint>
  FRAME_SUPPORT_JOINT_IDS.forEach((j, n) => {
    reactionsN[j] = point(`reactionsN.${j}`, solution.reactionsN[2 * n], solution.reactionsN[2 * n + 1])
  })

  const forces = solution.memberForcesN.map((N, n) => plain(check(`members.${frame.members[n].id}.forceN`, N)))
  const maxAbsForce = forces.reduce((mx, N) => Math.max(mx, Math.abs(N)), 0)
  const lambdaC = criticalSlenderness(E, fy)
  const members: Partial<Record<FrameMemberId, BracedFrameMemberResult>> = {}
  let maxUtilization = Number.NEGATIVE_INFINITY
  let governingMemberId: FrameMemberId = frame.members[0].id
  let maxInelasticRatio: number | undefined
  frame.members.forEach((m, n) => {
    const forceN = forces[n]
    const sense = classifyForce(forceN, maxAbsForce, BRACED_FRAME_SOLVER_TOLERANCES.zeroForceRelTol)
    const { capacityN, mode } = memberCapacity(sense, m.section, m.lengthM, E, fy)
    const utilization = check(`members.${m.id}.utilization`, Math.abs(forceN) / check(`members.${m.id}.capacityN`, capacityN, true))
    const slenderness = check(`members.${m.id}.slenderness`, m.lengthM / m.section.radiusOfGyrationM, true)
    members[m.id] = { forceN, sense, capacityN, mode, utilization, slenderness }
    if (utilization > maxUtilization) {
      maxUtilization = utilization
      governingMemberId = m.id
    }
    if (sense === 'compression' && slenderness < lambdaC) {
      const ratio = check(`members.${m.id}.inelasticRatio`, Math.abs(forceN) / johnsonLoad(m.section.areaM2, fy, slenderness, E))
      maxInelasticRatio = maxInelasticRatio === undefined ? ratio : Math.max(maxInelasticRatio, ratio)
    }
  })

  const h = ch.frame.storeyHeightM
  const floorDriftM = check('floorDriftM', (displacementsM.j3.x + displacementsM.j4.x) / 2)
  const roofDriftM = check('roofDriftM', (displacementsM.j5.x + displacementsM.j6.x) / 2)
  const storeyDriftRatios: [number, number] = [check('storeyDriftRatios.0', floorDriftM / h), check('storeyDriftRatios.1', (roofDriftM - floorDriftM) / h)]
  const solved: Omit<BracedFrameSolvedAnalysis, 'applicable' | 'warnings' | 'notApplicableReasons'> = {
    ...common,
    status: 'solved',
    displacementsM,
    members,
    reactionsN,
    floorDriftM: plain(floorDriftM),
    roofDriftM: plain(roofDriftM),
    storeyDriftRatios: [plain(storeyDriftRatios[0]), plain(storeyDriftRatios[1])],
    maxStoreyDriftRatio: Math.max(Math.abs(storeyDriftRatios[0]), Math.abs(storeyDriftRatios[1])),
    maxUtilization: check('maxUtilization', maxUtilization),
    governingMemberId,
    ...(maxInelasticRatio !== undefined ? { maxInelasticRatio } : {}),
  }

  const { warnings, notApplicable } = checkBracedFrameScreens(solved)
  return deepFreeze({ ...solved, applicable: notApplicable.length === 0, warnings, notApplicableReasons: notApplicable })
}
