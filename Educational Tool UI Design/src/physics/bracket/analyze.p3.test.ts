// Feature: mounting-bracket-1, Property 3: Valid brackets analyze to finite, positive, deterministic results
// **Validates: task 55 L-bracket, MM-10**
//
// For every valid design, analyzeBracket returns a deep-frozen analysis naming boltedLBracket v1
// in which every numeric field is finite and > 0 and identical on repeated calls; `applicable` is
// true iff there are no not-applicable reasons, each code is listed at most once; the curved-beam
// factor is above one (the inner fibre carries more than the straight-beam stress); the
// deflection is the sum of its two parts; and the bolt tension times the bolt count times the
// lever arm returns the bend moment (moments about the heel).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbBracketDesign, bracketChallenge, relClose } from '../../../test/fixtures/bracket'
import { assertProperty } from '../../../test/pbt'
import { analyzeBracket } from './analyze'

const ch = bracketChallenge()

describe('Property 3: finite, positive, deterministic analysis', () => {
  it('holds for every valid design', () => {
    assertProperty(
      fc.property(arbBracketDesign(ch), (d) => {
        const a = analyzeBracket(d, ch)
        expect(a.modelId).toBe('boltedLBracket')
        expect(a.modelVersion).toBe(1)
        for (const [k, v] of Object.entries(a)) {
          expect(v, k).not.toBeUndefined()
          if (typeof v === 'number') expect(Number.isFinite(v) && v > 0, k).toBe(true)
        }
        expect(Object.isFrozen(a)).toBe(true)
        expect(analyzeBracket(d, ch)).toEqual(a)
        expect(a.applicable).toBe(a.notApplicableReasons.length === 0)
        const all = [...a.warnings, ...a.notApplicableReasons].map((i) => i.code)
        expect(new Set(all).size).toBe(all.length)
        expect(a.curvedBeamFactor).toBeGreaterThan(1)
        expect(a.deflectionM).toBe(a.armDeflectionM + a.flangeRotationDeflectionM)
        expect(relClose(a.boltTensionN * ch.bolts.count * a.boltLeverArmM, a.bendMomentNm, 1e-12)).toBe(true)
        // Within the configured ranges the curved-beam formula stays inside its tabulated range.
        expect(all).not.toContain('CURVED_BEAM_RANGE')
      }),
    )
  })
})
