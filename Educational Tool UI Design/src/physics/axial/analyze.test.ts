import { describe, expect, it } from 'vitest'
import { axialChallenge, rod } from '../../../test/fixtures/axial'
import { PhysicsInvariantError } from '../analyze'
import { analyzeRod, AxialInvariantError } from './analyze'
import { checkAxialApplicability } from './applicability'
import { AXIAL_ASSUMPTIONS, AXIAL_THRESHOLDS, AXIAL_UNSUPPORTED_EFFECTS } from './constants'
import * as F from './formulas'
import { TYPICAL_MATERIALS, typicalMaterial } from './materials'

// Stress and Strain I physics (task 72; SSR-06, SSR-10–SSR-13, MM-10).

const ch = axialChallenge()

describe('axial formulas', () => {
  it('compute area, stress, strain, elongation, stiffness, mass, allowable stress and yield ratio', () => {
    expect(F.circleArea(0.02)).toBeCloseTo(Math.PI * 1e-4, 18)
    expect(F.axialStress(1000, 1e-4)).toBe(1e7)
    expect(F.strainFromStress(2e8, 2e11)).toBe(1e-3)
    expect(F.stressFromStrain(1e-3, 2e11)).toBe(2e8)
    expect(F.strainFromElongation(0.001, 2)).toBe(5e-4)
    expect(F.axialElongation(1000, 2, 1e-4, 2e11)).toBeCloseTo(1e-4, 18)
    expect(F.axialStiffness(2e11, 1e-4, 2)).toBe(1e7)
    expect(F.prismMass(7850, 1e-4, 2)).toBeCloseTo(1.57, 12)
    expect(F.allowableStress(250e6, 2)).toBe(125e6)
    expect(F.yieldRatio(125e6, 250e6)).toBe(0.5)
  })

  it('keeps the typical textbook materials in a fixed order with plausible values', () => {
    expect(TYPICAL_MATERIALS.map((m) => m.id)).toEqual(['steel', 'aluminium', 'titanium'])
    expect(typicalMaterial('aluminium').elasticModulusPa).toBe(69e9)
    expect(Object.isFrozen(TYPICAL_MATERIALS[0])).toBe(true)
  })
})

describe('analyzeRod', () => {
  it('names the model, lists assumptions and unsupported effects, and is deep-frozen', () => {
    const a = analyzeRod(ch.initialDesign, ch)
    expect(a).toMatchObject({ modelId: 'axialTieRod', modelVersion: 1, applicable: true, warnings: [], notApplicableReasons: [] })
    expect(a.assumptions).toBe(AXIAL_ASSUMPTIONS)
    expect(a.unsupportedEffects).toBe(AXIAL_UNSUPPORTED_EFFECTS)
    expect(a.unsupportedEffects).toContain('yielding, necking and plastic flow (screened only)')
    expect(Object.isFrozen(a)).toBe(true)
    expect(a.elasticModulusPa).toBe(200e9)
    expect(a.yieldStressPa).toBe(250e6)
  })

  it('throws a typed invariant error for an unlisted material or a non-positive result', () => {
    expect(() => analyzeRod(rod('x', 0.013, 'cork'), ch)).toThrow(AxialInvariantError)
    const err = (() => {
      try {
        analyzeRod(rod('x', 0, 'steel'), ch)
      } catch (e) {
        return e
      }
    })()
    expect(err).toBeInstanceOf(AxialInvariantError)
    expect(err).toBeInstanceOf(PhysicsInvariantError)
    expect((err as AxialInvariantError).field).toBe('diameterM')
    expect((err as Error).name).toBe('AxialInvariantError')
  })
})

describe('checkAxialApplicability (SSR-10)', () => {
  const { warning, notApplicable } = AXIAL_THRESHOLDS.PLASTICITY

  it('is inclusive on the safe side at 0.8 and 1.0', () => {
    expect(checkAxialApplicability(warning)).toEqual({ warnings: [], notApplicable: [] })
    expect(checkAxialApplicability(notApplicable).notApplicable).toEqual([])
    expect(checkAxialApplicability(notApplicable).warnings.map((w) => w.code)).toEqual(['PLASTICITY'])
    expect(checkAxialApplicability(warning * (1 + 1e-6)).warnings).toHaveLength(1)
    expect(checkAxialApplicability(notApplicable * (1 + 1e-6)).notApplicable).toHaveLength(1)
  })

  it('names yielding, necking and plastic flow in both messages', () => {
    const w = checkAxialApplicability(0.836859275516884).warnings[0]!
    expect(w).toMatchObject({ code: 'PLASTICITY', threshold: 0.8 })
    expect(w.message).toBe(
      'Axial stress divided by yield strength is 0.837, above the caution level of 0.8. The rod is close to yield. The model does not include yielding, necking or plastic flow, so treat these results with caution.',
    )
    const na = checkAxialApplicability(2.82942121052258)
    expect(na.warnings).toEqual([])
    expect(na.notApplicable[0]!.message).toBe(
      'Axial stress divided by yield strength is 2.83, above the model limit of 1. The rod has reached yield. The model does not include yielding, necking or plastic flow, so its results cannot be trusted for this design.',
    )
  })
})
