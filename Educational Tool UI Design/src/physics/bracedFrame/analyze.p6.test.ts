// Feature: braced-frame-1, Property 6: Determinate frames carry the method-of-joints forces
// **Validates: BFR-02, BFR-10, BFR-15**
//
// For any of the four single-diagonal topologies, any sections and any joint loads, the stiffness
// member forces and reactions equal the hand method-of-joints values (test/bracedFrameStatics.ts)
// within 1e-9 × max|N|, so they do not depend on the section choice.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { determinateTopology, methodOfJoints, type FreeLoads } from '../../../test/bracedFrameStatics'
import { bracedFrameChallenge, frameDesign, type SectionShorthand } from '../../../test/fixtures/bracedFrame'
import { assertProperty } from '../../../test/pbt'
import type { FrameMemberId } from '../../geometry/bracedFrame/template'
import { analyzeBracedFrame } from './analyze'

const ch = bracedFrameChallenge()
const arbSize = fc.constantFrom<SectionShorthand>(48, 60, 76, 89)
const arbLoad = fc.double({ min: -1e5, max: 1e5, noNaN: true })
const arbPair = fc.tuple(arbLoad, arbLoad)
const arbTopology = fc.constantFrom(['diag1a', 'diag2a'], ['diag1b', 'diag2b'], ['diag1a', 'diag2b'], ['diag1b', 'diag2a'])

describe('Property 6: determinate statics', () => {
  it('stiffness forces equal method-of-joints forces for any sections and loads', () => {
    assertProperty(
      fc.property(
        fc.tuple(arbSize, arbSize, arbSize, arbSize, arbSize, arbSize),
        arbSize,
        arbSize,
        arbTopology,
        fc.tuple(arbPair, arbPair, arbPair, arbPair),
        (fixed, s1, s2, [lower, upper], [p3, p4, p5, p6]) => {
          const loads: FreeLoads = { j3: p3, j4: p4, j5: p5, j6: p6 }
          fc.pre([p3, p4, p5, p6].some(([x, y]) => Math.abs(x) + Math.abs(y) > 1))
          const d = frameDesign('d', fixed, { [lower]: s1, [upper]: s2 })
          const c = { ...ch, loads: (Object.entries(loads) as ['j3' | 'j4' | 'j5' | 'j6', readonly [number, number]][]).map(([jointId, [fxN, fyN]]) => ({ jointId, fxN, fyN })) }
          const a = analyzeBracedFrame(d, c)
          if (a.status !== 'solved') throw new Error('determinate topology did not solve')
          const statics = methodOfJoints(determinateTopology(d)!, loads)
          const scale = Math.max(...Object.values(statics.forces).map((v) => Math.abs(v!)), 1e-300)
          for (const [id, N] of Object.entries(statics.forces) as [FrameMemberId, number][]) {
            expect(Math.abs(a.members[id]!.forceN - N), id).toBeLessThanOrEqual(1e-9 * scale)
          }
          const r = a.reactionsN
          ;[r.j1.x, r.j1.y, r.j2.x, r.j2.y].forEach((v, i) => expect(Math.abs(v - statics.reactions[i])).toBeLessThanOrEqual(1e-9 * scale))
        },
      ),
    )
  })
})
