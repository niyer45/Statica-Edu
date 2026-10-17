// Feature: braced-frame-1, Property 5: Response is linear in loads and scales with 1/E
// **Validates: BFR-10, BFR-15**
//
// For any stable design, scaling every load by k > 0 scales every displacement, member force and
// reaction by k (and leaves mass unchanged), and scaling E by k divides every displacement by k
// while leaving every member force unchanged, all within 1e-9 of the response scale.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbStableBracedFrameDesign, bracedFrameChallenge } from '../../../test/fixtures/bracedFrame'
import { assertProperty } from '../../../test/pbt'
import type { BracedFrameChallenge } from '../../challenge/bracedFrame/types'
import { FRAME_FREE_JOINT_IDS, type FrameMemberId } from '../../geometry/bracedFrame/template'
import { analyzeBracedFrame } from './analyze'
import type { BracedFrameSolvedAnalysis } from './types'

const ch = bracedFrameChallenge()
const arbFactor = fc.double({ min: 0.01, max: 100, noNaN: true })

function solved(d: Parameters<typeof analyzeBracedFrame>[0], c: BracedFrameChallenge): BracedFrameSolvedAnalysis {
  const a = analyzeBracedFrame(d, c)
  if (a.status !== 'solved') throw new Error('expected solved')
  return a
}

const disp = (a: BracedFrameSolvedAnalysis) => FRAME_FREE_JOINT_IDS.flatMap((j) => [a.displacementsM[j].x, a.displacementsM[j].y])
const maxAbs = (v: readonly number[]) => Math.max(...v.map(Math.abs))

describe('Property 5: linearity and 1/E scaling', () => {
  it('scales with the loads', () => {
    assertProperty(
      fc.property(arbStableBracedFrameDesign(), arbFactor, (d, k) => {
        const a = solved(d, ch)
        const b = solved(d, { ...ch, loads: ch.loads.map((l) => ({ ...l, fxN: k * l.fxN, fyN: k * l.fyN })) })
        expect(b.massKg).toBe(a.massKg)
        const ua = disp(a)
        const ub = disp(b)
        ua.forEach((u, i) => expect(Math.abs(ub[i] - k * u)).toBeLessThanOrEqual(1e-9 * k * maxAbs(ua)))
        const ids = Object.keys(a.members) as FrameMemberId[]
        const nScale = maxAbs(ids.map((id) => a.members[id]!.forceN))
        for (const id of ids) expect(Math.abs(b.members[id]!.forceN - k * a.members[id]!.forceN)).toBeLessThanOrEqual(1e-9 * k * nScale)
        expect(Math.abs(b.reactionsN.j2.y - k * a.reactionsN.j2.y)).toBeLessThanOrEqual(1e-9 * k * nScale)
      }),
    )
  })

  it('scales displacements with 1/E and keeps forces', () => {
    assertProperty(
      fc.property(arbStableBracedFrameDesign(), arbFactor, (d, k) => {
        const a = solved(d, ch)
        const b = solved(d, { ...ch, material: { ...ch.material, elasticModulusPa: k * ch.material.elasticModulusPa } })
        const ua = disp(a)
        const ub = disp(b)
        ua.forEach((u, i) => expect(Math.abs(ub[i] - u / k)).toBeLessThanOrEqual((1e-9 * maxAbs(ua)) / k))
        const ids = Object.keys(a.members) as FrameMemberId[]
        const nScale = maxAbs(ids.map((id) => a.members[id]!.forceN))
        for (const id of ids) expect(Math.abs(b.members[id]!.forceN - a.members[id]!.forceN)).toBeLessThanOrEqual(1e-9 * nScale)
      }),
    )
  })
})
