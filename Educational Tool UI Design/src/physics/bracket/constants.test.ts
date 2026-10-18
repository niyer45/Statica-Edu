import { describe, expect, it } from 'vitest'
import {
  BRACKET_APPLICABILITY_CODES,
  BRACKET_ASSUMPTIONS,
  BRACKET_SOURCE_NOTE,
  BRACKET_THRESHOLDS,
  BRACKET_UNSUPPORTED_EFFECTS,
  CURVED_BEAM_MIN_R_OVER_C,
} from './constants'

// Bracket model constants (task 55, `boltedLBracket` v1).

describe('bracket curved-beam constants', () => {
  it('limits the curved-beam formula to the tabulated range R/c ≥ 1.2', () => {
    expect(CURVED_BEAM_MIN_R_OVER_C).toBe(1.2)
  })

  it('discloses the formula, the sources and the pending review, with no digits', () => {
    expect(BRACKET_SOURCE_NOTE).toMatch(/Winkler–Bach/)
    expect(BRACKET_SOURCE_NOTE).toMatch(/Shigley/)
    expect(BRACKET_SOURCE_NOTE).toMatch(/Roark/)
    expect(BRACKET_SOURCE_NOTE).toMatch(/pending engineering review/)
    expect(BRACKET_SOURCE_NOTE).not.toMatch(/\d/)
    expect(BRACKET_ASSUMPTIONS).toContain(BRACKET_SOURCE_NOTE)
  })
})

describe('bracket applicability constants', () => {
  it('defines the four screens in order with their warning / not-applicable levels', () => {
    expect(BRACKET_APPLICABILITY_CODES).toEqual(['CURVED_BEAM_RANGE', 'PLASTICITY', 'LARGE_DEFLECTION', 'LEG_SPAN'])
    const levels = Object.fromEntries(BRACKET_APPLICABILITY_CODES.map((c) => [c, [BRACKET_THRESHOLDS[c].warning, BRACKET_THRESHOLDS[c].notApplicable]]))
    expect(levels).toEqual({
      CURVED_BEAM_RANGE: [1, 1],
      PLASTICITY: [0.8, 1],
      LARGE_DEFLECTION: [0.02, 0.1],
      LEG_SPAN: [0.2, 0.5],
    })
    for (const c of BRACKET_APPLICABILITY_CODES) expect(BRACKET_THRESHOLDS[c].warning).toBeLessThanOrEqual(BRACKET_THRESHOLDS[c].notApplicable)
  })

  it('LEG_SPAN levels correspond to about 3 % and 20 % extra flange rotation from shear (Timoshenko, κ = 5/6, ν = 0.33)', () => {
    const nu = 0.33
    const kappa = 5 / 6
    // 3EI/(κGA h²) for a rectangle = E/(4κG) (t/h)², with E/G = 2(1 + ν).
    const extra = (ratio: number) => ((2 * (1 + nu)) / (4 * kappa)) * ratio ** 2
    expect(extra(BRACKET_THRESHOLDS.LEG_SPAN.warning)).toBeCloseTo(0.032, 3)
    expect(extra(BRACKET_THRESHOLDS.LEG_SPAN.notApplicable)).toBeCloseTo(0.1995, 3)
  })

  it('lists the unsupported effects, including bolt preload and prying, and the assumptions', () => {
    expect(BRACKET_UNSUPPORTED_EFFECTS.join(' ')).toMatch(/preload/)
    expect(BRACKET_UNSUPPORTED_EFFECTS.join(' ')).toMatch(/prying/)
    expect(BRACKET_UNSUPPORTED_EFFECTS.join(' ')).toMatch(/fatigue/)
    expect(BRACKET_ASSUMPTIONS.join(' ')).toMatch(/heel/)
    expect(Object.isFrozen(BRACKET_UNSUPPORTED_EFFECTS) && Object.isFrozen(BRACKET_ASSUMPTIONS) && Object.isFrozen(BRACKET_THRESHOLDS)).toBe(true)
  })
})
