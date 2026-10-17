import { describe, expect, it } from 'vitest'
import {
  BRACED_FRAME_APPLICABILITY_CODES,
  BRACED_FRAME_ASSUMPTIONS,
  BRACED_FRAME_SOLVER_TOLERANCES,
  BRACED_FRAME_THRESHOLDS,
  BRACED_FRAME_UNSUPPORTED_EFFECTS,
} from './constants'

// Braced frame tolerances, thresholds and metadata (task 49.2; BFR-11–BFR-14).

describe('braced frame constants', () => {
  it('uses the BFR-11 and BFR-14 tolerances', () => {
    expect(BRACED_FRAME_SOLVER_TOLERANCES).toEqual({ pivotRelTol: 1e-9, residualRelTol: 1e-9, zeroForceRelTol: 1e-9 })
  })

  it('defines MECHANISM, INELASTIC_BUCKLING 0.8/1.0 and LARGE_DRIFT 0.01/0.02, in that order', () => {
    expect(BRACED_FRAME_APPLICABILITY_CODES).toEqual(['MECHANISM', 'INELASTIC_BUCKLING', 'LARGE_DRIFT'])
    expect(BRACED_FRAME_THRESHOLDS.INELASTIC_BUCKLING).toMatchObject({ warning: 0.8, notApplicable: 1.0, effect: 'inelastic buckling of stocky members' })
    expect(BRACED_FRAME_THRESHOLDS.LARGE_DRIFT).toMatchObject({ warning: 0.01, notApplicable: 0.02, metric: 'maximum inter-storey drift ratio' })
    expect(Object.keys(BRACED_FRAME_THRESHOLDS).sort()).toEqual(['INELASTIC_BUCKLING', 'LARGE_DRIFT'])
  })

  it('lists every BFR-13 assumption and unsupported effect', () => {
    expect(BRACED_FRAME_ASSUMPTIONS).toHaveLength(11)
    expect(BRACED_FRAME_ASSUMPTIONS).toContain('crossing diagonals are not connected at the crossing')
    expect(BRACED_FRAME_ASSUMPTIONS).toContain('forces beyond capacity are nominal elastic values (no yielding or post-buckling redistribution)')
    expect(BRACED_FRAME_UNSUPPORTED_EFFECTS).toEqual([
      'rigid or semi-rigid joints and frame bending action',
      'P-Δ and other second-order effects (screened only)',
      'tension-only bracing and post-buckling redistribution',
      'load reversal and other load cases (only one load direction is analyzed)',
      'connection design, eccentricity and bolt or weld capacity',
      'member imperfections and residual stresses (inelastic buckling is screened only)',
      'out-of-plane and flexural-torsional buckling',
      'local buckling of the tube walls',
      'dynamic, wind-gust and seismic response',
      'self-weight',
      'foundation flexibility and support settlement',
    ])
  })

  it('is frozen', () => {
    for (const v of [BRACED_FRAME_SOLVER_TOLERANCES, BRACED_FRAME_APPLICABILITY_CODES, BRACED_FRAME_THRESHOLDS, BRACED_FRAME_THRESHOLDS.LARGE_DRIFT, BRACED_FRAME_ASSUMPTIONS, BRACED_FRAME_UNSUPPORTED_EFFECTS]) {
      expect(Object.isFrozen(v)).toBe(true)
    }
  })
})
