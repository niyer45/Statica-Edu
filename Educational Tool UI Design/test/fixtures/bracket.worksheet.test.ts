import { describe, expect, it } from 'vitest'
import { evaluateBracket } from '../../src/evaluation/bracket/evaluate'
import { BRACKET_PRIMARY_METRIC } from '../../src/evaluation/bracket/metrics'
import { classifyRatio } from '../../src/evaluation/prediction'
import { validateBracketDesign } from '../../src/geometry/bracket/validate'
import { analyzeBracket } from '../../src/physics/bracket/analyze'
import { bracketApplicabilityMetrics } from '../../src/physics/bracket/applicability'
import { ktPolynomial, shoulderRatios } from '../../src/physics/bracket/kt'
import {
  bracket,
  BRACKET_DERIVED,
  BRACKET_UPPER_BRANCH_KT,
  BRACKET_WORKSHEET,
  bracketChallenge,
  gridValues,
  relClose,
  worksheetFixture,
  type BracketFixture,
} from './bracket'

// MBR-17: every worksheet row of .kiro/specs/mounting-bracket-1/design.md (including the K-4
// fixtures smallStepNA and smallStepBoundary) at 1e-9 relative, plus the derived targets and the
// prediction fixture. Expected values are transcribed constants.

const ch = bracketChallenge()

function run(f: BracketFixture) {
  const analysis = analyzeBracket(f.design, ch)
  return { analysis, evaluation: evaluateBracket(f.design, analysis, ch) }
}

const expectRel = (actual: number | undefined, expected: number, what: string) =>
  expect(actual !== undefined && relClose(actual, expected), `${what}: ${actual} vs ${expected}`).toBe(true)

const STEP_KEYS = ['stepMomentNm', 'stepNominalStressPa', 'heightToRadiusRatio', 'stepRatio', 'ktBranch', 'ktStep', 'stepPeakStressPa'] as const
const KT_KEYS = ['ktBranch', 'ktStep', 'stepPeakStressPa', 'peakStressPa', 'peakLocation'] as const
const rows = BRACKET_WORKSHEET.map((f) => [f.name, f] as const)

describe('Mounting Bracket I worksheet (MBR-17)', () => {
  it('covers all sixteen worksheet rows and both K-4 fixtures', () => {
    expect(BRACKET_WORKSHEET.map((f) => f.name)).toEqual([
      'baseline',
      'reference',
      'filletOnly',
      'stepOnly',
      'thickAll',
      'uniformDeep',
      'uniformLimit',
      'rootGoverned',
      'rootToStep',
      'ratioWarning',
      'ratioNA',
      'fitShallowNA',
      'shoulderNA',
      'plasticWarning',
      'plasticNA',
      'oversize',
      'smallStepNA',
      'smallStepBoundary',
    ])
  })

  it('uses the worksheet constants E = 69 GPa, ρ = 2700 kg/m³, σ_y = 240 MPa, F = 300 N, L = 0.3 m, b = 10 mm', () => {
    expect(ch.material.elasticModulusPa).toBe(69e9)
    expect(ch.material.densityKgM3).toBe(2700)
    expect(ch.material.yieldStressPa).toBe(240e6)
    expect(ch.load.forceN).toBe(300)
    expect(ch.lengthM).toBe(0.3)
    expect(ch.thicknessM).toBe(0.01)
  })

  it.each(rows)('%s is a valid design (validated before analysis)', (_n, f) => {
    expect(validateBracketDesign(f.design, ch)).toEqual([])
  })

  it.each(rows)('%s matches every quoted stress, Kt, deflection, mass and ratio at 1e-9', (_n, f) => {
    const { analysis: a } = run(f)
    const x = f.expected
    const metrics = bracketApplicabilityMetrics(f.design, a, ch)
    if (x.rootStressPa !== undefined) expectRel(a.rootStressPa, x.rootStressPa, 'σ_root')
    if (x.stepNominalStressPa !== undefined) expectRel(a.stepNominalStressPa, x.stepNominalStressPa, 'σ_step,nom')
    if (x.kt !== undefined) expectRel(a.ktStep, x.kt, 'Kt')
    if (x.stepPeakStressPa !== undefined) expectRel(a.stepPeakStressPa, x.stepPeakStressPa, 'σ_step')
    if (x.peakStressPa !== undefined) expectRel(a.peakStressPa, x.peakStressPa, 'σ_peak')
    if (x.peakLocation !== undefined) expect(a.peakLocation).toBe(x.peakLocation)
    if (x.plasticityRatio !== undefined) expectRel(metrics.PLASTICITY, x.plasticityRatio, 'σ_peak/σ_y')
    if (x.tipDeflectionM !== undefined) expectRel(a.tipDeflectionM, x.tipDeflectionM, 'δ_tip')
    if (x.massKg !== undefined) expectRel(a.massKg, x.massKg, 'm')
    if (x.heightToRadiusRatio !== undefined) {
      expectRel(a.heightToRadiusRatio, x.heightToRadiusRatio, 'h/r')
      expectRel(metrics.KT_FIT_SHARP, x.heightToRadiusRatio, 'KT_FIT_SHARP metric')
    }
    if (x.stepRatio !== undefined) {
      expectRel(a.stepRatio, x.stepRatio, 'D/d')
      expectRel(metrics.KT_STEP_RATIO, x.stepRatio, 'KT_STEP_RATIO metric')
    }
    if (x.shoulderMetric !== undefined) expectRel(metrics.KT_SHOULDER_LENGTH, x.shoulderMetric, 'shoulder metric')
    expect(a.envelopeDepthM).toBe(f.design.rootDepthM)
  })

  it.each(rows)('%s has the worksheet status, failures, applicability and absent quantities', (_n, f) => {
    const { analysis: a, evaluation: e } = run(f)
    const x = f.expected
    expect(e.status).toBe(x.status)
    expect(e.accepted).toBe(x.status === 'accepted')
    expect(e.failures).toEqual(x.failures)
    expect(a.warnings.map((w) => w.code)).toEqual(x.warningCodes)
    expect(a.notApplicableReasons.map((w) => w.code)).toEqual(x.notApplicableCodes)
    expect(a.applicable).toBe(x.notApplicableCodes.length === 0)
    // Absent quantities are omitted keys, never NaN or undefined values (MBR-12, MBR-13, MM-10).
    if (x.uniform) for (const k of STEP_KEYS) expect(Object.prototype.hasOwnProperty.call(a, k), k).toBe(false)
    if (x.ktUndefined) {
      for (const k of KT_KEYS) expect(Object.prototype.hasOwnProperty.call(a, k), k).toBe(false)
      expect(a.status).toBe('ktFitUndefined')
      expect(e.constraints[0]).toEqual({ id: 'peakStress', label: 'Peak stress', limit: 120e6, unit: 'Pa', passed: false })
    } else {
      expect(a.status).toBe('solved')
    }
    for (const v of Object.values(a)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true)
  })

  it('reports the K-4 fixtures as specified', () => {
    const na = run(worksheetFixture('smallStepNA'))
    // Like ratioNA, the computed values are kept and the status is not applicable.
    expect(na.analysis.status).toBe('solved')
    expect(na.analysis.peakLocation).toBe('step')
    expect(na.evaluation.accepted).toBe(false)
    const f = worksheetFixture('smallStepBoundary')
    const boundary = run(f)
    // 1.1 / (33/30) is 1 within REL_TOL; the screen is inclusive with no warning band.
    expect(bracketApplicabilityMetrics(f.design, boundary.analysis, ch).KT_SMALL_STEP).toBeCloseTo(1, 12)
    expect(boundary.analysis.notApplicableReasons).toEqual([])
  })

  it('applies the lower branch at h/r = 2; the upper-branch references differ', () => {
    for (const [name, upper] of Object.entries(BRACKET_UPPER_BRANCH_KT)) {
      const f = worksheetFixture(name)
      const a = run(f).analysis
      expect(a.ktBranch, name).toBe('lower')
      const r = shoulderRatios(f.design.rootDepthM, f.design.armDepthM, f.design.filletRadiusM)
      expect(relClose(ktPolynomial(r.heightToRadiusRatio, r.depthFraction, 'upper'), upper), name).toBe(true)
      expect(Math.abs((a.ktStep as number) - upper)).toBeGreaterThan(1e-3)
    }
    // filletOnly computes h/r just below 2; rootToStep is exactly 2 (worksheet notes).
    expect(run(worksheetFixture('filletOnly')).analysis.heightToRadiusRatio).toBe(1.9999999999999996)
  })
})

describe('derived targets', () => {
  const F = ch.load.forceN
  const L = ch.lengthM
  const b = ch.thicknessM
  const E = ch.material.elasticModulusPa
  const rho = ch.material.densityKgM3
  const k = ch.constraints

  it('quotes the uniform depths for the deflection, mass and stress limits (test-side closed forms)', () => {
    expect(relClose((4 * F * L ** 3 / (E * b * k.maxTipDeflectionM)) ** (1 / 3), BRACKET_DERIVED.uniformDeflectionDepthM)).toBe(true)
    expect(relClose(rho * b * BRACKET_DERIVED.uniformDeflectionDepthM * L, BRACKET_DERIVED.uniformDeflectionMassKg)).toBe(true)
    expect(BRACKET_DERIVED.uniformDeflectionMassKg).toBeGreaterThan(k.maxMassKg)
    expect(relClose(k.maxMassKg / (rho * b * L), BRACKET_DERIVED.uniformMassDepthM)).toBe(true)
    expect(relClose(Math.sqrt(6 * F * L / (b * k.maxPeakStressPa)), BRACKET_DERIVED.uniformStressDepthM)).toBe(true)
  })

  it('no uniform bar on the configured grid is accepted', () => {
    let deflectionPasses = 0
    for (const D of gridValues(ch.designLimits.rootDepthM)) {
      const d = bracket('u', D, D, 0.15, 0.001)
      expect(validateBracketDesign(d, ch)).toEqual([])
      const a = analyzeBracket(d, ch)
      const e = evaluateBracket(d, a, ch)
      expect(e.accepted, `D = ${D}`).toBe(false)
      if (!e.failures.includes('tipDeflection')) {
        deflectionPasses++
        expect(e.failures).toContain('mass')
      }
    }
    expect(deflectionPasses).toBeGreaterThan(0)
  })

  it('from the baseline, r = 2.5 mm is the smallest passing radius at a = 150 mm', () => {
    const at = (r: number) => run({ ...worksheetFixture('baseline'), design: bracket('r', 0.03, 0.02, 0.15, r) }).evaluation
    expect(at(BRACKET_DERIVED.minPassingRadiusM).accepted).toBe(true)
    for (const r of gridValues(ch.designLimits.filletRadiusM).filter((v) => v < BRACKET_DERIVED.minPassingRadiusM)) {
      expect(at(r).failures, `r = ${r}`).toEqual(['peakStress'])
    }
  })

  it('from the baseline, a = 190 mm is the smallest passing step location at r = 1 mm', () => {
    const at = (a: number) => run({ ...worksheetFixture('baseline'), design: bracket('a', 0.03, 0.02, a, 0.001) }).evaluation
    expect(at(BRACKET_DERIVED.minPassingStepM).accepted).toBe(true)
    for (const a of gridValues(ch.designLimits.stepLocationM).filter((v) => v < BRACKET_DERIVED.minPassingStepM - 1e-12)) {
      expect(at(a).accepted, `a = ${a}`).toBe(false)
      expect(at(a).failures, `a = ${a}`).toContain('peakStress')
    }
  })

  it('prediction fixture: baseline → reference peak stress ratio is a decrease', () => {
    const prev = run(worksheetFixture('baseline')).analysis
    const next = run(worksheetFixture('reference')).analysis
    const r = (BRACKET_PRIMARY_METRIC.read(next) as number) / (BRACKET_PRIMARY_METRIC.read(prev) as number)
    expect(relClose(r, BRACKET_DERIVED.baselineToReferencePeakRatio)).toBe(true)
    expect(classifyRatio(r)).toBe('decrease')
  })

  it('bounds the neglected fillet mass: 2 b ρ r² (1 − π/4) at r = 10 mm is 0.54% of the mass limit', () => {
    const r = ch.designLimits.filletRadiusM.maxM
    const g = 2 * b * rho * r ** 2 * (1 - Math.PI / 4) * 1000
    expect(relClose(g, BRACKET_DERIVED.maxFilletMassG)).toBe(true)
    expect(g / 1000 / k.maxMassKg).toBeLessThan(0.0055)
  })
})
