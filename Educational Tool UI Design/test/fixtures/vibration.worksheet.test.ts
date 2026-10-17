import { describe, expect, it } from 'vitest'
import { classifyRatio } from '../../src/evaluation/prediction'
import { evaluateIsolator } from '../../src/evaluation/vibration/evaluate'
import { VIBRATION_PRIMARY_METRIC } from '../../src/evaluation/vibration/metrics'
import { validateVibrationDesign } from '../../src/geometry/vibration/validate'
import { analyzeIsolator } from '../../src/physics/vibration/analyze'
import { STANDARD_GRAVITY_MS2 } from '../../src/physics/vibration/constants'
import {
  relativeDisplacementPeakRatio,
  relativeDisplacementRatio,
  transmissibility,
  transmissibilityPeakRatio,
} from '../../src/physics/vibration/response'
import {
  isolator,
  MATERIAL_BY_ZETA,
  relClose,
  VIBRATION_DERIVED,
  VIBRATION_MATERIAL_TABLE,
  VIBRATION_WORKSHEET,
  vibrationChallenge,
  worksheetFixture,
  type VibrationFixture,
} from './vibration'

// VIB-13: every worksheet row of .kiro/specs/vibration-isolation-1/design.md at 1e-9 relative,
// plus the per-material table, the derived targets, the 125-design grid scan and the prediction
// fixtures. Expected values are transcribed constants.

const ch = vibrationChallenge()

function run(f: VibrationFixture) {
  const analysis = analyzeIsolator(f.design, ch)
  return { analysis, evaluation: evaluateIsolator(f.design, analysis, ch) }
}

const expectRel = (actual: number, expected: number, what: string) =>
  expect(relClose(actual, expected), `${what}: ${actual} vs ${expected}`).toBe(true)

describe('Vibration Isolation I worksheet (VIB-13)', () => {
  it('covers all fifteen worksheet rows', () => {
    expect(VIBRATION_WORKSHEET.map((f) => f.name)).toEqual([
      'baseline',
      'reference',
      'lightSpring',
      'lightRubber',
      'dampedReference',
      'heavyAtSag',
      'heavySoft',
      'stiffHeavy',
      'sagBoundary',
      'sagOnGridFail',
      'isoBoundary',
      'isoOnGridFail',
      'softWarning',
      'tooSoftLight',
      'tooSoftHeavy',
    ])
  })

  it('uses the worksheet constants m = 50 kg, g = 9.80665, band 25–50 Hz, Y = 0.2 mm, stroke 20 mm', () => {
    expect(ch.component.massKg).toBe(50)
    expect(STANDARD_GRAVITY_MS2).toBe(9.80665)
    expect(ch.excitation.operatingBandHz).toEqual({ minHz: 25, maxHz: 50 })
    expect(ch.excitation.amplitudeM).toBe(2e-4)
    expect(ch.mount.linearStrokeM).toBe(0.02)
    for (const [zeta, id] of Object.entries(MATERIAL_BY_ZETA)) {
      expect(ch.materials.find((m) => m.id === id)?.dampingRatio).toBe(Number(zeta))
    }
  })

  it.each(VIBRATION_WORKSHEET.map((f) => [f.name, f] as const))('%s is a valid design (validated before analysis)', (_n, f) => {
    expect(validateVibrationDesign(f.design, ch)).toEqual([])
  })

  it.each(VIBRATION_WORKSHEET.map((f) => [f.name, f] as const))('%s matches f_n, TR_worst @ f, TR_peak, δ_st, Z_peak and the stroke ratio at 1e-9', (_n, f) => {
    const { analysis: a } = run(f)
    expectRel(a.naturalFrequencyHz, f.expected.naturalFrequencyHz, 'f_n')
    expectRel(a.worstInBandTransmissibility, f.expected.worstInBandTransmissibility, 'TR_worst')
    expectRel(a.worstInBandFrequencyHz, f.expected.worstInBandFrequencyHz, 'f_worst')
    expectRel(a.peakTransmissibility, f.expected.peakTransmissibility, 'TR_peak')
    expectRel(a.staticDeflectionM, f.expected.staticDeflectionM, 'δ_st')
    expectRel(a.peakRelativeDisplacementM, f.expected.peakRelativeDisplacementM, 'Z_peak')
    expectRel(a.strokeRatio, f.expected.strokeRatio, 'stroke ratio')
  })

  it.each(VIBRATION_WORKSHEET.filter((f) => f.expected.secondary).map((f) => [f.name, f] as const))(
    '%s matches c, r_min, r_max, f_peak and f_Zpeak at 1e-9',
    (_n, f) => {
      const { analysis: a } = run(f)
      const s = f.expected.secondary!
      expectRel(a.dampingCoefficientNsPerM, s.dampingCoefficientNsPerM, 'c')
      expectRel(a.frequencyRatioAtBandMin, s.frequencyRatioAtBandMin, 'r_min')
      expectRel(a.frequencyRatioAtBandMax, s.frequencyRatioAtBandMax, 'r_max')
      expectRel(a.peakTransmissibilityFrequencyHz, s.peakTransmissibilityFrequencyHz, 'f_peak')
      expectRel(a.peakRelativeDisplacementFrequencyHz, s.peakRelativeDisplacementFrequencyHz, 'f_Zpeak')
    },
  )

  it.each(VIBRATION_WORKSHEET.map((f) => [f.name, f] as const))('%s has the worksheet status, failures and applicability', (_n, f) => {
    const { analysis, evaluation } = run(f)
    expect(evaluation.status).toBe(f.expected.status)
    expect(evaluation.accepted).toBe(f.expected.status === 'accepted')
    expect(evaluation.failures).toEqual(f.expected.failures)
    expect(analysis.warnings.map((w) => w.code)).toEqual(f.expected.warningCodes)
    expect(analysis.notApplicableReasons.map((w) => w.code)).toEqual(f.expected.notApplicableCodes)
    expect(analysis.applicable).toBe(f.expected.notApplicableCodes.length === 0)
  })

  it('stores isolation efficiency 1 − TR only when the band is isolated (TR_worst < 1)', () => {
    for (const f of VIBRATION_WORKSHEET) {
      const { analysis: a } = run(f)
      if (f.expected.worstInBandTransmissibility < 1) {
        expectRel(a.isolationEfficiency as number, 1 - f.expected.worstInBandTransmissibility, `${f.name} η`)
      } else {
        expect(Object.prototype.hasOwnProperty.call(a, 'isolationEfficiency'), f.name).toBe(false)
      }
    }
  })

  it('reports the band-edge worst frequency exactly for isolating designs', () => {
    expect(run(worksheetFixture('reference')).analysis.worstInBandFrequencyHz).toBe(25)
  })
})

describe('per-material values and feasible windows', () => {
  it.each(VIBRATION_MATERIAL_TABLE.map((r) => [r.zeta, r] as const))('ζ = %s matches r_p, TR_peak, r_z, Z_peak/Y at 1e-9', (_z, r) => {
    expectRel(transmissibilityPeakRatio(r.zeta), r.rP, 'r_p')
    expectRel(transmissibility(r.rP, r.zeta), r.peakTransmissibility, 'TR_peak')
    expectRel(relativeDisplacementPeakRatio(r.zeta), r.rZ, 'r_z')
    expectRel(relativeDisplacementRatio(r.rZ, r.zeta), r.zPeakOverY, 'Z/Y peak')
  })

  it.each(VIBRATION_MATERIAL_TABLE.map((r) => [r.zeta, r] as const))('ζ = %s: TR(r_iso) = 0.12, f_n,max = 25/r_iso and k_max = m(2π f_n,max)²', (_z, r) => {
    expectRel(transmissibility(r.rIso, r.zeta), 0.12, 'TR(r_iso)')
    expectRel(25 / r.rIso, r.fnMaxHz, 'f_n,max')
    expectRel(ch.component.massKg * (2 * Math.PI * r.fnMaxHz) ** 2, r.kMaxNPerM, 'k_max')
  })

  it('peak TR and Z_peak are independent of k for every configured design (f_n·r_p < 50 Hz)', () => {
    for (const r of VIBRATION_MATERIAL_TABLE) {
      for (const k of [ch.stiffnessLimits.minNPerM, 85000, ch.stiffnessLimits.maxNPerM]) {
        const a = analyzeIsolator(isolator('k', k, r.zeta), ch)
        expectRel(a.peakTransmissibility, r.peakTransmissibility, `TR_peak ζ=${r.zeta} k=${k}`)
        expectRel(a.peakRelativeDisplacementM, r.zPeakOverY * ch.excitation.amplitudeM, `Z_peak ζ=${r.zeta} k=${k}`)
      }
    }
  })

  it('a brute-force scan of the 0.5 kN/m grid accepts exactly 125 designs: 102 neoprene and 23 butyl', () => {
    const k = ch.stiffnessLimits
    const steps = Math.round((k.maxNPerM - k.minNPerM) / k.stepNPerM)
    let total = 0
    for (const r of VIBRATION_MATERIAL_TABLE) {
      const accepted: number[] = []
      for (let i = 0; i <= steps; i++) {
        const d = isolator('g', k.minNPerM + i * k.stepNPerM, r.zeta)
        const a = analyzeIsolator(d, ch)
        if (evaluateIsolator(d, a, ch).accepted) accepted.push(d.stiffnessNPerM / 1e3)
      }
      expect(accepted.length, `ζ = ${r.zeta}`).toBe(r.gridCount)
      if (r.gridWindowKNPerM) expect([accepted[0], accepted.at(-1)]).toEqual([...r.gridWindowKNPerM])
      total += accepted.length
    }
    expect(total).toBe(VIBRATION_DERIVED.acceptedGridDesigns)
  })
})

describe('derived targets', () => {
  it('the sag limit requires k ≥ m g/δ_lim, that is f_n ≥ (1/2π)√(g/δ_lim)', () => {
    const delta = ch.constraints.maxStaticDeflectionM
    expectRel((ch.component.massKg * STANDARD_GRAVITY_MS2) / delta, VIBRATION_DERIVED.sagFloorNPerM, 'k floor')
    expectRel(Math.sqrt(STANDARD_GRAVITY_MS2 / delta) / (2 * Math.PI), VIBRATION_DERIVED.sagFloorHz, 'f_n floor')
  })

  it('the stiffness range spans f_n = 3.18–31.83 Hz', () => {
    const lo = analyzeIsolator(isolator('lo', ch.stiffnessLimits.minNPerM, 0.1), ch)
    const hi = analyzeIsolator(isolator('hi', ch.stiffnessLimits.maxNPerM, 0.1), ch)
    expectRel(lo.naturalFrequencyHz, VIBRATION_DERIVED.fnRangeHz[0], 'f_n min')
    expectRel(hi.naturalFrequencyHz, VIBRATION_DERIVED.fnRangeHz[1], 'f_n max')
  })

  it('places the SPRING_STROKE boundaries at the worksheet stiffnesses, below the sag floor', () => {
    const ratio = (k: number, zeta: 0.02 | 0.3) => analyzeIsolator(isolator('s', k, zeta), ch).strokeRatio
    expectRel(ratio(VIBRATION_DERIVED.strokeWarningNPerM[0.02], 0.02), 0.8, 'warning ζ=0.02')
    expectRel(ratio(VIBRATION_DERIVED.strokeWarningNPerM[0.3], 0.3), 0.8, 'warning ζ=0.30')
    expectRel(ratio(VIBRATION_DERIVED.strokeNotApplicableNPerM[0.02], 0.02), 1, 'not applicable ζ=0.02')
    expectRel(ratio(VIBRATION_DERIVED.strokeNotApplicableNPerM[0.3], 0.3), 1, 'not applicable ζ=0.30')
    for (const k of Object.values(VIBRATION_DERIVED.strokeWarningNPerM)) expect(k).toBeLessThan(VIBRATION_DERIVED.sagFloorNPerM)
  })

  it.each([
    ['baseline', 'reference', VIBRATION_DERIVED.prediction.baselineToReference, 'decrease'],
    ['reference', 'dampedReference', VIBRATION_DERIVED.prediction.referenceToDampedReference, 'increase'],
    ['reference', 'lightSpring', VIBRATION_DERIVED.prediction.referenceToLightSpring, 'decrease'],
  ] as const)('prediction fixture: %s → %s ratio and direction', (from, to, expected, direction) => {
    const prev = run(worksheetFixture(from)).analysis
    const next = run(worksheetFixture(to)).analysis
    const r = (VIBRATION_PRIMARY_METRIC.read(next) as number) / (VIBRATION_PRIMARY_METRIC.read(prev) as number)
    expectRel(r, expected, `${from} → ${to}`)
    expect(classifyRatio(r)).toBe(direction)
  })
})
