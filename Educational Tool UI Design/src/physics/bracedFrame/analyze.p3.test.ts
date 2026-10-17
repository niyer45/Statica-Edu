// Feature: braced-frame-1, Property 3: A frame is a mechanism iff a storey is unbraced
// **Validates: BFR-04, BFR-06, BFR-11, MM-10**
//
// For any of the 16 diagonal sets with any sections, the numerically detected status is
// 'mechanism' exactly when some storey has no diagonal (the topology rule is the test oracle
// only; the model has no topology shortcut). A mechanism analysis is deep-frozen, not applicable
// with the single MECHANISM reason, and carries no numeric keys besides mass, the unbraced-storey
// list and the reason's value/threshold. A solved analysis is applicable or screened, finite and
// deterministic.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbBracedFrameDesign, bracedFrameChallenge, hasUnbracedStorey } from '../../../test/fixtures/bracedFrame'
import { assertProperty } from '../../../test/pbt'
import { analyzeBracedFrame } from './analyze'

const ch = bracedFrameChallenge()
const MECHANISM_KEYS = ['modelId', 'modelVersion', 'applicable', 'warnings', 'notApplicableReasons', 'unsupportedEffects', 'assumptions', 'massKg', 'unbracedStoreys', 'status'].sort()

describe('Property 3: mechanism iff a storey is unbraced', () => {
  it('holds for every diagonal set and section choice', () => {
    assertProperty(
      fc.property(arbBracedFrameDesign(), (d) => {
        const a = analyzeBracedFrame(d, ch)
        expect(a.status).toBe(hasUnbracedStorey(d) ? 'mechanism' : 'solved')
        expect(Object.isFrozen(a)).toBe(true)
        expect(analyzeBracedFrame(d, ch)).toEqual(a)
        expect(Number.isFinite(a.massKg) && a.massKg > 0).toBe(true)
        if (a.status === 'mechanism') {
          expect(Object.keys(a).sort()).toEqual(MECHANISM_KEYS)
          expect(a.applicable).toBe(false)
          expect(a.notApplicableReasons.map((i) => i.code)).toEqual(['MECHANISM'])
          expect(a.unbracedStoreys.length).toBeGreaterThan(0)
          expect(a.notApplicableReasons[0].value).toBe(a.unbracedStoreys.length)
        } else {
          expect(a.unbracedStoreys).toEqual([])
          expect(a.applicable).toBe(a.notApplicableReasons.length === 0)
          expect(a.notApplicableReasons.map((i) => i.code)).not.toContain('MECHANISM')
          const numbers: number[] = []
          JSON.stringify(a, (_k, v: unknown) => (typeof v === 'number' && numbers.push(v), v))
          expect(numbers.every(Number.isFinite)).toBe(true)
        }
      }),
    )
  })
})
