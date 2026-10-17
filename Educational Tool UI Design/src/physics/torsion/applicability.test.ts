import { describe, expect, it } from 'vitest'
import { shaft, solid, torsionChallenge, tube, worksheetFixture } from '../../../test/fixtures/torsion'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import type { TorsionChallenge } from '../../challenge/torsion/types'
import { REL_TOL, withinLimit } from '../tolerance'
import { analyzeShaft } from './analyze'
import { checkTorsionApplicability, torsionApplicabilityMetrics } from './applicability'
import { TORSION_APPLICABILITY_CODES, TORSION_THRESHOLDS } from './constants'

// Torsion applicability screens (task 47.2; TSH-10). Inclusive safe side: a metric equal to a
// threshold (within REL_TOL) produces no issue; the first double past the tolerance edge does.

const ch = torsionChallenge()
/** A material whose yield shear stress is 1 Pa, so τ/τ_y equals the τ passed in, exactly. */
const unitYield: Pick<TorsionChallenge, 'material'> = { material: { ...ch.material, yieldShearStressPa: 1 } }
const anySolid = shaft('s', solid(0.03))

const codes = (r: ReturnType<typeof checkTorsionApplicability>) => ({
  warnings: r.warnings.map((i) => i.code),
  notApplicable: r.notApplicable.map((i) => i.code),
})

describe('PLASTICITY_SHEAR (τ_max / τ_yield, warning 0.8, not applicable 1.0)', () => {
  const at = (ratio: number) => codes(checkTorsionApplicability(anySolid, { maxShearStressPa: ratio }, unitYield))

  it('raises nothing at or below 0.8, including the tolerance edge', () => {
    expect(at(0.5)).toEqual({ warnings: [], notApplicable: [] })
    expect(at(0.8)).toEqual({ warnings: [], notApplicable: [] })
    const edge = toleranceEdge(0.8, REL_TOL)
    expect(withinLimit(edge, 0.8)).toBe(true)
    expect(at(edge)).toEqual({ warnings: [], notApplicable: [] })
    expect(at(nextUp(edge))).toEqual({ warnings: ['PLASTICITY_SHEAR'], notApplicable: [] })
  })

  it('warns up to and including 1.0, then is not applicable', () => {
    expect(at(1.0)).toEqual({ warnings: ['PLASTICITY_SHEAR'], notApplicable: [] })
    const edge = toleranceEdge(1.0, REL_TOL)
    expect(at(edge)).toEqual({ warnings: ['PLASTICITY_SHEAR'], notApplicable: [] })
    expect(at(nextUp(edge))).toEqual({ warnings: [], notApplicable: ['PLASTICITY_SHEAR'] })
    expect(at(14)).toEqual({ warnings: [], notApplicable: ['PLASTICITY_SHEAR'] })
  })

  it('is inclusive through analyzeShaft with a configured yield stress', () => {
    const tau = analyzeShaft(anySolid, ch).maxShearStressPa
    const withYield = (y: number): TorsionChallenge => ({ ...ch, material: { ...ch.material, yieldShearStressPa: y } })
    const run = (y: number) => {
      const a = analyzeShaft(anySolid, withYield(y))
      return { applicable: a.applicable, ...codes({ warnings: [...a.warnings], notApplicable: [...a.notApplicableReasons] }) }
    }
    expect(run(tau / 0.8)).toEqual({ applicable: true, warnings: [], notApplicable: [] })
    expect(run(tau / 0.8 / (1 + 4 * REL_TOL))).toEqual({ applicable: true, warnings: ['PLASTICITY_SHEAR'], notApplicable: [] })
    expect(run(tau)).toEqual({ applicable: true, warnings: ['PLASTICITY_SHEAR'], notApplicable: [] })
    expect(run(tau / (1 + 4 * REL_TOL))).toEqual({ applicable: false, warnings: [], notApplicable: ['PLASTICITY_SHEAR'] })
  })

  it('writes student-facing messages naming the effect and threshold', () => {
    const w = checkTorsionApplicability(anySolid, { maxShearStressPa: 0.899170547454349 }, unitYield).warnings[0]
    expect(w).toEqual({
      code: 'PLASTICITY_SHEAR',
      message:
        'Maximum shear stress divided by yield shear stress is 0.899, above the caution level of 0.8. ' +
        'The model does not include plasticity, so treat these results with caution.',
      value: 0.899170547454349,
      threshold: 0.8,
    })
    const n = checkTorsionApplicability(anySolid, { maxShearStressPa: 14.05 }, unitYield).notApplicable[0]
    expect(n.message).toBe(
      'Maximum shear stress divided by yield shear stress is 14.1, above the model limit of 1. ' +
        'The model does not include plasticity, so its results cannot be trusted for this design.',
    )
    expect(n.threshold).toBe(1)
  })
})

describe('TUBE_SLENDERNESS (D / t, tubes only, warning 40, not applicable 100)', () => {
  // D − 2 is exact in the same binade, so (D − d)/2 = 1 and D/t = D exactly.
  const at = (D: number) => codes(checkTorsionApplicability(shaft('t', tube(D, D - 2)), { maxShearStressPa: 0 }, ch))

  it('is not evaluated for solid shafts', () => {
    expect(torsionApplicabilityMetrics(anySolid, { maxShearStressPa: 0 }, ch)).toEqual({ PLASTICITY_SHEAR: 0 })
  })

  it('reports D/t for tubes (configured ranges cap it at 30)', () => {
    const f = worksheetFixture('oversizeTube')
    expect(torsionApplicabilityMetrics(f.design, { maxShearStressPa: 0 }, ch).TUBE_SLENDERNESS).toBeCloseTo(30, 9)
  })

  it('is inclusive at 40 and 100 and triggers one double past the tolerance edge', () => {
    expect(at(40)).toEqual({ warnings: [], notApplicable: [] })
    expect(at(toleranceEdge(40, REL_TOL))).toEqual({ warnings: [], notApplicable: [] })
    expect(at(nextUp(toleranceEdge(40, REL_TOL)))).toEqual({ warnings: ['TUBE_SLENDERNESS'], notApplicable: [] })
    expect(at(100)).toEqual({ warnings: ['TUBE_SLENDERNESS'], notApplicable: [] })
    expect(at(toleranceEdge(100, REL_TOL))).toEqual({ warnings: ['TUBE_SLENDERNESS'], notApplicable: [] })
    expect(at(nextUp(toleranceEdge(100, REL_TOL)))).toEqual({ warnings: [], notApplicable: ['TUBE_SLENDERNESS'] })
  })

  it('names torsional buckling of thin tubes', () => {
    const [w] = checkTorsionApplicability(shaft('t', tube(50, 48)), { maxShearStressPa: 0 }, ch).warnings
    expect(w.message).toBe(
      'Tube diameter divided by wall thickness is 50, above the caution level of 40. ' +
        'The model does not include torsional buckling of thin tubes, so treat these results with caution.',
    )
  })
})

describe('issue ordering', () => {
  it('follows TORSION_APPLICABILITY_CODES and lists each code at most once', () => {
    const r = checkTorsionApplicability(shaft('t', tube(150, 148)), { maxShearStressPa: 2 }, unitYield)
    expect(r.notApplicable.map((i) => i.code)).toEqual([...TORSION_APPLICABILITY_CODES])
    expect(r.warnings).toEqual([])
    expect(r.notApplicable.map((i) => i.threshold)).toEqual(TORSION_APPLICABILITY_CODES.map((c) => TORSION_THRESHOLDS[c].notApplicable))
  })
})
