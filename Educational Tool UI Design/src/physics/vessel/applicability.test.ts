import { describe, expect, it } from 'vitest'
import { vessel, vesselChallenge } from '../../../test/fixtures/vessel'
import { checkVesselApplicability, vesselApplicabilityMetrics } from './applicability'
import { VESSEL_APPLICABILITY_CODES, VESSEL_THRESHOLDS } from './constants'

// Pressure vessel applicability screens (task 69; PVS-10): thin-wall rule r/t ≥ 10 (caution
// below 20) for the shell and the heads, plasticity at 0.8 / 1.0 of yield. Inclusive on the safe
// side.

const ch = vesselChallenge()
const r = 0.2
const d = (ts: number, th: number) => vessel('a', 2 * r, 0.5, ts, th)
/** A stress input at a given fraction of yield for both hoop and head. */
const stresses = (k: number) => ({ innerRadiusM: r, hoopStressPa: k * ch.material.yieldStressPa, headStressPa: 0 })

describe('vessel applicability', () => {
  it('has the documented thresholds in a fixed order', () => {
    expect(VESSEL_APPLICABILITY_CODES).toEqual(['THIN_WALL_SHELL', 'THIN_WALL_HEAD', 'PLASTICITY'])
    expect(VESSEL_THRESHOLDS.THIN_WALL_SHELL).toMatchObject({ warning: 0.05, notApplicable: 0.1 })
    expect(VESSEL_THRESHOLDS.THIN_WALL_HEAD).toMatchObject({ warning: 0.05, notApplicable: 0.1 })
    expect(VESSEL_THRESHOLDS.PLASTICITY).toMatchObject({ warning: 0.8, notApplicable: 1 })
  })

  it('computes t/r for each wall and the larger membrane stress over yield', () => {
    const m = vesselApplicabilityMetrics(d(0.004, 0.002), { innerRadiusM: r, hoopStressPa: 100e6, headStressPa: 150e6 }, ch)
    expect(m.THIN_WALL_SHELL).toBeCloseTo(0.02, 15)
    expect(m.THIN_WALL_HEAD).toBeCloseTo(0.01, 15)
    expect(m.PLASTICITY).toBeCloseTo(0.6, 15)
  })

  it('is silent exactly at each threshold and fires just beyond it (inclusive)', () => {
    expect(checkVesselApplicability(d(0.05 * r, 0.05 * r), stresses(0.8), ch)).toEqual({ warnings: [], notApplicable: [] })
    const warn = checkVesselApplicability(d(0.0101, 0.0101), stresses(0.81), ch)
    expect(warn.warnings.map((i) => i.code)).toEqual(['THIN_WALL_SHELL', 'THIN_WALL_HEAD', 'PLASTICITY'])
    expect(warn.notApplicable).toEqual([])
    const atNa = checkVesselApplicability(d(0.1 * r, 0.1 * r), stresses(1), ch)
    expect(atNa.notApplicable).toEqual([])
    expect(atNa.warnings).toHaveLength(3)
    const na = checkVesselApplicability(d(0.0201, 0.0201), stresses(1.01), ch)
    expect(na.notApplicable.map((i) => i.code)).toEqual(['THIN_WALL_SHELL', 'THIN_WALL_HEAD', 'PLASTICITY'])
    expect(na.warnings).toEqual([])
  })

  it('writes a clear message naming the thin-wall rule and the value against the limit', () => {
    const na = checkVesselApplicability(d(0.024, 0.002), stresses(0.1), ch).notApplicable[0]!
    expect(na).toMatchObject({ code: 'THIN_WALL_SHELL', value: 0.12, threshold: 0.1 })
    expect(na.message).toBe(
      'Shell thickness divided by inner radius is 0.12, above the model limit of 0.1. The model does not include through-thickness stress variation in a thick shell wall (the thin-wall rule needs r/t of at least 10), so its results cannot be trusted for this design.',
    )
    const warn = checkVesselApplicability(d(0.004, 0.002), stresses(0.9), ch).warnings[0]!
    expect(warn.message).toBe('Largest membrane stress divided by yield stress is 0.9, above the caution level of 0.8. The model does not include plasticity, so treat these results with caution.')
  })
})
