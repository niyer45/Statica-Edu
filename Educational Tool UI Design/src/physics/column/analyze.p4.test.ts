// Feature: column-buckling-1, Property 4: Material away from the axis buys buckling resistance
// **Validates: task 68, CBK-02**
//
// For any tube in range: a larger outer diameter at the same wall raises the critical load faster
// than the mass (P_cr per kilogram rises); a thicker wall at the same outer diameter raises both
// but lowers P_cr per kilogram; and the tube beats the solid bar of equal area (equal mass) on the
// critical load, whenever that bar exists.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { column, columnChallenge, solid, tube } from '../../../test/fixtures/column'
import { assertProperty } from '../../../test/pbt'
import { analyzeColumn } from './analyze'

const ch = columnChallenge()
const L = ch.sectionLimits.tube
const between = (min: number, max: number) => fc.double({ min, max, noNaN: true })

describe('Property 4: geometry levers', () => {
  it('outer diameter beats wall thickness per kilogram, and a tube beats an equal-mass solid bar', () => {
    assertProperty(
      fc.property(
        between(L.outerDiameterM.minM, L.outerDiameterM.maxM - 0.001),
        between(L.wallThicknessM.minM, L.wallThicknessM.maxM - 0.0005),
        between(0.0005, 0.02),
        between(0.0001, 0.002),
        (D, t, dD, dt) => {
          const base = analyzeColumn(column('a', tube(D, t)), ch)
          const wider = analyzeColumn(column('b', tube(Math.min(D + dD, L.outerDiameterM.maxM), t)), ch)
          const thicker = analyzeColumn(column('c', tube(D, Math.min(t + dt, L.wallThicknessM.maxM))), ch)
          expect(wider.criticalLoadN).toBeGreaterThan(base.criticalLoadN)
          expect(wider.criticalLoadPerMassNPerKg).toBeGreaterThan(base.criticalLoadPerMassNPerKg)
          expect(thicker.criticalLoadN).toBeGreaterThan(base.criticalLoadN)
          expect(thicker.criticalLoadPerMassNPerKg).toBeLessThan(base.criticalLoadPerMassNPerKg)
          // Equal-area solid bar: d = √(4A/π).
          const d = Math.sqrt((4 * base.areaM2) / Math.PI)
          const r = ch.sectionLimits.solid.diameterM
          if (d >= r.minM && d <= r.maxM) {
            const bar = analyzeColumn(column('s', solid(d)), ch)
            expect(Math.abs(bar.massKg / base.massKg - 1)).toBeLessThan(1e-12)
            expect(base.criticalLoadN).toBeGreaterThan(bar.criticalLoadN)
          }
        },
      ),
    )
  })
})
