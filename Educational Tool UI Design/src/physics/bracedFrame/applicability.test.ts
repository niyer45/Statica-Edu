import { describe, expect, it } from 'vitest'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import { REL_TOL } from '../tolerance'
import { bracedFrameScreenMetrics, checkBracedFrameScreens, mechanismIssue } from './applicability'

// Braced frame screens and the mechanism issue (task 49.2; BFR-11, BFR-12; inclusive boundaries).

const codes = (r: ReturnType<typeof checkBracedFrameScreens>) => ({
  warnings: r.warnings.map((i) => i.code),
  notApplicable: r.notApplicable.map((i) => i.code),
})

describe('checkBracedFrameScreens', () => {
  it('skips INELASTIC_BUCKLING when no compression member has λ < λ_c', () => {
    expect(bracedFrameScreenMetrics({ maxStoreyDriftRatio: 0.002 })).toEqual({ LARGE_DRIFT: 0.002 })
    expect(codes(checkBracedFrameScreens({ maxStoreyDriftRatio: 0.002 }))).toEqual({ warnings: [], notApplicable: [] })
  })

  it('is inclusive at exactly 0.8 / 1.0 (INELASTIC_BUCKLING) and 0.01 / 0.02 (LARGE_DRIFT)', () => {
    expect(codes(checkBracedFrameScreens({ maxStoreyDriftRatio: 0.01, maxInelasticRatio: 0.8 }))).toEqual({ warnings: [], notApplicable: [] })
    expect(codes(checkBracedFrameScreens({ maxStoreyDriftRatio: 0.02, maxInelasticRatio: 1.0 }))).toEqual({
      warnings: ['INELASTIC_BUCKLING', 'LARGE_DRIFT'],
      notApplicable: [],
    })
    expect(codes(checkBracedFrameScreens({ maxStoreyDriftRatio: toleranceEdge(0.01, REL_TOL), maxInelasticRatio: toleranceEdge(0.8, REL_TOL) }))).toEqual({ warnings: [], notApplicable: [] })
  })

  it('one step beyond each threshold raises the issue', () => {
    const w = checkBracedFrameScreens({ maxStoreyDriftRatio: nextUp(toleranceEdge(0.01, REL_TOL)), maxInelasticRatio: nextUp(toleranceEdge(0.8, REL_TOL)) })
    expect(codes(w)).toEqual({ warnings: ['INELASTIC_BUCKLING', 'LARGE_DRIFT'], notApplicable: [] })
    const na = checkBracedFrameScreens({ maxStoreyDriftRatio: nextUp(toleranceEdge(0.02, REL_TOL)), maxInelasticRatio: nextUp(toleranceEdge(1, REL_TOL)) })
    expect(codes(na)).toEqual({ warnings: [], notApplicable: ['INELASTIC_BUCKLING', 'LARGE_DRIFT'] })
  })

  it('names the metric, compares value with threshold and states the consequence', () => {
    const [w] = checkBracedFrameScreens({ maxStoreyDriftRatio: 0.0148 }).warnings
    expect(w).toEqual({
      code: 'LARGE_DRIFT',
      message:
        'The largest inter-storey drift ratio is 0.0148, above the caution level of 0.01. The model does not include large displacements and second-order (P-Δ) effects, so treat these results with caution.',
      value: 0.0148,
      threshold: 0.01,
    })
    const [na] = checkBracedFrameScreens({ maxStoreyDriftRatio: 0, maxInelasticRatio: 1.0103565 }).notApplicable
    expect(na.message).toContain('above the model limit of 1')
    expect(na.message).toContain('cannot be trusted')
  })
})

describe('mechanismIssue', () => {
  it('reports the mode count against zero allowed modes, singular and plural', () => {
    expect(mechanismIssue(1)).toMatchObject({ code: 'MECHANISM', value: 1, threshold: 0 })
    expect(mechanismIssue(1).message).toContain('(1 independent sway mode)')
    expect(mechanismIssue(2).message).toContain('(2 independent sway modes)')
    expect(mechanismIssue(2).message).toContain('not defined')
  })
})
