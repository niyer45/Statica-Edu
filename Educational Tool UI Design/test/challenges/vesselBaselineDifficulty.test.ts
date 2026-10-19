import { describe, expect, it } from 'vitest'
import { gridValues, vessel, vesselChallenge, VESSEL_DERIVED } from '../fixtures/vessel'
import { vesselModel } from '../../src/state/vesselModel'
import type { VesselDesign } from '../../src/geometry/vessel/design'
import type { VesselConstraintId } from '../../src/evaluation/vessel/types'

// Pressure Vessel I baseline difficulty (task 69; PVS-14, D-47). Same rule as
// baselineDifficulty.test.ts: the baseline fails the most design checks (applicability excluded)
// that any valid, in-range design fails while applicable without warnings, and the reference
// stays Accepted. The configured step grid has 1,820,289 designs; the standalone worksheet
// searches it exhaustively (design.md: maximum 4, 514 Accepted). Here the same bound is proved
// through the registered model with a monotonicity argument, and cross-checked by a model search
// of a sub-grid.

const ch = vesselChallenge()
const L = ch.designLimits

function summary(d: VesselDesign) {
  const a = vesselModel.analyze(d, ch)
  const e = vesselModel.evaluate(d, a, ch)
  return { applicable: a.applicable, warnings: a.warnings.length, failed: e.failures.filter((f) => f !== 'applicability'), status: e.status }
}

describe('Pressure Vessel I baseline difficulty', () => {
  it('fails hoop stress, head stress, volume and overall length, applicable and without warnings', () => {
    expect(summary(ch.initialDesign)).toEqual({ applicable: true, warnings: 0, failed: ['hoopStress', 'headStress', 'volume', 'overallLength'], status: 'notAccepted' })
    expect(summary(ch.initialDesign).failed).toHaveLength(VESSEL_DERIVED.gridMaxFailed)
  })

  it('keeps the reference Accepted', () => {
    expect(summary(ch.referenceDesign!)).toEqual({ applicable: true, warnings: 0, failed: [], status: 'accepted' })
  })

  it('the longitudinal stress never fails on a warning-free design (it would need the hoop stress past yield)', () => {
    for (const D of gridValues(L.innerDiameterM)) {
      for (const ts of gridValues(L.shellThicknessM)) {
        const s = summary(vessel('l', D, 0.5, ts, 0.004))
        if (s.failed.includes('longitudinalStress')) expect(s.applicable).toBe(false)
      }
    }
   }, 30_000)

  it('no design on the grid fails all five other checks: the heaviest design failing hoop, head and volume still passes mass', () => {
    // Hoop, head and volume each fail only below a threshold of t_s, t_h and L for a given D, and
    // the mass grows with each of them (Property 4), so the heaviest design failing all three
    // takes the largest failing grid value of each. If it passes the mass limit, no design with
    // that diameter fails hoop, head, volume and mass together, whatever its warnings.
    const fails = (d: VesselDesign, id: Exclude<VesselConstraintId, 'applicability'>) => summary(d).failed.includes(id)
    for (const D of gridValues(L.innerDiameterM)) {
      const ts = gridValues(L.shellThicknessM).filter((t) => fails(vessel('t', D, 0.5, t, 0.012), 'hoopStress')).at(-1)
      const th = gridValues(L.headThicknessM).filter((t) => fails(vessel('h', D, 0.5, 0.012, t), 'headStress')).at(-1)
      const len = gridValues(L.shellLengthM).filter((x) => fails(vessel('v', D, x, 0.012, 0.012), 'volume')).at(-1)
      if (ts === undefined || th === undefined || len === undefined) continue
      expect(fails(vessel('worst', D, len, ts, th), 'mass'), `D ${D}`).toBe(false)
    }
   }, 30_000)

  it('a model search of a sub-grid finds no warning-free design failing more than the baseline', () => {
    let max = 0
    let searched = 0
    const sets = new Set<string>()
    const every = (xs: number[], n: number) => xs.filter((_, i) => i % n === 0 || i === xs.length - 1)
    for (const D of every(gridValues(L.innerDiameterM), 3))
      for (const len of every(gridValues(L.shellLengthM), 10))
        for (const ts of every(gridValues(L.shellThicknessM), 2))
          for (const th of every(gridValues(L.headThicknessM), 2)) {
            const s = summary(vessel('g', D, len, ts, th))
            searched++
            if (!s.applicable || s.warnings > 0) continue
            max = Math.max(max, s.failed.length)
            if (s.failed.length === VESSEL_DERIVED.gridMaxFailed) sets.add(s.failed.join(','))
          }
    expect(searched).toBeGreaterThan(15_000)
    expect(max).toBe(VESSEL_DERIVED.gridMaxFailed)
    expect(sets).toContain('hoopStress,headStress,volume,overallLength')
  }, 30_000)
})
