import { describe, expect, it } from 'vitest'
import { heatSinkChallenge, worksheetFixture } from '../../../test/fixtures/heatSink'
import { lowerToleranceEdge, nextDown } from '../../../test/heatSinkNumeric'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import { REL_TOL } from '../tolerance'
import { analyzeHeatSink } from './analyze'
import { checkHeatSinkApplicability, heatSinkApplicabilityMetrics } from './applicability'
import { HEAT_SINK_APPLICABILITY_CODES, HEAT_SINK_THRESHOLDS } from './constants'
import type { HeatSinkApplicabilityInput } from './types'

// Heat sink applicability screens (task 48.2; HSK-10). Inclusive safe side: a metric equal to a
// threshold (within REL_TOL) produces no issue at that level; the first double past the tolerance
// edge does. FIN_GAP is a lower-bound screen, the others upper-bound screens.

const ch = heatSinkChallenge()
/** Metrics that raise nothing on their own. */
const SAFE: HeatSinkApplicabilityInput = { finGapM: 0.005, channelAspectRatio: 1, finBiotNumber: 1e-4 }

const codes = (input: Partial<HeatSinkApplicabilityInput>) => {
  const r = checkHeatSinkApplicability({ ...SAFE, ...input })
  return { warnings: r.warnings.map((i) => i.code), notApplicable: r.notApplicable.map((i) => i.code) }
}
const NONE = { warnings: [], notApplicable: [] }

describe('FIN_GAP (s, lower bound: warning below 3 mm, not applicable below 2 mm)', () => {
  const at = (s: number) => codes({ finGapM: s })

  it('raises nothing at or above 3 mm, including the tolerance edge', () => {
    expect(at(0.004)).toEqual(NONE)
    expect(at(0.003)).toEqual(NONE)
    const edge = lowerToleranceEdge(0.003, REL_TOL)
    expect(at(edge)).toEqual(NONE)
    expect(at(nextDown(edge))).toEqual({ warnings: ['FIN_GAP'], notApplicable: [] })
  })

  it('warns down to and including 2 mm, then is not applicable', () => {
    expect(at(0.0025)).toEqual({ warnings: ['FIN_GAP'], notApplicable: [] })
    expect(at(0.002)).toEqual({ warnings: ['FIN_GAP'], notApplicable: [] })
    const edge = lowerToleranceEdge(0.002, REL_TOL)
    expect(at(edge)).toEqual({ warnings: ['FIN_GAP'], notApplicable: [] })
    expect(at(nextDown(edge))).toEqual({ warnings: [], notApplicable: ['FIN_GAP'] })
    expect(at(0.00105)).toEqual({ warnings: [], notApplicable: ['FIN_GAP'] })
  })

  it('never passes a non-finite gap', () => {
    expect(at(Number.NaN)).toEqual({ warnings: [], notApplicable: ['FIN_GAP'] })
  })

  it('writes the gap in millimetres, naming the effect and threshold', () => {
    const [w] = checkHeatSinkApplicability({ ...SAFE, finGapM: 0.00293333333333333 }).warnings
    expect(w).toEqual({
      code: 'FIN_GAP',
      message:
        'The gap between fins is 2.93 mm, below the caution level of 3 mm. ' +
        'The model does not include air heating and flow bypass in narrow fin channels, so treat these results with caution.',
      value: 0.00293333333333333,
      threshold: 0.003,
    })
    const [n] = checkHeatSinkApplicability({ ...SAFE, finGapM: 0.00175 }).notApplicable
    expect(n.message).toBe(
      'The gap between fins is 1.75 mm, below the model limit of 2 mm. ' +
        'The model does not include air heating and flow bypass in narrow fin channels, so its results cannot be trusted for this design.',
    )
  })
})

describe('CHANNEL_ASPECT (H/s, warning above 8, not applicable above 12)', () => {
  const at = (r: number) => codes({ channelAspectRatio: r })

  it('is inclusive at 8 and 12 and triggers one double past the tolerance edge', () => {
    expect(at(8)).toEqual(NONE)
    expect(at(toleranceEdge(8, REL_TOL))).toEqual(NONE)
    expect(at(nextUp(toleranceEdge(8, REL_TOL)))).toEqual({ warnings: ['CHANNEL_ASPECT'], notApplicable: [] })
    expect(at(12)).toEqual({ warnings: ['CHANNEL_ASPECT'], notApplicable: [] })
    expect(at(toleranceEdge(12, REL_TOL))).toEqual({ warnings: ['CHANNEL_ASPECT'], notApplicable: [] })
    expect(at(nextUp(toleranceEdge(12, REL_TOL)))).toEqual({ warnings: [], notApplicable: ['CHANNEL_ASPECT'] })
  })

  it('names reduced root airflow', () => {
    const [w] = checkHeatSinkApplicability({ ...SAFE, channelAspectRatio: 8.75 }).warnings
    expect(w.message).toBe(
      'Fin height divided by fin gap is 8.75, above the caution level of 8. ' +
        'The model does not include reduced airflow at the roots of deep, narrow fin channels, so treat these results with caution.',
    )
  })

  it('peaks at 8.75 within the constraints (H ≤ 35 mm, s ≥ 4 mm): thickFins warns, none is not applicable', () => {
    const a = analyzeHeatSink(worksheetFixture('thickFins').design, ch)
    expect(a.channelAspectRatio).toBeCloseTo(8.75, 12)
    expect(a.warnings.map((i) => i.code)).toEqual(['CHANNEL_ASPECT'])
  })
})

describe('FIN_BIOT (h t / 2k, warning above 0.01, not applicable above 0.1)', () => {
  const at = (bi: number) => codes({ finBiotNumber: bi })

  it('is inclusive at 0.01 and 0.1 and triggers one double past the tolerance edge', () => {
    expect(at(0.01)).toEqual(NONE)
    expect(at(toleranceEdge(0.01, REL_TOL))).toEqual(NONE)
    expect(at(nextUp(toleranceEdge(0.01, REL_TOL)))).toEqual({ warnings: ['FIN_BIOT'], notApplicable: [] })
    expect(at(0.1)).toEqual({ warnings: ['FIN_BIOT'], notApplicable: [] })
    expect(at(nextUp(toleranceEdge(0.1, REL_TOL)))).toEqual({ warnings: [], notApplicable: ['FIN_BIOT'] })
  })

  it('is defense in depth: the configured ranges cap Bi at 3.125e-4', () => {
    const thickest = analyzeHeatSink({ ...ch.initialDesign, finCount: 2, finThicknessM: 0.005 }, ch)
    expect(thickest.finBiotNumber).toBeCloseTo(3.125e-4, 15)
    expect(thickest.warnings).toEqual([])
  })

  it('is evaluated through analyzeHeatSink with a configured coefficient', () => {
    // Bi = h t/(2k): t = 3 mm, k = 200 → h = 1333.3 gives Bi = 0.01 exactly on the safe side.
    const withH = (h: number) => analyzeHeatSink(worksheetFixture('shortFins').design, { ...ch, convection: { ...ch.convection, coefficientWPerM2K: h } })
    const at01 = withH((0.01 * 2 * 200) / 0.003)
    expect(at01.warnings.map((i) => i.code)).not.toContain('FIN_BIOT')
    expect(withH(((0.01 * 2 * 200) / 0.003) * (1 + 4 * REL_TOL)).warnings.map((i) => i.code)).toContain('FIN_BIOT')
    expect(withH(1e5).notApplicableReasons.map((i) => i.code)).toContain('FIN_BIOT')
  })
})

describe('issue ordering and metrics', () => {
  it('follows HEAT_SINK_APPLICABILITY_CODES and lists each code at most once', () => {
    const r = checkHeatSinkApplicability({ finGapM: 0.001, channelAspectRatio: 20, finBiotNumber: 1 })
    expect(r.notApplicable.map((i) => i.code)).toEqual([...HEAT_SINK_APPLICABILITY_CODES])
    expect(r.warnings).toEqual([])
    expect(r.notApplicable.map((i) => i.threshold)).toEqual(HEAT_SINK_APPLICABILITY_CODES.map((c) => HEAT_SINK_THRESHOLDS[c].notApplicable))
  })

  it('reads every metric from the stored analysis', () => {
    const a = analyzeHeatSink(worksheetFixture('gapWarning').design, ch)
    expect(heatSinkApplicabilityMetrics(a)).toEqual({ FIN_GAP: a.finGapM, CHANNEL_ASPECT: a.channelAspectRatio, FIN_BIOT: a.finBiotNumber })
  })
})
