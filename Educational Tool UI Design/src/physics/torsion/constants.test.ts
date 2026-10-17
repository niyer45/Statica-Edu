import { describe, expect, it } from 'vitest'
import {
  TORSION_APPLICABILITY_CODES,
  TORSION_ASSUMPTIONS,
  TORSION_THRESHOLDS,
  TORSION_UNSUPPORTED_EFFECTS,
} from './constants'

// Torsion thresholds and metadata (task 47.2; TSH-10–TSH-12).

describe('torsion applicability constants', () => {
  it('defines PLASTICITY_SHEAR 0.8/1.0 and TUBE_SLENDERNESS 40/100, in that order', () => {
    expect(TORSION_APPLICABILITY_CODES).toEqual(['PLASTICITY_SHEAR', 'TUBE_SLENDERNESS'])
    expect(TORSION_THRESHOLDS.PLASTICITY_SHEAR).toMatchObject({ warning: 0.8, notApplicable: 1.0, effect: 'plasticity' })
    expect(TORSION_THRESHOLDS.TUBE_SLENDERNESS).toMatchObject({
      warning: 40,
      notApplicable: 100,
      metric: 'D / t_wall',
      effect: 'torsional buckling of thin tubes',
    })
    for (const code of TORSION_APPLICABILITY_CODES) {
      expect(TORSION_THRESHOLDS[code].warning).toBeLessThan(TORSION_THRESHOLDS[code].notApplicable)
    }
  })

  it('adds no surface-strain or end-effect screen (TSH-11)', () => {
    expect(Object.keys(TORSION_THRESHOLDS).sort()).toEqual(['PLASTICITY_SHEAR', 'TUBE_SLENDERNESS'])
  })

  it('lists every TSH-12 unsupported effect', () => {
    expect(TORSION_UNSUPPORTED_EFFECTS).toEqual([
      'rotating dynamics and critical speed',
      'fatigue',
      'combined bending or axial load',
      'stress concentrations at keyways, shoulders and fixtures',
      'end-fitting compliance',
      'torsional buckling of thin tubes (screened only)',
      'plasticity (screened only)',
      'self-weight bending',
    ])
    expect(TORSION_ASSUMPTIONS).toContain('linear elastic material')
    expect(TORSION_ASSUMPTIONS).toContain('shear stress linear in radius')
  })

  it('is frozen', () => {
    for (const v of [TORSION_APPLICABILITY_CODES, TORSION_THRESHOLDS, TORSION_THRESHOLDS.PLASTICITY_SHEAR, TORSION_UNSUPPORTED_EFFECTS, TORSION_ASSUMPTIONS]) {
      expect(Object.isFrozen(v)).toBe(true)
    }
  })
})
