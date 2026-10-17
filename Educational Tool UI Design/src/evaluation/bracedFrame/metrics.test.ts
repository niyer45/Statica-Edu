import { describe, expect, it } from 'vitest'
import { bracedFrameChallenge, worksheetFixture } from '../../../test/fixtures/bracedFrame'
import { analyzeBracedFrame } from '../../physics/bracedFrame/analyze'
import type { BracedFrameSolvedAnalysis } from '../../physics/bracedFrame/types'
import { BRACED_FRAME_COMPARISON_METRICS, BRACED_FRAME_PRIMARY_METRIC } from './metrics'

// Braced frame prediction and comparison metrics (task 49.2; BFR-06, BFR-08, MM-13, MM-14).

const ch = bracedFrameChallenge()
const a = analyzeBracedFrame(worksheetFixture('reference').design, ch) as BracedFrameSolvedAnalysis
const mechanism = analyzeBracedFrame(worksheetFixture('upperUnbraced').design, ch)

describe('BRACED_FRAME_PRIMARY_METRIC', () => {
  it('reads |roof drift| and is named "roof drift", never deflection', () => {
    expect(BRACED_FRAME_PRIMARY_METRIC.id).toBe('roofDriftM')
    expect(BRACED_FRAME_PRIMARY_METRIC.label).toBe('roof drift')
    expect(BRACED_FRAME_PRIMARY_METRIC.label).not.toMatch(/deflection|tip/i)
    expect(BRACED_FRAME_PRIMARY_METRIC.read(a)).toBe(a.roofDriftM)
    expect(BRACED_FRAME_PRIMARY_METRIC.read({ ...a, roofDriftM: -a.roofDriftM })).toBe(a.roofDriftM)
  })

  it('is undefined for a mechanism and for non-finite or zero values (not scorable, MM-13)', () => {
    expect(BRACED_FRAME_PRIMARY_METRIC.read(mechanism)).toBeUndefined()
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY, 0]) expect(BRACED_FRAME_PRIMARY_METRIC.read({ ...a, roofDriftM: v })).toBeUndefined()
  })
})

describe('BRACED_FRAME_COMPARISON_METRICS', () => {
  it('lists stored-value metrics, roof drift first; only mass is defined for a mechanism', () => {
    expect(BRACED_FRAME_COMPARISON_METRICS.map((m) => m.id)).toEqual(['roofDriftM', 'maxUtilization', 'massKg', 'floorDriftM', 'maxStoreyDriftRatio'])
    for (const m of BRACED_FRAME_COMPARISON_METRICS) {
      expect(m.read(a)).toBe(Math.abs(a[m.id]))
      expect(m.label).not.toMatch(/\d|deflection/i)
    }
    expect(BRACED_FRAME_COMPARISON_METRICS.map((m) => m.read(mechanism))).toEqual([undefined, undefined, mechanism.massKg, undefined, undefined])
    expect(Object.isFrozen(BRACED_FRAME_COMPARISON_METRICS)).toBe(true)
  })
})
