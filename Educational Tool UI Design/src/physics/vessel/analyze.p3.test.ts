// Feature: pressure-vessel-1, Property 3: Valid vessels analyze to finite, positive, deterministic results
// **Validates: task 69, PVS-02, MM-10**
//
// For every valid design, analyzeVessel returns a deep-frozen analysis naming
// thinWallPressureVessel v1 in which every numeric field is finite and > 0 and identical on
// repeated calls; `applicable` is true iff there are no not-applicable reasons and each code is
// listed at most once; the hoop stress is exactly twice the longitudinal stress; the mass is the
// sum of shell and heads; the head stress equals the hoop stress scaled by t_s / (2 t_h).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbVesselDesign, relClose, vesselChallenge } from '../../../test/fixtures/vessel'
import { assertProperty } from '../../../test/pbt'
import { analyzeVessel } from './analyze'

const ch = vesselChallenge()

describe('Property 3: finite, positive, deterministic analysis', () => {
  it('holds for every valid design', () => {
    assertProperty(
      fc.property(arbVesselDesign(ch), (d) => {
        const a = analyzeVessel(d, ch)
        expect(a.modelId).toBe('thinWallPressureVessel')
        expect(a.modelVersion).toBe(1)
        for (const [k, v] of Object.entries(a)) {
          expect(v, k).not.toBeUndefined()
          if (typeof v === 'number') expect(Number.isFinite(v) && v > 0, k).toBe(true)
        }
        expect(Object.isFrozen(a)).toBe(true)
        expect(analyzeVessel(d, ch)).toEqual(a)
        expect(a.applicable).toBe(a.notApplicableReasons.length === 0)
        const codes = [...a.warnings, ...a.notApplicableReasons].map((i) => i.code)
        expect(new Set(codes).size).toBe(codes.length)
        expect(relClose(a.hoopStressPa, 2 * a.longitudinalStressPa, 1e-15)).toBe(true)
        expect(a.massKg).toBe(a.shellMassKg + a.headsMassKg)
        expect(relClose(a.headStressPa, (a.hoopStressPa * d.shellThicknessM) / (2 * d.headThicknessM), 1e-12)).toBe(true)
      }),
    )
  })
})
