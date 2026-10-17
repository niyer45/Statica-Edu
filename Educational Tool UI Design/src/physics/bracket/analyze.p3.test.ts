// Feature: mounting-bracket-1, Property 3: Valid brackets analyze to finite, positive, deterministic results with absent (never NaN) undefined quantities
// **Validates: MBR-11–MBR-13, MBR-17, MM-10**
//
// For every valid design, analyzeBracket returns a deep-frozen analysis naming steppedBarBracket v1
// in which every present numeric field is finite and > 0 and identical on repeated calls;
// `applicable` is true iff there are no not-applicable reasons, each code is listed at most once;
// σ_peak = max(σ_root, σ_step) with the location `step` iff σ_step > σ_root; peak, Kt, step peak and
// location are all present or all absent, and absent exactly when the step's Kt fit is undefined
// (then not applicable via KT_FIT_*); uniform bars carry no step keys at all.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbBracketDesign, bracketChallenge, relClose } from '../../../test/fixtures/bracket'
import { assertProperty } from '../../../test/pbt'
import { isUniformBar } from '../../geometry/bracket/design'
import { analyzeBracket } from './analyze'

const ch = bracketChallenge()
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

describe('Property 3: finite, positive, deterministic analysis', () => {
  it('holds for every valid design', () => {
    assertProperty(
      fc.property(arbBracketDesign(ch), (d) => {
        const a = analyzeBracket(d, ch)
        expect(a.modelId).toBe('steppedBarBracket')
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

        const kt = ['ktBranch', 'ktStep', 'stepPeakStressPa'].map((k) => has(a, k))
        if (isUniformBar(d)) {
          for (const k of ['stepMomentNm', 'stepNominalStressPa', 'heightToRadiusRatio', 'stepRatio', 'ktBranch', 'ktStep', 'stepPeakStressPa']) expect(has(a, k), k).toBe(false)
          expect(a.peakStressPa).toBe(a.rootStressPa)
          expect(a.peakLocation).toBe('root')
        } else if (a.status === 'ktFitUndefined') {
          expect(kt).toEqual([false, false, false])
          expect(has(a, 'peakStressPa') || has(a, 'peakLocation')).toBe(false)
          expect(a.applicable).toBe(false)
          expect(a.notApplicableReasons.some((i) => i.code === 'KT_FIT_SHARP' || i.code === 'KT_FIT_SHALLOW')).toBe(true)
        } else {
          expect(kt).toEqual([true, true, true])
          const step = a.stepPeakStressPa as number
          expect(a.peakStressPa).toBe(Math.max(step, a.rootStressPa))
          expect(a.peakLocation).toBe(step > a.rootStressPa ? 'step' : 'root')
          expect(relClose(step, (a.ktStep as number) * (a.stepNominalStressPa as number), 1e-15)).toBe(true)
          expect(a.notApplicableReasons.some((i) => i.code === 'KT_FIT_SHARP' || i.code === 'KT_FIT_SHALLOW')).toBe(false)
        }
      }),
    )
  })
})
