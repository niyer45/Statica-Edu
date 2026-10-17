import { describe, expect, it } from 'vitest'
import { evaluateHeatSink } from '../../src/evaluation/heatSink/evaluate'
import { HEAT_SINK_PRIMARY_METRIC } from '../../src/evaluation/heatSink/metrics'
import { classifyRatio } from '../../src/evaluation/prediction'
import { validateHeatSinkDesign } from '../../src/geometry/heatSink/validate'
import { analyzeHeatSink } from '../../src/physics/heatSink/analyze'
import {
  gridDesigns,
  HEAT_SINK_DERIVED,
  HEAT_SINK_WORKSHEET,
  HEAT_SINK_WORKSHEET_REL_TOL,
  heatSink,
  heatSinkChallenge,
  relClose,
  WORKSHEET_BASE_RESISTANCE_K_PER_W,
  worksheetFixture,
  type HeatSinkFixture,
} from './heatSink'

// HSK-13: every worksheet row of .kiro/specs/heat-sink-1/design.md at 1e-9 relative, plus the
// derived targets, the reference profile, the grid enumeration and the prediction fixture.
// Expected values are transcribed constants.

const ch = heatSinkChallenge()
/** °C = K − 273.15 is a display conversion only; used here to check the worksheet °C column. */
const KELVIN_OFFSET = 273.15

function run(f: HeatSinkFixture) {
  const analysis = analyzeHeatSink(f.design, ch)
  return { analysis, evaluation: evaluateHeatSink(f.design, analysis, ch) }
}

const expectRel = (actual: number, expected: number, what: string, rel = HEAT_SINK_WORKSHEET_REL_TOL) =>
  expect(relClose(actual, expected, rel), `${what}: ${actual} vs ${expected}`).toBe(true)

describe('Heat Sink I worksheet (HSK-13)', () => {
  it('covers all eleven worksheet rows', () => {
    expect(HEAT_SINK_WORKSHEET.map((f) => f.name)).toEqual([
      'baseline',
      'reference',
      'eightFins',
      'thickerFins',
      'thickFins',
      'acceptedWarning',
      'tallFins',
      'denseFins',
      'gapWarning',
      'tooDense',
      'deepChannels',
    ])
  })

  it('uses the worksheet inputs k, ρ, W = D, t_b, Q, T∞ and h', () => {
    expect(ch.material.thermalConductivityWPerMK).toBe(200)
    expect(ch.material.densityKgM3).toBe(2700)
    expect(ch.base).toEqual({ widthM: 0.06, depthM: 0.06, thicknessM: 0.004 })
    expect(ch.heatLoadW).toBe(25)
    expect(ch.ambientTemperatureK).toBe(298.15)
    expect(ch.convection.coefficientWPerM2K).toBe(25)
  })

  it.each(HEAT_SINK_WORKSHEET.map((f) => [f.name, f] as const))('%s is a valid design (validated before analysis)', (_n, f) => {
    expect(validateHeatSinkDesign(f.design, ch)).toEqual([])
  })

  it.each(HEAT_SINK_WORKSHEET.map((f) => [f.name, f] as const))('%s matches every geometry column at 1e-9', (_n, f) => {
    const { analysis: a } = run(f)
    const e = f.expected
    expectRel(a.finGapM, e.finGapM, 's')
    expectRel(a.channelAspectRatio, e.channelAspectRatio, 'H/s')
    expectRel(a.finAreaM2, e.finAreaM2, 'A_f')
    expectRel(a.exposedBaseAreaM2, e.exposedBaseAreaM2, 'A_b')
    expectRel(a.totalAreaM2, e.totalAreaM2, 'A_t')
    expectRel(a.finParameterPerM * a.correctedFinLengthM, e.mLc, 'm L_c')
    expectRel(a.finBiotNumber, e.finBiotNumber, 'Bi')
  })

  it.each(HEAT_SINK_WORKSHEET.map((f) => [f.name, f] as const))('%s matches every thermal column at 1e-9', (_n, f) => {
    const { analysis: a } = run(f)
    const e = f.expected
    expectRel(a.baseResistanceKPerW, WORKSHEET_BASE_RESISTANCE_K_PER_W, 'R_base')
    expectRel(a.finEfficiency, e.finEfficiency, 'η_f')
    expectRel(a.overallEfficiency, e.overallEfficiency, 'η_o')
    expectRel(a.convectionResistanceKPerW, e.convectionResistanceKPerW, 'R_conv')
    expectRel(a.baseTemperatureK, e.baseTemperatureK, 'T_base K')
    expectRel(a.baseTemperatureK - KELVIN_OFFSET, e.baseTemperatureC, 'T_base °C')
    expectRel(a.baseTemperatureRiseK, e.baseTemperatureRiseK, 'ΔT')
    expectRel(a.massKg, e.massKg, 'mass')
  })

  it.each(HEAT_SINK_WORKSHEET.map((f) => [f.name, f] as const))('%s has the worksheet status, failures and applicability', (_n, f) => {
    const { analysis, evaluation } = run(f)
    expect(evaluation.status).toBe(f.expected.status)
    expect(evaluation.accepted).toBe(f.expected.status === 'accepted')
    expect(evaluation.failures).toEqual(f.expected.failures)
    expect(analysis.warnings.map((w) => w.code)).toEqual(f.expected.warningCodes)
    expect(analysis.notApplicableReasons.map((w) => w.code)).toEqual(f.expected.notApplicableCodes)
    expect(analysis.applicable).toBe(f.expected.notApplicableCodes.length === 0)
  })

  it('stores R_total, T_s and θ_b consistent with the worksheet R_conv', () => {
    for (const f of HEAT_SINK_WORKSHEET) {
      const { analysis: a } = run(f)
      expectRel(a.totalResistanceKPerW, WORKSHEET_BASE_RESISTANCE_K_PER_W + f.expected.convectionResistanceKPerW, `${f.name} R_total`)
      expectRel(a.finRootExcessK, 25 * f.expected.convectionResistanceKPerW, `${f.name} θ_b`)
      expectRel(a.finnedSurfaceTemperatureK, 298.15 + 25 * f.expected.convectionResistanceKPerW, `${f.name} T_s`)
      expectRel(a.effectiveAreaM2, f.expected.overallEfficiency * f.expected.totalAreaM2, `${f.name} η_o A_t`)
    }
  })

  it('T_base − T_s = Q R_base = 0.13889 K in every row', () => {
    for (const f of HEAT_SINK_WORKSHEET) {
      const { analysis: a } = run(f)
      expect(Math.abs(a.baseTemperatureK - a.finnedSurfaceTemperatureK - 0.13889)).toBeLessThan(5e-6)
    }
  })

  it('stores the constraint limits in SI: 55 °C ↔ 328.15 K, 25 °C ↔ 298.15 K', () => {
    expect(ch.constraints.maxBaseTemperatureK - KELVIN_OFFSET).toBeCloseTo(55, 12)
    expect(ch.ambientTemperatureK - KELVIN_OFFSET).toBeCloseTo(25, 12)
  })
})

describe('derived targets', () => {
  it('prediction fixture: baseline → reference rise ratio is a decrease', () => {
    const prev = run(worksheetFixture('baseline')).analysis
    const next = run(worksheetFixture('reference')).analysis
    const r = (HEAT_SINK_PRIMARY_METRIC.read(next) as number) / (HEAT_SINK_PRIMARY_METRIC.read(prev) as number)
    expectRel(r, HEAT_SINK_DERIVED.baselineToReferenceRiseRatio, 'r')
    expect(classifyRatio(r)).toBe('decrease')
  })

  it('reference fin parameter, corrected length, root excess and stored profile at 1e-9', () => {
    const a = run(worksheetFixture('reference')).analysis
    expectRel(a.finParameterPerM, HEAT_SINK_DERIVED.referenceFinParameterPerM, 'm')
    expectRel(a.correctedFinLengthM, HEAT_SINK_DERIVED.referenceCorrectedLengthM, 'L_c')
    expectRel(a.finRootExcessK, HEAT_SINK_DERIVED.referenceRootExcessK, 'θ_b')
    expect(a.finProfile.map((p) => p.xOverH)).toEqual([0, 0.25, 0.5, 0.75, 1])
    HEAT_SINK_DERIVED.referenceProfile.forEach((p, i) => {
      expectRel(a.finProfile[i].excessRatio, p.excessRatio, `θ/θ_b at ${p.xOverH}`)
      expectRel(a.finProfile[i].temperatureK, p.temperatureK, `T at ${p.xOverH}`)
    })
  })

  it.each(Object.entries(HEAT_SINK_DERIVED.tipRatios))('%s tip ratio θ(H)/θ_b at 1e-9', (name, ratio) => {
    const a = run(worksheetFixture(name)).analysis
    expectRel(a.finProfile[a.finProfile.length - 1].excessRatio, ratio, 'tip')
  })

  it('fin heat share at the baseline and reference', () => {
    expectRel(run(worksheetFixture('baseline')).analysis.finHeatShare, HEAT_SINK_DERIVED.finHeatShare.baseline, 'baseline share')
    expectRel(run(worksheetFixture('reference')).analysis.finHeatShare, HEAT_SINK_DERIVED.finHeatShare.reference, 'reference share')
  })

  it('thicker is a poor trade: reference → thickerFins drops T_base by 0.33170535 K for 28.35 g', () => {
    const r = run(worksheetFixture('reference')).analysis
    const t = run(worksheetFixture('thickerFins')).analysis
    expect(Math.abs(r.baseTemperatureK - t.baseTemperatureK - HEAT_SINK_DERIVED.thickerTrade.temperatureDropK)).toBeLessThan(5e-9)
    expectRel((t.massKg - r.massKg) * 1e3, HEAT_SINK_DERIVED.thickerTrade.massAddedG, 'Δm', 1e-12)
  })

  it('acceptedWarning and denseFins share η_f exactly (η_f depends on t and H only)', () => {
    expect(run(worksheetFixture('acceptedWarning')).analysis.finEfficiency).toBe(run(worksheetFixture('denseFins')).analysis.finEfficiency)
  })
})

describe('grid enumeration (N 2–20, t 1.0–5.0 mm by 0.5, H 5–45 mm by 1)', () => {
  const grid = gridDesigns(ch)
  const valid = grid.filter((d) => validateHeatSinkDesign(d, ch).length === 0)
  const results = valid.map((d) => {
    const analysis = analyzeHeatSink(d, ch)
    return { d, analysis, evaluation: evaluateHeatSink(d, analysis, ch) }
  })

  it('has 5289 valid designs: 80 Accepted, 3894 Not accepted, 1315 Model not applicable', () => {
    expect(grid).toHaveLength(19 * 9 * 41)
    const count = (s: string) => results.filter((r) => r.evaluation.status === s).length
    expect({
      valid: valid.length,
      accepted: count('accepted'),
      notAccepted: count('notAccepted'),
      modelNotApplicable: count('modelNotApplicable'),
    }).toEqual(HEAT_SINK_DERIVED.grid)
  })

  it('every Accepted design has 8 ≤ N ≤ 12, t ≤ 2.0 mm and H ≥ 22 mm', () => {
    for (const { d } of results.filter((r) => r.evaluation.accepted)) {
      expect(d.finCount).toBeGreaterThanOrEqual(8)
      expect(d.finCount).toBeLessThanOrEqual(12)
      expect(d.finThicknessM).toBeLessThanOrEqual(0.002)
      expect(d.finHeightM).toBeGreaterThanOrEqual(0.022)
    }
  })

  it('no design with s ≥ 4 mm is not applicable, and every gap-warned design fails finGap', () => {
    for (const { analysis, evaluation } of results) {
      if (analysis.finGapM >= 0.004) expect(analysis.applicable).toBe(true)
      if (analysis.warnings.some((w) => w.code === 'FIN_GAP') || analysis.notApplicableReasons.some((w) => w.code === 'FIN_GAP')) {
        expect(evaluation.failures).toContain('finGap')
      }
    }
  })

  it('more short fins are not enough: with N ≤ 7 no thickness reaches 55 °C at H = 35 mm', () => {
    const at35 = results.filter((r) => r.d.finCount <= 7 && r.d.finHeightM === 0.035)
    expect(at35.length).toBeGreaterThan(0)
    for (const r of at35) expect(r.evaluation.failures).toContain('baseTemperature')
    const best = Math.min(...at35.filter((r) => r.d.finCount === 7).map((r) => r.analysis.baseTemperatureK))
    expectRel(best - KELVIN_OFFSET, HEAT_SINK_DERIVED.sevenFinsBestTemperatureC, 'N = 7 best °C')
  })

  it('thick fins waste mass: designs with t ≥ 2.5 mm meeting temperature, height and gap all weigh ≥ 144.585 g', () => {
    const meets = results.filter(
      (r) =>
        r.d.finThicknessM >= 0.0025 &&
        ['baseTemperature', 'finHeight', 'finGap'].every((id) => r.evaluation.constraints.find((c) => c.id === id)?.passed),
    )
    // The worksheet's 23 are the designs with s strictly above 4 mm. The inclusive gap rule (HSK-07;
    // thickFins passes at exactly 4 mm) adds the four N = 8, t = 4 mm designs at s = 4 mm (H 32–35 mm).
    const above = meets.filter((r) => r.analysis.finGapM > 0.004 * (1 + 1e-12))
    const atLimit = meets.filter((r) => !above.includes(r))
    expect(above).toHaveLength(HEAT_SINK_DERIVED.thickFinsMeetingOthers.count)
    expect(atLimit.map((r) => [r.d.finCount, r.d.finThicknessM, r.d.finHeightM])).toEqual([
      [8, 0.004, 0.032],
      [8, 0.004, 0.033],
      [8, 0.004, 0.034],
      [8, 0.004, 0.035],
    ])
    const minMassG = Math.min(...meets.map((r) => r.analysis.massKg * 1e3))
    expect(Math.abs(minMassG - HEAT_SINK_DERIVED.thickFinsMeetingOthers.minMassG)).toBeLessThan(5e-4)
    for (const r of meets) expect(r.evaluation.failures).toEqual(['mass'])
  })

  it('N = 20, t = 2 mm (s = 1.0526 mm) is valid, analyzable and not applicable by FIN_GAP', () => {
    const d = heatSink('n20', 20, 0.002, 0.005)
    expect(validateHeatSinkDesign(d, ch)).toEqual([])
    const a = analyzeHeatSink(d, ch)
    expectRel(a.finGapM, 0.00105263157894737, 's')
    expect(a.notApplicableReasons.map((i) => i.code)).toEqual(['FIN_GAP'])
  })
})
