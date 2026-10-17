// Feature: heat-sink-1, Property 5: The heat sink energy balance closes
// **Validates: HSK-13 (energy balance)**
//
// For every valid design and any positive heat load, coefficient and conductivity, the heat leaving
// the fins plus the exposed base, N η_f h A_f θ_b + h A_b θ_b, equals Q within 1e-12 relative,
// 1/R_conv equals the parallel network N η_f h A_f + h A_b, and R_total = R_base + R_conv.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbHeatSinkDesign, heatSinkChallenge, relClose } from '../../../test/fixtures/heatSink'
import { assertProperty } from '../../../test/pbt'
import type { HeatSinkChallenge } from '../../challenge/heatSink/types'
import { analyzeHeatSink } from './analyze'

const base = heatSinkChallenge()
const scale = fc.double({ min: 0.1, max: 10, noNaN: true })
const arbChallenge: fc.Arbitrary<HeatSinkChallenge> = fc.tuple(scale, scale, scale).map(([kq, kh, kk]) => ({
  ...base,
  heatLoadW: base.heatLoadW * kq,
  convection: { ...base.convection, coefficientWPerM2K: base.convection.coefficientWPerM2K * kh },
  material: { ...base.material, thermalConductivityWPerMK: base.material.thermalConductivityWPerMK * kk },
}))

describe('Property 5: energy balance', () => {
  it('fin plus base heat equals the heat load', () => {
    assertProperty(
      fc.property(arbHeatSinkDesign(base), arbChallenge, (d, ch) => {
        const a = analyzeHeatSink(d, ch)
        const h = ch.convection.coefficientWPerM2K
        const qFins = d.finCount * a.finEfficiency * h * a.finAreaM2 * a.finRootExcessK
        const qBase = h * a.exposedBaseAreaM2 * a.finRootExcessK
        expect(relClose(qFins + qBase, ch.heatLoadW, 1e-12)).toBe(true)
        expect(relClose(1 / a.convectionResistanceKPerW, d.finCount * a.finEfficiency * h * a.finAreaM2 + h * a.exposedBaseAreaM2, 1e-12)).toBe(true)
        expect(relClose(a.totalResistanceKPerW, a.baseResistanceKPerW + a.convectionResistanceKPerW, 1e-12)).toBe(true)
        expect(relClose(a.finHeatShare, qFins / ch.heatLoadW, 1e-12)).toBe(true)
      }),
    )
  })
})
