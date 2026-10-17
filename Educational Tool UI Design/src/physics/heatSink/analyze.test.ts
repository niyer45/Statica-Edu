import { describe, expect, it } from 'vitest'
import { heatSink, heatSinkChallenge, worksheetFixture } from '../../../test/fixtures/heatSink'
import type { HeatSinkChallenge } from '../../challenge/heatSink/types'
import { PhysicsInvariantError } from '../analyze'
import { analyzeHeatSink, HEAT_SINK_MODEL_ID, HEAT_SINK_MODEL_VERSION, HeatSinkInvariantError } from './analyze'
import { HEAT_SINK_ASSUMPTIONS, HEAT_SINK_UNSUPPORTED_EFFECTS } from './constants'
import { correctedFinLength, finEfficiency, finExcessRatio, finParameter, overallSurfaceEfficiency } from './fin'

// Heat sink analysis entry point (task 48.2; HSK-06, HSK-10–HSK-14, MM-03, MM-10).

const ch = heatSinkChallenge()
const reference = worksheetFixture('reference')

const NUMERIC = [
  'finGapM',
  'finHeightM',
  'channelAspectRatio',
  'finBiotNumber',
  'finParameterPerM',
  'correctedFinLengthM',
  'finEfficiency',
  'finAreaM2',
  'exposedBaseAreaM2',
  'totalAreaM2',
  'overallEfficiency',
  'effectiveAreaM2',
  'baseResistanceKPerW',
  'convectionResistanceKPerW',
  'totalResistanceKPerW',
  'baseTemperatureK',
  'baseTemperatureRiseK',
  'finnedSurfaceTemperatureK',
  'finRootExcessK',
  'massKg',
  'finHeatShare',
] as const

describe('analyzeHeatSink', () => {
  it('names plateFinHeatSink v1 and lists assumptions and unsupported effects', () => {
    const a = analyzeHeatSink(reference.design, ch)
    expect(HEAT_SINK_MODEL_ID).toBe('plateFinHeatSink')
    expect(HEAT_SINK_MODEL_VERSION).toBe(1)
    expect(a.modelId).toBe('plateFinHeatSink')
    expect(a.modelVersion).toBe(1)
    expect(a.assumptions).toEqual(HEAT_SINK_ASSUMPTIONS)
    expect(a.unsupportedEffects).toEqual(HEAT_SINK_UNSUPPORTED_EFFECTS)
    expect(a.applicable).toBe(true)
    expect(a.warnings).toEqual([])
    expect(a.notApplicableReasons).toEqual([])
  })

  it('returns exactly the documented keys with finite positive numbers', () => {
    const a = analyzeHeatSink(reference.design, ch)
    expect(Object.keys(a).sort()).toEqual(
      ['modelId', 'modelVersion', 'applicable', 'warnings', 'notApplicableReasons', 'unsupportedEffects', 'assumptions', 'finProfile', ...NUMERIC].sort(),
    )
    for (const key of NUMERIC) expect(Number.isFinite(a[key]) && a[key] > 0, key).toBe(true)
    expect(a.finHeightM).toBe(0.035)
  })

  it('stores the fin profile at the configured positions, root first, as absolute kelvin', () => {
    const a = analyzeHeatSink(reference.design, ch)
    expect(a.finProfile.map((p) => p.xOverH)).toEqual(ch.visualization.profileSamplesXOverH)
    expect(a.finProfile[0].excessRatio).toBe(1)
    expect(a.finProfile[0].temperatureK).toBe(a.finnedSurfaceTemperatureK)
    for (let i = 1; i < a.finProfile.length; i++) {
      expect(a.finProfile[i].excessRatio).toBeLessThan(a.finProfile[i - 1].excessRatio)
      expect(a.finProfile[i].temperatureK).toBeGreaterThan(ch.ambientTemperatureK)
    }
    const custom: HeatSinkChallenge = { ...ch, visualization: { profileSamplesXOverH: [0, 1] } }
    expect(analyzeHeatSink(reference.design, custom).finProfile).toHaveLength(2)
  })

  it('is deep-frozen, deterministic and does not mutate inputs', () => {
    const d = structuredClone(reference.design)
    const before = structuredClone(d)
    const a = analyzeHeatSink(d, ch)
    expect(Object.isFrozen(a)).toBe(true)
    expect(Object.isFrozen(a.finProfile)).toBe(true)
    expect(Object.isFrozen(a.finProfile[2])).toBe(true)
    expect(Object.isFrozen(a.warnings)).toBe(true)
    expect(analyzeHeatSink(d, ch)).toEqual(a)
    expect(d).toEqual(before)
  })

  it('round-trips through JSON unchanged (persistence re-analysis compares stored values)', () => {
    const a = analyzeHeatSink(worksheetFixture('gapWarning').design, ch)
    expect(JSON.parse(JSON.stringify(a))).toEqual(a)
  })

  it('reads fin variables from the design and every constant from the challenge', () => {
    const a = analyzeHeatSink(reference.design, ch)
    const doubleQ = analyzeHeatSink(reference.design, { ...ch, heatLoadW: 50 })
    expect(doubleQ.baseTemperatureRiseK).toBeCloseTo(2 * a.baseTemperatureRiseK, 12)
    const warmer = analyzeHeatSink(reference.design, { ...ch, ambientTemperatureK: 308.15 })
    expect(warmer.baseTemperatureK - a.baseTemperatureK).toBeCloseTo(10, 12)
    expect(warmer.baseTemperatureRiseK).toBe(a.baseTemperatureRiseK)
    const thickerBase = analyzeHeatSink(reference.design, { ...ch, base: { ...ch.base, thicknessM: 0.008 } })
    expect(thickerBase.baseResistanceKPerW).toBeCloseTo(2 * a.baseResistanceKPerW, 15)
    expect(thickerBase.convectionResistanceKPerW).toBe(a.convectionResistanceKPerW)
  })

  it('throws a typed invariant error for designs that violate the precondition', () => {
    // N = 20, t = 3 mm has s = 0; validation rejects it before analysis.
    const merged = heatSink('bad', 20, 0.003, 0.015)
    expect(() => analyzeHeatSink(merged, ch)).toThrow(HeatSinkInvariantError)
    try {
      analyzeHeatSink(merged, ch)
    } catch (e) {
      expect(e).toBeInstanceOf(PhysicsInvariantError)
      expect(e).toMatchObject({ name: 'HeatSinkInvariantError', field: 'finGapM' })
      expect((e as Error).message).toContain('finGapM')
    }
    // N = 1: the gap is undefined (division by zero gives +∞).
    expect(() => analyzeHeatSink(heatSink('one', 1, 0.003, 0.015), ch)).toThrow(/finGapM = Infinity/)
    expect(() => analyzeHeatSink(heatSink('nan', 4, Number.NaN, 0.015), ch)).toThrow(/finGapM = NaN/)
  })

  it('reports later fields when earlier ones are fine', () => {
    expect(() => analyzeHeatSink(reference.design, { ...ch, heatLoadW: 0 })).toThrow(/baseTemperatureRiseK/)
    // A negative ambient temperature (not a valid config) leaves T_s ≤ 0 in the profile.
    expect(() => analyzeHeatSink(reference.design, { ...ch, ambientTemperatureK: -400 })).toThrow(/baseTemperatureK/)
    const coldProfile: HeatSinkChallenge = { ...ch, ambientTemperatureK: -22 }
    // T_base and T_s stay positive here, but the tip sample drops to −22 + 23.37 · 0.90 < 0.
    expect(() => analyzeHeatSink(reference.design, coldProfile)).toThrow(/finProfile\.\d\.temperatureK/)
  })
})

describe('fin formulas', () => {
  it('compute m, L_c, η_f, η_o and the profile from their definitions', () => {
    expect(finParameter(25, 200, 0.0015)).toBe(Math.sqrt(50 / 0.3))
    expect(correctedFinLength(0.035, 0.0015)).toBe(0.035 + 0.00075)
    expect(finEfficiency(0.5)).toBe(Math.tanh(0.5) / 0.5)
    expect(overallSurfaceEfficiency(10, 2, 40, 0.9)).toBeCloseTo(1 - 0.5 * 0.1, 15)
    expect(finExcessRatio(10, 0.04, 0)).toBe(1)
    expect(finExcessRatio(10, 0.04, 0.04)).toBe(1 / Math.cosh(0.4))
  })
})
