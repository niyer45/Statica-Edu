// Feature: pressure-vessel-1, Property 4: Vessel scaling laws and monotonicity
// **Validates: task 69, PVS-02 (stress grows with radius and falls with thickness), design.md checks**
//
// Every stress is linear in p; volume, overall length and mass do not depend on p; mass is linear
// in ρ; stresses do not depend on ρ or L. Increasing D_i raises every stress, the volume, the
// overall length and the mass; increasing a wall lowers its stress and raises the mass;
// increasing L raises the volume, the overall length and the mass and leaves the stresses
// unchanged. These monotonic laws also underpin the D-47 bound in vesselBaselineDifficulty.test.ts.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbVesselDesign, relClose, vesselChallenge } from '../../../test/fixtures/vessel'
import { assertProperty } from '../../../test/pbt'
import type { VesselChallenge } from '../../challenge/vessel/types'
import type { VesselDesign } from '../../geometry/vessel/design'
import { analyzeVessel } from './analyze'

const ch = vesselChallenge()
const REL = 1e-12
const arbK = fc.double({ min: 0.25, max: 4, noNaN: true })
const STRESSES = ['hoopStressPa', 'longitudinalStressPa', 'headStressPa'] as const
const SIZE = ['volumeM3', 'overallLengthM', 'massKg'] as const

describe('Property 4: vessel scaling and monotonicity', () => {
  it('stresses are linear in p; size and mass are independent of p', () => {
    assertProperty(
      fc.property(arbVesselDesign(ch), arbK, (d, k) => {
        const a = analyzeVessel(d, ch)
        const b = analyzeVessel(d, { ...ch, pressurePa: ch.pressurePa * k })
        for (const s of STRESSES) expect(relClose(b[s], k * a[s], REL), s).toBe(true)
        for (const s of SIZE) expect(b[s], s).toBe(a[s])
      }),
    )
  })

  it('mass is linear in ρ; stresses and volume are independent of ρ', () => {
    assertProperty(
      fc.property(arbVesselDesign(ch), arbK, (d, k) => {
        const heavier: VesselChallenge = { ...ch, material: { ...ch.material, densityKgM3: ch.material.densityKgM3 * k } }
        const a = analyzeVessel(d, ch)
        const b = analyzeVessel(d, heavier)
        expect(relClose(b.massKg, k * a.massKg, REL)).toBe(true)
        for (const s of STRESSES) expect(b[s]).toBe(a[s])
        expect(b.volumeM3).toBe(a.volumeM3)
      }),
    )
  })

  const grow = (d: VesselDesign, param: keyof VesselDesign, k: number): VesselDesign => ({ ...d, [param]: (d[param] as number) * k })
  const arbUp = fc.double({ min: 1.001, max: 2, noNaN: true })

  it('a larger diameter raises every stress, the volume, the overall length and the mass', () => {
    assertProperty(
      fc.property(arbVesselDesign(ch), arbUp, (d, k) => {
        const a = analyzeVessel(d, ch)
        const b = analyzeVessel(grow(d, 'innerDiameterM', k), ch)
        for (const s of [...STRESSES, ...SIZE]) expect(b[s], s).toBeGreaterThan(a[s])
      }),
    )
  })

  it('a thicker wall lowers only its own stress and raises the mass', () => {
    assertProperty(
      fc.property(arbVesselDesign(ch), arbUp, (d, k) => {
        const a = analyzeVessel(d, ch)
        const s = analyzeVessel(grow(d, 'shellThicknessM', k), ch)
        expect(s.hoopStressPa).toBeLessThan(a.hoopStressPa)
        expect(s.longitudinalStressPa).toBeLessThan(a.longitudinalStressPa)
        expect(s.headStressPa).toBe(a.headStressPa)
        expect(s.volumeM3).toBe(a.volumeM3)
        expect(s.overallLengthM).toBe(a.overallLengthM)
        expect(s.massKg).toBeGreaterThan(a.massKg)
        const h = analyzeVessel(grow(d, 'headThicknessM', k), ch)
        expect(h.headStressPa).toBeLessThan(a.headStressPa)
        expect(h.hoopStressPa).toBe(a.hoopStressPa)
        expect(h.volumeM3).toBe(a.volumeM3)
        expect(h.overallLengthM).toBeGreaterThan(a.overallLengthM)
        expect(h.massKg).toBeGreaterThan(a.massKg)
      }),
    )
  })

  it('a longer shell raises the volume, the overall length and the mass, not the stresses', () => {
    assertProperty(
      fc.property(arbVesselDesign(ch), arbUp, (d, k) => {
        const a = analyzeVessel(d, ch)
        const b = analyzeVessel(grow(d, 'shellLengthM', k), ch)
        for (const s of SIZE) expect(b[s], s).toBeGreaterThan(a[s])
        for (const s of STRESSES) expect(b[s], s).toBe(a[s])
      }),
    )
  })
})
