// Feature: braced-frame-1, Property 4: Stable frames satisfy joint and global equilibrium
// **Validates: BFR-10, BFR-15**
//
// For any stable topology (each storey braced by one diagonal or X bracing), any sections and any
// joint loads on the free joints: recomputing joint equilibrium at j3–j6 from the stored member
// forces leaves a residual ≤ 1e-9 of the load scale, the stored reactions balance the applied
// loads in x, y and moment about j1, and the drifts are the joint averages of the stored
// displacements. Every utilization is |N| / capacity with the BFR-10 capacity for the stored sense.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbStableBracedFrameDesign, bracedFrameChallenge } from '../../../test/fixtures/bracedFrame'
import { assertProperty } from '../../../test/pbt'
import type { BracedFrameChallenge } from '../../challenge/bracedFrame/types'
import { FRAME_FREE_JOINT_IDS, FRAME_MEMBERS, frameJointCoordinates, type FrameJointId, type FrameMemberId } from '../../geometry/bracedFrame/template'
import { analyzeBracedFrame } from './analyze'

const ch = bracedFrameChallenge()
const coords = frameJointCoordinates(ch.frame)
const arbLoad = fc.double({ min: -1e5, max: 1e5, noNaN: true })
const arbLoads = fc.tuple(arbLoad, arbLoad, arbLoad, arbLoad, arbLoad, arbLoad, arbLoad, arbLoad).filter((v) => v.some((x) => Math.abs(x) > 1))

function withLoads(v: readonly number[]): BracedFrameChallenge {
  return { ...ch, loads: FRAME_FREE_JOINT_IDS.map((jointId, k) => ({ jointId, fxN: v[2 * k], fyN: v[2 * k + 1] })) }
}

describe('Property 4: equilibrium of stable frames', () => {
  it('holds at every joint and globally', () => {
    assertProperty(
      fc.property(arbStableBracedFrameDesign(), arbLoads, (d, v) => {
        const c = withLoads(v)
        const a = analyzeBracedFrame(d, c)
        if (a.status !== 'solved') throw new Error('stable topology did not solve')
        const scale = Math.max(...v.map(Math.abs))
        const sum: Record<FrameJointId, [number, number]> = { j1: [0, 0], j2: [0, 0], j3: [0, 0], j4: [0, 0], j5: [0, 0], j6: [0, 0] }
        for (const load of c.loads) {
          sum[load.jointId][0] += load.fxN
          sum[load.jointId][1] += load.fyN
        }
        for (const [id, m] of Object.entries(a.members) as [FrameMemberId, NonNullable<(typeof a.members)[FrameMemberId]>][]) {
          const { i, j } = FRAME_MEMBERS[id]
          const dx = coords[j].x - coords[i].x
          const dy = coords[j].y - coords[i].y
          const L = Math.hypot(dx, dy)
          // A tension member pulls each end joint toward the other end.
          sum[i][0] += (m.forceN * dx) / L
          sum[i][1] += (m.forceN * dy) / L
          sum[j][0] -= (m.forceN * dx) / L
          sum[j][1] -= (m.forceN * dy) / L
        }
        for (const jt of FRAME_FREE_JOINT_IDS) {
          expect(Math.abs(sum[jt][0]), `${jt} x`).toBeLessThanOrEqual(1e-9 * scale)
          expect(Math.abs(sum[jt][1]), `${jt} y`).toBeLessThanOrEqual(1e-9 * scale)
        }
        // Reactions balance the member forces at the supports and the applied loads globally.
        const r = a.reactionsN
        expect(Math.abs(sum.j1[0] + r.j1.x) + Math.abs(sum.j1[1] + r.j1.y) + Math.abs(sum.j2[0] + r.j2.x) + Math.abs(sum.j2[1] + r.j2.y)).toBeLessThanOrEqual(4e-9 * scale)
        const fx = r.j1.x + r.j2.x + c.loads.reduce((s, l) => s + l.fxN, 0)
        const fy = r.j1.y + r.j2.y + c.loads.reduce((s, l) => s + l.fyN, 0)
        const mz = coords.j2.x * r.j2.y + c.loads.reduce((s, l) => s + coords[l.jointId].x * l.fyN - coords[l.jointId].y * l.fxN, 0)
        expect(Math.abs(fx)).toBeLessThanOrEqual(1e-9 * 4 * scale)
        expect(Math.abs(fy)).toBeLessThanOrEqual(1e-9 * 4 * scale)
        expect(Math.abs(mz)).toBeLessThanOrEqual(1e-9 * 4 * scale * 6)
        const u = a.displacementsM
        expect(a.floorDriftM).toBe((u.j3.x + u.j4.x) / 2)
        expect(a.roofDriftM).toBe((u.j5.x + u.j6.x) / 2)
        for (const m of Object.values(a.members)) expect(m!.utilization).toBe(Math.abs(m!.forceN) / m!.capacityN)
      }),
    )
  })
})
