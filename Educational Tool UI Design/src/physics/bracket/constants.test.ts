import { describe, expect, it } from 'vitest'
import {
  BRACKET_APPLICABILITY_CODES,
  BRACKET_ASSUMPTIONS,
  BRACKET_KT_SOURCE_NOTE,
  BRACKET_STEP_CODES,
  BRACKET_THRESHOLDS,
  BRACKET_UNSUPPORTED_EFFECTS,
  KT_BRANCH_H_OVER_R,
  KT_H_OVER_R_MAX,
  KT_LOWER_BRANCH,
  KT_R_OVER_H_MAX,
  KT_SHOULDER_CONDITION,
  KT_SMALL_STEP_MIN_RATIO,
  KT_UPPER_BRANCH,
} from './constants'

// Bracket model constants (task 46.2; MBR-13–MBR-15, D-41 K-1–K-5). The full coefficient table is
// also checked against an independent test-side transcription in test/fixtures/bracket.alternative.

describe('bracket Kt constants', () => {
  it('holds the design.md coefficient table: C1 of each branch and the branch/range rules', () => {
    expect(KT_LOWER_BRANCH[0]).toEqual({ alpha: 1.006, beta: 0.967, gamma: 0.013 })
    expect(KT_LOWER_BRANCH[3]).toEqual({ alpha: -0.405, beta: 0.249, gamma: -0.2 })
    expect(KT_UPPER_BRANCH[0]).toEqual({ alpha: 1.058, beta: 1.002, gamma: -0.038 })
    expect(KT_UPPER_BRANCH[3]).toEqual({ alpha: -2.558, beta: 3.046, gamma: -0.701 })
    expect(KT_H_OVER_R_MAX).toBe(20)
    expect(KT_R_OVER_H_MAX).toBe(10)
    expect(KT_BRANCH_H_OVER_R).toBe(2)
    expect(KT_SHOULDER_CONDITION).toEqual({ intercept: 2.0, slope: 2.05, rOverDOffset: 0.025 })
    expect(KT_SMALL_STEP_MIN_RATIO).toBe(1.1)
  })

  it('discloses the secondary-copy source pending printed-edition verification, with no digits (MBR-20)', () => {
    expect(BRACKET_KT_SOURCE_NOTE).toMatch(/secondary copies/)
    expect(BRACKET_KT_SOURCE_NOTE).toMatch(/Peterson/)
    expect(BRACKET_KT_SOURCE_NOTE).toMatch(/Roark/)
    expect(BRACKET_KT_SOURCE_NOTE).toMatch(/pending printed-edition verification/)
    expect(BRACKET_KT_SOURCE_NOTE).not.toMatch(/\d/)
    expect(BRACKET_ASSUMPTIONS).toContain(BRACKET_KT_SOURCE_NOTE)
  })
})

describe('bracket applicability constants (MBR-14)', () => {
  it('defines the nine screens in table order with their warning / not-applicable levels', () => {
    expect(BRACKET_APPLICABILITY_CODES).toEqual([
      'KT_FIT_SHARP',
      'KT_FIT_SHALLOW',
      'KT_SHOULDER_LENGTH',
      'KT_STEP_RATIO',
      'KT_SMALL_STEP',
      'PLASTICITY',
      'DEPTH_SPAN',
      'RECT_ASPECT',
      'LARGE_DEFLECTION',
    ])
    const levels = Object.fromEntries(BRACKET_APPLICABILITY_CODES.map((c) => [c, [BRACKET_THRESHOLDS[c].warning, BRACKET_THRESHOLDS[c].notApplicable]]))
    expect(levels).toEqual({
      KT_FIT_SHARP: [20, 20],
      KT_FIT_SHALLOW: [10, 10],
      KT_SHOULDER_LENGTH: [1, 1],
      KT_STEP_RATIO: [1.5, 1.6],
      KT_SMALL_STEP: [1, 1],
      PLASTICITY: [0.8, 1.0],
      DEPTH_SPAN: [0.1, 0.2],
      RECT_ASPECT: [8, 20],
      LARGE_DEFLECTION: [0.02, 0.1],
    })
    for (const code of BRACKET_APPLICABILITY_CODES) {
      expect(BRACKET_THRESHOLDS[code].warning).toBeLessThanOrEqual(BRACKET_THRESHOLDS[code].notApplicable)
    }
    expect(BRACKET_STEP_CODES).toEqual(BRACKET_APPLICABILITY_CODES.filter((c) => c.startsWith('KT_')))
  })

  it('lists every MBR-15 unsupported effect', () => {
    expect(BRACKET_UNSUPPORTED_EFFECTS).toEqual([
      'wall-clamp and bolt-hole stress concentrations',
      'fastener and joint compliance',
      'fatigue and notch sensitivity (Kt is the theoretical elastic factor; no Kf)',
      'local yielding and stress redistribution (screened only)',
      '3D and out-of-plane loading, and torsion',
      'lateral-torsional buckling (screened only)',
      'shear deformation (screened only)',
      'fillet–wall interaction (screened only)',
      "the fillet's stiffness and mass (neglected)",
      'one-sided steps',
      'contact, self-weight, residual and manufacturing stresses',
    ])
    expect(BRACKET_ASSUMPTIONS).toContain('linear elastic material')
  })

  it('is frozen', () => {
    for (const v of [
      KT_LOWER_BRANCH,
      KT_LOWER_BRANCH[0],
      KT_UPPER_BRANCH,
      KT_SHOULDER_CONDITION,
      BRACKET_APPLICABILITY_CODES,
      BRACKET_STEP_CODES,
      BRACKET_THRESHOLDS,
      BRACKET_THRESHOLDS.KT_STEP_RATIO,
      BRACKET_UNSUPPORTED_EFFECTS,
      BRACKET_ASSUMPTIONS,
    ]) {
      expect(Object.isFrozen(v)).toBe(true)
    }
  })
})
