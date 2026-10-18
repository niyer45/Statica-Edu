import { describe, expect, it } from 'vitest'
import { bracket, bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import type { BracketChallenge } from '../../challenge/bracket/types'
import { REL_TOL } from '../tolerance'
import { analyzeBracket } from './analyze'
import { bracketApplicabilityMetrics, checkBracketApplicability } from './applicability'
import { BRACKET_APPLICABILITY_CODES, BRACKET_THRESHOLDS } from './constants'
import type { BracketApplicabilityInput } from './types'

// Bracket applicability screens (task 55 L-bracket). Inclusive safe side: a metric equal to a
// threshold (within REL_TOL) produces no issue; one double past the tolerance edge does. Screens
// with no warning band can only be not applicable.

const ch = bracketChallenge()
type Ctx = Pick<BracketChallenge, 'material' | 'loadOffsetM'>
/** Unit context: σ_y = 1 Pa and a = 1 m, so the ratios equal the values passed in. */
const unit: Ctx = { material: { ...ch.material, yieldStressPa: 1 }, loadOffsetM: 1 }
/** Analysis inputs that trip nothing: gentle bend, zero stress and deflection, long lever arm. */
const quiet: BracketApplicabilityInput = { bendStressPa: 0, bendRadiusRatio: 10, deflectionM: 0, boltLeverArmM: 1e9 }
const design = bracket('d', 1, 1, 1, 1)

const codes = (r: ReturnType<typeof checkBracketApplicability>) => ({
  warnings: r.warnings.map((i) => i.code),
  notApplicable: r.notApplicable.map((i) => i.code),
})
const none = { warnings: [], notApplicable: [] }

describe('CURVED_BEAM_RANGE (1.2 / (R/c), not applicable above 1, no warning band)', () => {
  const at = (rc: number) => codes(checkBracketApplicability(design, { ...quiet, bendRadiusRatio: rc }, unit))
  it('is inclusive at R/c = 1.2 and not applicable just below', () => {
    expect(at(1.2)).toEqual(none)
    expect(at(1.2 / toleranceEdge(1, REL_TOL))).toEqual(none)
    expect(at(1.19)).toEqual({ warnings: [], notApplicable: ['CURVED_BEAM_RANGE'] })
    expect(at(10)).toEqual(none)
  })
})

describe('PLASTICITY (σ_bend/σ_y, warning 0.8, not applicable 1.0)', () => {
  const at = (s: number) => codes(checkBracketApplicability(design, { ...quiet, bendStressPa: s }, unit))
  it('is inclusive at 0.8 and 1.0', () => {
    expect(at(0.8)).toEqual(none)
    expect(at(toleranceEdge(0.8, REL_TOL))).toEqual(none)
    expect(at(nextUp(toleranceEdge(0.8, REL_TOL)))).toEqual({ warnings: ['PLASTICITY'], notApplicable: [] })
    expect(at(1)).toEqual({ warnings: ['PLASTICITY'], notApplicable: [] })
    expect(at(nextUp(toleranceEdge(1, REL_TOL)))).toEqual({ warnings: [], notApplicable: ['PLASTICITY'] })
  })
})

describe('LARGE_DEFLECTION (δ/a, warning 0.02, not applicable 0.1)', () => {
  const at = (v: number) => codes(checkBracketApplicability(design, { ...quiet, deflectionM: v }, unit))
  it('is inclusive at 0.02 and 0.1', () => {
    expect(at(0.02)).toEqual(none)
    expect(at(nextUp(toleranceEdge(0.02, REL_TOL)))).toEqual({ warnings: ['LARGE_DEFLECTION'], notApplicable: [] })
    expect(at(0.1)).toEqual({ warnings: ['LARGE_DEFLECTION'], notApplicable: [] })
    expect(at(nextUp(toleranceEdge(0.1, REL_TOL)))).toEqual({ warnings: [], notApplicable: ['LARGE_DEFLECTION'] })
  })
})

describe('LEG_SPAN (t/h_b, warning 0.2, not applicable 0.5)', () => {
  const at = (h: number) => codes(checkBracketApplicability(bracket('d', 1, 1, 1, 1), { ...quiet, boltLeverArmM: h }, unit))
  it('is inclusive at 0.2 and 0.5', () => {
    expect(at(5)).toEqual(none)
    expect(at(4.9)).toEqual({ warnings: ['LEG_SPAN'], notApplicable: [] })
    expect(at(2)).toEqual({ warnings: ['LEG_SPAN'], notApplicable: [] })
    expect(at(1.9)).toEqual({ warnings: [], notApplicable: ['LEG_SPAN'] })
  })
})

describe('checkBracketApplicability', () => {
  it('reports issues in code order, each at most once, with student-facing messages', () => {
    const r = checkBracketApplicability(bracket('d', 1, 1, 1, 1), { bendStressPa: 2, bendRadiusRatio: 1.1, deflectionM: 0.05, boltLeverArmM: 4 }, unit)
    expect(codes(r)).toEqual({ warnings: ['LARGE_DEFLECTION', 'LEG_SPAN'], notApplicable: ['CURVED_BEAM_RANGE', 'PLASTICITY'] })
    expect(r.notApplicable[1]).toEqual({
      code: 'PLASTICITY',
      message: 'Bend stress divided by yield stress is 2, above the model limit of 1. The model does not include plasticity, so its results cannot be trusted for this design.',
      value: 2,
      threshold: 1,
    })
    expect(r.warnings[1].message).toBe(
      'Thickness divided by bolt lever arm is 0.25, above the caution level of 0.2. The model does not include shear deformation of the short flange span, so treat these results with caution.',
    )
  })

  it('evaluates every metric from the stored analysis and the design', () => {
    const f = worksheetFixture('baseline')
    const a = analyzeBracket(f.design, ch)
    const m = bracketApplicabilityMetrics(f.design, a, ch)
    expect(Object.keys(m)).toEqual([...BRACKET_APPLICABILITY_CODES])
    expect(m.CURVED_BEAM_RANGE).toBeCloseTo(1.2 / a.bendRadiusRatio, 15)
    expect(m.LEG_SPAN).toBeCloseTo(f.design.thicknessM / a.boltLeverArmM, 15)
    for (const code of BRACKET_APPLICABILITY_CODES) expect(BRACKET_THRESHOLDS[code].effect.length).toBeGreaterThan(0)
  })
})
