import { describe, expect, it } from 'vitest'
import { evaluateBracket } from '../../src/evaluation/bracket/evaluate'
import { BRACKET_PRIMARY_METRIC } from '../../src/evaluation/bracket/metrics'
import { classifyRatio } from '../../src/evaluation/prediction'
import { BRACKET_PARAMS } from '../../src/geometry/bracket/design'
import { validateBracketDesign } from '../../src/geometry/bracket/validate'
import { analyzeBracket } from '../../src/physics/bracket/analyze'
import { bracketApplicabilityMetrics } from '../../src/physics/bracket/applicability'
import {
  bracket,
  BRACKET_BEND_MOMENT_NM,
  BRACKET_DERIVED,
  BRACKET_WORKSHEET,
  bracketChallenge,
  gridValues,
  relClose,
  worksheetFixture,
  type BracketFixture,
} from './bracket'

// Task 55: every worksheet row of the bolted L-bracket at 1e-9 relative, the baseline/reference
// requirements (the baseline fails every check it can while valid and applicable; the reference
// passes all), the trade-off on the configured grid and the prediction fixture. Expected values
// are transcribed constants from a standalone hand calculation.

const ch = bracketChallenge()

function run(f: BracketFixture) {
  const analysis = analyzeBracket(f.design, ch)
  return { analysis, evaluation: evaluateBracket(f.design, analysis, ch) }
}

const expectRel = (actual: number, expected: number, what: string) =>
  expect(relClose(actual, expected), `${what}: ${actual} vs ${expected}`).toBe(true)

const rows = BRACKET_WORKSHEET.map((f) => [f.name, f] as const)

describe('Mounting Bracket I worksheet (bolted L-bracket)', () => {
  it('covers the worksheet rows', () => {
    expect(BRACKET_WORKSHEET.map((f) => f.name)).toEqual([
      'baseline',
      'reference',
      'thicknessOnly',
      'radiusOnly',
      'flangeOnly',
      'widthOnly',
      'oversized',
      'sharpThick',
      'curvedBoundary',
      'legSpanWarning',
      'legSpanNA',
      'plasticNA',
    ])
  })

  it('uses the worksheet constants', () => {
    expect(ch.material.elasticModulusPa).toBe(69e9)
    expect(ch.material.densityKgM3).toBe(2700)
    expect(ch.material.yieldStressPa).toBe(240e6)
    expect(ch.load.forceN).toBe(200)
    expect(ch.loadOffsetM).toBe(0.12)
    expect(ch.tipOverhangM).toBe(0.015)
    expect(ch.bolts).toEqual({ count: 2, edgeDistanceM: 0.015 })
    expect(ch.constraints).toEqual({ maxBendStressPa: 120e6, maxDeflectionM: 0.0024, maxBoltTensionN: 300, maxMassKg: 0.175 })
  })

  it('the challenge baseline and reference are the worksheet rows', () => {
    expect(ch.initialDesign).toEqual({ ...worksheetFixture('baseline').design, id: 'baseline' })
    expect(ch.referenceDesign).toEqual({ ...worksheetFixture('reference').design, id: 'reference' })
  })

  it.each(rows)('%s is a valid design (validated before analysis)', (_n, f) => {
    expect(validateBracketDesign(f.design, ch)).toEqual([])
  })

  it.each(rows)('%s matches every quoted stress, factor, deflection, bolt force, mass and ratio at 1e-9', (_n, f) => {
    const { analysis: a } = run(f)
    const x = f.expected
    const m = bracketApplicabilityMetrics(f.design, a, ch)
    expect(a.bendMomentNm).toBe(BRACKET_BEND_MOMENT_NM)
    expectRel(a.nominalBendStressPa, x.nominalBendStressPa, 'σ_nominal')
    expectRel(a.curvedBeamFactor, x.curvedBeamFactor, 'k_i')
    expectRel(a.bendStressPa, x.bendStressPa, 'σ_bend')
    expectRel(a.bendRadiusRatio, x.bendRadiusRatio, 'R/c')
    expectRel(a.armDeflectionM, x.armDeflectionM, 'δ_arm')
    expectRel(a.flangeRotationDeflectionM, x.flangeRotationDeflectionM, 'δ_flange')
    expectRel(a.deflectionM, x.deflectionM, 'δ')
    expectRel(a.boltLeverArmM, x.boltLeverArmM, 'h_b')
    expectRel(a.boltTensionN, x.boltTensionN, 'T')
    expectRel(a.massKg, x.massKg, 'm')
    expectRel(m.PLASTICITY, x.plasticityRatio, 'σ/σ_y')
    expectRel(m.LARGE_DEFLECTION, x.deflectionRatio, 'δ/a')
    expectRel(m.LEG_SPAN, x.legSpanRatio, 't/h_b')
  })

  it.each(rows)('%s has the worksheet status, failures and applicability', (_n, f) => {
    const { analysis: a, evaluation: e } = run(f)
    const x = f.expected
    expect(e.status).toBe(x.status)
    expect(e.accepted).toBe(x.status === 'accepted')
    expect(e.failures).toEqual(x.failures)
    expect(a.warnings.map((w) => w.code)).toEqual(x.warningCodes)
    expect(a.notApplicableReasons.map((w) => w.code)).toEqual(x.notApplicableCodes)
    expect(a.applicable).toBe(x.notApplicableCodes.length === 0)
    for (const v of Object.values(a)) if (typeof v === 'number') expect(Number.isFinite(v) && v > 0).toBe(true)
  })

  it('R/c = 1.2 is inside the inclusive curved-beam range', () => {
    const f = worksheetFixture('curvedBoundary')
    const a = run(f).analysis
    expect(bracketApplicabilityMetrics(f.design, a, ch).CURVED_BEAM_RANGE).toBeCloseTo(1, 12)
    expect(a.notApplicableReasons).toEqual([])
  })
})

describe('baseline and reference requirements', () => {
  it('the baseline fails all four numeric checks while staying in range and applicable', () => {
    const { analysis, evaluation } = run(worksheetFixture('baseline'))
    expect(validateBracketDesign(ch.initialDesign, ch)).toEqual([])
    expect(analysis.applicable).toBe(true)
    expect(evaluation.status).toBe('notAccepted')
    // Applicability is the only check left passing: failing it would make every other result untrustworthy.
    expect(evaluation.constraints.filter((c) => c.passed).map((c) => c.id)).toEqual(['applicability'])
  })

  it('the reference passes every check with margin', () => {
    const { evaluation } = run(worksheetFixture('reference'))
    expect(evaluation.accepted).toBe(true)
    for (const c of evaluation.constraints.filter((x) => x.unit !== 'bool')) expect(c.utilization, c.id).toBeLessThan(0.9)
  })

  it('no single-dimension change from the baseline is Accepted (a real trade-off)', () => {
    for (const param of BRACKET_PARAMS) {
      for (const v of gridValues(ch.designLimits[param])) {
        const d = { ...ch.initialDesign, [param]: v }
        const e = evaluateBracket(d, analyzeBracket(d, ch), ch)
        expect(e.accepted, `${param} = ${v}`).toBe(false)
      }
    }
  })

  it('accepted designs exist on the configured grid, and adding material everywhere fails the mass limit', () => {
    const L = ch.designLimits
    let accepted = 0
    // A coarse sub-grid of the control grid (t every 1 mm, w every 10 mm, H every 5 mm, r every 2 mm).
    for (const t of gridValues(L.thicknessM).filter((_, i) => i % 2 === 0))
      for (const w of gridValues(L.widthM).filter((_, i) => i % 10 === 0))
        for (const H of gridValues(L.flangeHeightM))
          for (const r of gridValues(L.innerRadiusM).filter((_, i) => i % 4 === 0)) {
            const d = bracket('g', t, w, H, r)
            if (evaluateBracket(d, analyzeBracket(d, ch), ch).accepted) accepted++
          }
    expect(accepted).toBeGreaterThan(10)
    const big = bracket('big', L.thicknessM.maxM, L.widthM.maxM, L.flangeHeightM.maxM, L.innerRadiusM.maxM)
    const e = evaluateBracket(big, analyzeBracket(big, ch), ch)
    expect(e.failures).toEqual(['mass'])
    expect(run(worksheetFixture('oversized')).evaluation.failures).toEqual(['mass'])
  })

  it('prediction fixture: baseline → reference bend stress ratio is a decrease', () => {
    const prev = run(worksheetFixture('baseline')).analysis
    const next = run(worksheetFixture('reference')).analysis
    const r = (BRACKET_PRIMARY_METRIC.read(next) as number) / (BRACKET_PRIMARY_METRIC.read(prev) as number)
    expect(relClose(r, BRACKET_DERIVED.baselineToReferenceStressRatio)).toBe(true)
    expect(classifyRatio(r)).toBe('decrease')
  })
})
