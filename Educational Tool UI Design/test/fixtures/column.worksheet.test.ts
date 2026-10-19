import { describe, expect, it } from 'vitest'
import { evaluateColumn } from '../../src/evaluation/column/evaluate'
import { validateColumnDesign } from '../../src/geometry/column/validate'
import { analyzeColumn } from '../../src/physics/column/analyze'
import { COLUMN_REQUIRED_I_M4, COLUMN_TRANSITION_SLENDERNESS, COLUMN_WORKSHEET, COLUMN_WORKSHEET_REL_TOL, columnChallenge, worksheetRow } from './column'

// Column Buckling I worksheet (task 68; CBK-17): every row of design.md, reproduced by the
// application at 1e-9 relative, with its status, failures and screen codes.

const ch = columnChallenge()
const close = (actual: number, expected: number, label: string) =>
  expect(Math.abs(actual / expected - 1), `${label}: ${actual} vs ${expected}`).toBeLessThanOrEqual(COLUMN_WORKSHEET_REL_TOL)

describe('Column Buckling I worksheet', () => {
  it.each(COLUMN_WORKSHEET.map((f) => [f.name, f] as const))('%s', (_name, f) => {
    expect(validateColumnDesign(f.design, ch)).toEqual([])
    const a = analyzeColumn(f.design, ch)
    const e = evaluateColumn(f.design, a, ch)
    const x = f.expected
    close(a.areaM2, x.areaM2, 'A')
    close(a.secondMomentM4, x.secondMomentM4, 'I')
    close(a.radiusOfGyrationM, x.radiusOfGyrationM, 'r')
    close(a.slenderness, x.slenderness, 'λ')
    close(a.criticalLoadN, x.criticalLoadN, 'P_cr')
    close(a.bucklingSafetyFactor, x.bucklingSafetyFactor, 'n')
    close(a.eulerStressPa, x.eulerStressPa, 'σ_E')
    close(a.eulerStressPa / ch.material.yieldStressPa, x.eulerRatio, 'σ_E/σ_y')
    close(a.axialStressPa, x.axialStressPa, 'σ')
    close(a.massKg, x.massKg, 'm')
    close(a.criticalLoadPerMassNPerKg, x.criticalLoadPerMassNPerKg, 'P_cr/m')
    close(a.diameterToWall, x.diameterToWall, 'D/t')
    close(a.transitionSlenderness, COLUMN_TRANSITION_SLENDERNESS, 'λ_c')
    expect(e.status).toBe(x.status)
    expect(e.failures).toEqual(x.failures)
    expect(a.warnings.map((w) => w.code)).toEqual(x.warningCodes)
    expect(a.notApplicableReasons.map((w) => w.code)).toEqual(x.notApplicableCodes)
  })

  it('the bundled baseline and reference are the worksheet rows', () => {
    expect(ch.initialDesign.section).toEqual(worksheetRow('baseline').design.section)
    expect(ch.referenceDesign!.section).toEqual(worksheetRow('reference').design.section)
  })

  it('derived targets: required I, the solid bar that just passes, and the equal-mass comparison', () => {
    const required = (ch.constraints.minBucklingSafetyFactor * ch.load.forceN) / ch.load.forceN
    expect(required).toBe(2)
    // A solid bar needs at least 39.33 mm (6.56 kg, 2.6× the mass limit): no solid bar passes.
    const dReq = Math.pow((64 * COLUMN_REQUIRED_I_M4) / Math.PI, 0.25)
    expect(dReq).toBeCloseTo(0.039331708611734476, 12)
    expect(worksheetRow('solid40').expected.failures).toEqual(['mass'])
    // Equal mass (same area), 5.6× the critical load.
    const s = worksheetRow('solid30').expected
    const t = worksheetRow('tubeEqualMass').expected
    close(t.massKg, s.massKg, 'equal mass')
    close(t.criticalLoadN / s.criticalLoadN, 5.600555555555556, 'tube / solid P_cr')
    // Prediction fixture: Baseline → reference is an increase by ×8.6747.
    close(worksheetRow('reference').expected.criticalLoadN / worksheetRow('baseline').expected.criticalLoadN, 8.674725111933615, 'prediction ratio')
  })
})
