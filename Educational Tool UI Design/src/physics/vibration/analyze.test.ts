import { describe, expect, it } from 'vitest'
import { isolator, vibrationChallenge, worksheetFixture } from '../../../test/fixtures/vibration'
import type { VibrationChallenge } from '../../challenge/vibration/types'
import type { VibrationDesign } from '../../geometry/vibration/design'
import { PhysicsInvariantError } from '../analyze'
import { analyzeIsolator, VIBRATION_MODEL_ID, VIBRATION_MODEL_VERSION, VibrationInvariantError, vibrationResponseCurve } from './analyze'
import { VIBRATION_ASSUMPTIONS, VIBRATION_UNSUPPORTED_EFFECTS } from './constants'
import { transmissibility } from './response'

// Vibration analysis entry point (task 50.2; VIB-06, VIB-10–VIB-13, MM-03, MM-10).

const ch = vibrationChallenge()
const reference = worksheetFixture('reference')

const NUMERIC = [
  'stiffnessNPerM',
  'naturalFrequencyHz',
  'dampingRatio',
  'dampingCoefficientNsPerM',
  'frequencyRatioAtBandMin',
  'frequencyRatioAtBandMax',
  'worstInBandTransmissibility',
  'worstInBandFrequencyHz',
  'peakTransmissibility',
  'peakTransmissibilityFrequencyHz',
  'staticDeflectionM',
  'peakRelativeDisplacementM',
  'peakRelativeDisplacementFrequencyHz',
  'strokeRatio',
] as const

describe('analyzeIsolator', () => {
  it('names sdofBaseIsolation v1 and lists assumptions and unsupported effects', () => {
    const a = analyzeIsolator(reference.design, ch)
    expect(VIBRATION_MODEL_ID).toBe('sdofBaseIsolation')
    expect(VIBRATION_MODEL_VERSION).toBe(1)
    expect(a.modelId).toBe('sdofBaseIsolation')
    expect(a.modelVersion).toBe(1)
    expect(a.assumptions).toEqual(VIBRATION_ASSUMPTIONS)
    expect(a.unsupportedEffects).toEqual(VIBRATION_UNSUPPORTED_EFFECTS)
    expect(a.applicable).toBe(true)
    expect(a.warnings).toEqual([])
    expect(a.notApplicableReasons).toEqual([])
  })

  it('returns exactly the documented keys with finite positive numbers', () => {
    const a = analyzeIsolator(reference.design, ch)
    expect(Object.keys(a).sort()).toEqual(
      ['modelId', 'modelVersion', 'applicable', 'warnings', 'notApplicableReasons', 'unsupportedEffects', 'assumptions', 'isolationEfficiency', ...NUMERIC].sort(),
    )
    for (const k of NUMERIC) expect(Number.isFinite(a[k]) && a[k] > 0, k).toBe(true)
    expect(a.stiffnessNPerM).toBe(85000)
    expect(a.dampingRatio).toBe(0.1)
  })

  it('omits isolation efficiency, never a placeholder, when the band is amplified', () => {
    const a = analyzeIsolator(worksheetFixture('baseline').design, ch)
    expect(a.worstInBandTransmissibility).toBeGreaterThan(1)
    expect('isolationEfficiency' in a).toBe(false)
  })

  it('is deep-frozen, deterministic and does not mutate inputs', () => {
    const d = structuredClone(reference.design)
    const before = structuredClone(d)
    const a = analyzeIsolator(d, ch)
    expect(Object.isFrozen(a)).toBe(true)
    expect(Object.isFrozen(a.warnings)).toBe(true)
    expect(analyzeIsolator(d, ch)).toEqual(a)
    expect(d).toEqual(before)
  })

  it('reads stiffness and material from the design and mass, band, Y and stroke from the challenge', () => {
    const a = analyzeIsolator(reference.design, ch)
    const doubleY: VibrationChallenge = { ...ch, excitation: { ...ch.excitation, amplitudeM: 2 * ch.excitation.amplitudeM } }
    expect(analyzeIsolator(reference.design, doubleY).peakRelativeDisplacementM).toBeCloseTo(2 * a.peakRelativeDisplacementM, 15)
    const heavier: VibrationChallenge = { ...ch, component: { massKg: 200 } }
    expect(analyzeIsolator(reference.design, heavier).naturalFrequencyHz).toBeCloseTo(a.naturalFrequencyHz / 2, 12)
    const narrow: VibrationChallenge = { ...ch, excitation: { ...ch.excitation, operatingBandHz: { minHz: 40, maxHz: 50 } } }
    expect(analyzeIsolator(reference.design, narrow).worstInBandFrequencyHz).toBe(40)
  })

  it('places the worst in-band point at the TR peak when resonance is inside the band', () => {
    const a = analyzeIsolator(worksheetFixture('baseline').design, ch)
    expect(a.worstInBandFrequencyHz).toBe(a.peakTransmissibilityFrequencyHz)
    expect(a.worstInBandTransmissibility).toBe(a.peakTransmissibility)
  })

  it('throws a typed invariant error for designs that violate the precondition', () => {
    const bad: VibrationDesign = { id: 'bad', stiffnessNPerM: -1, materialId: 'neoprene' }
    expect(() => analyzeIsolator(bad, ch)).toThrow(VibrationInvariantError)
    try {
      analyzeIsolator(bad, ch)
    } catch (e) {
      expect(e).toBeInstanceOf(PhysicsInvariantError)
      expect(e).toMatchObject({ name: 'VibrationInvariantError', field: 'stiffnessNPerM' })
      expect((e as Error).message).toContain('stiffnessNPerM')
    }
    expect(() => analyzeIsolator({ id: 'x', stiffnessNPerM: 85000, materialId: 'cork' }, ch)).toThrow(/dampingRatio = NaN/)
    expect(() => analyzeIsolator({ id: 'x', stiffnessNPerM: Number.NaN, materialId: 'neoprene' }, ch)).toThrow(/stiffnessNPerM = NaN/)
  })

  it('reports later fields when earlier ones are fine', () => {
    const noStroke: VibrationChallenge = { ...ch, mount: { linearStrokeM: 0 } }
    expect(() => analyzeIsolator(reference.design, noStroke)).toThrow(/strokeRatio/)
  })
})

describe('vibrationResponseCurve', () => {
  it('samples TR over [0, chartMaxHz] from the design snapshot with the configured count', () => {
    const pts = vibrationResponseCurve(reference.design, ch)
    expect(pts).toHaveLength(241)
    expect(pts[0]).toEqual({ frequencyHz: 0, transmissibility: 1 })
    expect(pts.at(-1)?.frequencyHz).toBe(60)
    const a = analyzeIsolator(reference.design, ch)
    expect(pts[100].frequencyHz).toBe(25)
    expect(pts[100].transmissibility).toBeCloseTo(a.worstInBandTransmissibility, 14)
    expect(pts[100].transmissibility).toBe(transmissibility(25 / a.naturalFrequencyHz, 0.1))
    expect(Object.isFrozen(pts)).toBe(true)
    expect(Object.isFrozen(pts[0])).toBe(true)
  })

  it('never returns NaN samples for an invalid design', () => {
    expect(() => vibrationResponseCurve({ id: 'x', stiffnessNPerM: 85000, materialId: 'cork' }, ch)).toThrow(VibrationInvariantError)
    expect(() => vibrationResponseCurve(isolator('x', -5, 0.1), ch)).toThrow(/naturalFrequencyHz/)
  })
})
