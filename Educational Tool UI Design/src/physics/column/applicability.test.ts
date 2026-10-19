import { describe, expect, it } from 'vitest'
import { columnChallenge } from '../../../test/fixtures/column'
import { REL_TOL } from '../tolerance'
import { checkColumnApplicability, columnApplicabilityMetrics } from './applicability'
import { COLUMN_APPLICABILITY_CODES, COLUMN_THRESHOLDS } from './constants'

// Column applicability screens (task 68; CBK-11, CBK-12): inclusive boundaries on the safe side.

const ch = columnChallenge()
const sy = ch.material.yieldStressPa
const input = (eulerRatio: number, dt: number) => ({ eulerStressPa: eulerRatio * sy, diameterToWall: dt })
const run = (eulerRatio: number, dt: number) => {
  const r = checkColumnApplicability(input(eulerRatio, dt), ch)
  return { warnings: r.warnings.map((w) => w.code), notApplicable: r.notApplicable.map((w) => w.code) }
}

describe('checkColumnApplicability', () => {
  it('defines two screens in a fixed order with their thresholds', () => {
    expect(COLUMN_APPLICABILITY_CODES).toEqual(['EULER_RANGE', 'WALL_SLENDERNESS'])
    expect(COLUMN_THRESHOLDS.EULER_RANGE).toMatchObject({ warning: 0.4, notApplicable: 0.5 })
    expect(COLUMN_THRESHOLDS.WALL_SLENDERNESS).toMatchObject({ warning: 40, notApplicable: 100 })
  })

  it('reads the metrics σ_E / σ_y and D / t', () => {
    expect(columnApplicabilityMetrics(input(0.3, 25), ch)).toEqual({ EULER_RANGE: 0.3, WALL_SLENDERNESS: 25 })
  })

  it('a metric exactly at a threshold raises nothing; just beyond it does', () => {
    expect(run(0.4, 40)).toEqual({ warnings: [], notApplicable: [] })
    expect(run(0.4 * (1 + 10 * REL_TOL), 40 * (1 + 10 * REL_TOL))).toEqual({ warnings: ['EULER_RANGE', 'WALL_SLENDERNESS'], notApplicable: [] })
    expect(run(0.5, 100)).toEqual({ warnings: ['EULER_RANGE', 'WALL_SLENDERNESS'], notApplicable: [] })
    expect(run(0.5 * (1 + 10 * REL_TOL), 100 * (1 + 10 * REL_TOL))).toEqual({ warnings: [], notApplicable: ['EULER_RANGE', 'WALL_SLENDERNESS'] })
  })

  it('the Euler limit is the Johnson transition: σ_E = σ_y / 2 exactly at λ = λ_c', () => {
    const E = ch.material.elasticModulusPa
    const lambdaC = Math.sqrt((2 * Math.PI ** 2 * E) / sy)
    expect((Math.PI ** 2 * E) / lambdaC ** 2 / sy).toBeCloseTo(0.5, 14)
  })

  it('messages compare value and threshold and name the unmodeled effect', () => {
    const r = checkColumnApplicability(input(0.54, 60), ch)
    expect(r.notApplicable[0]!.message).toBe(
      'Buckling stress divided by yield stress is 0.54, above the model limit of 0.5. This column is too stocky for the Euler formula: the material starts to yield before it buckles. The model does not include inelastic (Johnson) buckling of intermediate columns, so its results cannot be trusted for this design.',
    )
    expect(r.warnings[0]!.message).toBe(
      'Outer diameter divided by wall thickness is 60, above the caution level of 40. The model does not include local (shell) buckling of the tube wall, so treat these results with caution.',
    )
    expect(r.notApplicable[0]).toMatchObject({ value: 0.54, threshold: 0.5 })
  })
})
