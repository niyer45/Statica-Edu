import { describe, expect, it } from 'vitest'
import { evaluateShaft } from '../../src/evaluation/torsion/evaluate'
import { TORSION_PRIMARY_METRIC } from '../../src/evaluation/torsion/metrics'
import { classifyRatio } from '../../src/evaluation/prediction'
import { validateTorsionDesign } from '../../src/geometry/torsion/validate'
import { analyzeShaft } from '../../src/physics/torsion/analyze'
import { torsionApplicabilityMetrics } from '../../src/physics/torsion/applicability'
import {
  relClose,
  shaft,
  solid,
  TORSION_DERIVED,
  TORSION_WORKSHEET,
  TORSION_WORKSHEET_REL_TOL,
  torsionChallenge,
  worksheetFixture,
  type TorsionFixture,
} from './torsion'

// TSH-13: every worksheet row of .kiro/specs/torsion-shaft-1/design.md at 1e-9 relative, plus
// the derived targets and the prediction fixture. Expected values are transcribed constants.

const ch = torsionChallenge()
const RAD_TO_DEG = 180 / Math.PI

function run(f: TorsionFixture) {
  const analysis = analyzeShaft(f.design, ch)
  return { analysis, evaluation: evaluateShaft(f.design, analysis, ch) }
}

const expectRel = (actual: number, expected: number, what: string) =>
  expect(relClose(actual, expected), `${what}: ${actual} vs ${expected}`).toBe(true)

describe('Torsion Shaft I worksheet (TSH-13)', () => {
  it('covers all nine worksheet rows', () => {
    expect(TORSION_WORKSHEET.map((f) => f.name)).toEqual([
      'baseline',
      'solid30',
      'reference',
      'tubeEqualMass',
      'heavySolid',
      'oversizeSolid',
      'oversizeTube',
      'warningSolid',
      'tinySolid',
    ])
  })

  it('uses the worksheet constants G = 79 GPa, ρ = 7850 kg/m³, T = 400 N·m, L = 0.8 m', () => {
    expect(ch.material.shearModulusPa).toBe(79e9)
    expect(ch.material.densityKgM3).toBe(7850)
    expect(ch.torqueNm).toBe(400)
    expect(ch.lengthM).toBe(0.8)
  })

  it.each(TORSION_WORKSHEET.map((f) => [f.name, f] as const))('%s is a valid design (validated before analysis)', (_n, f) => {
    expect(validateTorsionDesign(f.design, ch)).toEqual([])
  })

  it.each(TORSION_WORKSHEET.map((f) => [f.name, f] as const))('%s matches J, φ, τ_max, m and τ/τ_y at 1e-9', (_n, f) => {
    const { analysis } = run(f)
    expectRel(analysis.polarMomentM4, f.expected.polarMomentM4, 'J')
    expectRel(analysis.twistRad, f.expected.twistRad, 'φ rad')
    expectRel(analysis.twistRad * RAD_TO_DEG, f.expected.twistDeg, 'φ deg')
    expectRel(analysis.maxShearStressPa, f.expected.maxShearStressPa, 'τ_max')
    expectRel(analysis.massKg, f.expected.massKg, 'm')
    const ratio = torsionApplicabilityMetrics(f.design, analysis, ch).PLASTICITY_SHEAR
    expectRel(ratio as number, f.expected.plasticityRatio, 'τ/τ_y')
    if (f.expected.slenderness !== undefined) {
      expectRel(torsionApplicabilityMetrics(f.design, analysis, ch).TUBE_SLENDERNESS as number, f.expected.slenderness, 'D/t')
    }
  })

  it.each(TORSION_WORKSHEET.map((f) => [f.name, f] as const))('%s has the worksheet status, failures and applicability', (_n, f) => {
    const { analysis, evaluation } = run(f)
    expect(evaluation.status).toBe(f.expected.status)
    expect(evaluation.accepted).toBe(f.expected.status === 'accepted')
    expect(evaluation.failures).toEqual(f.expected.failures)
    expect(analysis.warnings.map((w) => w.code)).toEqual(f.expected.warningCodes)
    expect(analysis.notApplicableReasons.map((w) => w.code)).toEqual(f.expected.notApplicableCodes)
    expect(analysis.applicable).toBe(f.expected.notApplicableCodes.length === 0)
  })

  it('stores GJ/L consistent with J (k_t = G J / L)', () => {
    for (const f of TORSION_WORKSHEET) {
      const { analysis } = run(f)
      expectRel(analysis.torsionalStiffnessNmPerRad, (79e9 * f.expected.polarMomentM4) / 0.8, `${f.name} k_t`)
    }
  })

  it('the bundled baseline is the worksheet baseline row', () => {
    expect(ch.initialDesign.section).toEqual(worksheetFixture('baseline').design.section)
  })

  it('solid30 mass equals tubeEqualMass mass (equal-area designs)', () => {
    expect(relClose(run(worksheetFixture('solid30')).analysis.massKg, run(worksheetFixture('tubeEqualMass')).analysis.massKg, 1e-12)).toBe(true)
  })
})

describe('derived targets', () => {
  it('the twist limit requires J ≥ T L / (G φ_lim)', () => {
    const jMin = (ch.torqueNm * ch.lengthM) / (ch.material.shearModulusPa * ch.constraints.maxTwistRad)
    expectRel(jMin, TORSION_DERIVED.minPolarMomentM4, 'J_min')
    // A design with exactly J_min sits on the twist limit.
    const dMin = ((32 * TORSION_DERIVED.minPolarMomentM4) / Math.PI) ** 0.25
    expect(Math.abs(dMin - TORSION_DERIVED.minSolidDiameterM)).toBeLessThan(5e-8)
    const mass = ch.material.densityKgM3 * (Math.PI * dMin ** 2 / 4) * ch.lengthM
    expect(Math.abs(mass - TORSION_DERIVED.minSolidMassKg)).toBeLessThan(0.005)
    expect(mass).toBeGreaterThan(ch.constraints.maxMassKg)
  })

  it('no solid design on the 0.5 mm step grid is accepted', () => {
    const r = ch.sectionLimits.circle.diameterM
    const steps = Math.round((r.maxM - r.minM) / r.stepM)
    let twistPasses = 0
    for (let i = 0; i <= steps; i++) {
      const design = shaft('s', solid(r.minM + i * r.stepM))
      expect(validateTorsionDesign(design, ch)).toEqual([])
      const a = analyzeShaft(design, ch)
      const e = evaluateShaft(design, a, ch)
      expect(e.accepted, `D = ${design.section.kind === 'circle' ? design.section.diameterM : ''}`).toBe(false)
      if (!e.failures.includes('twist')) {
        twistPasses++
        expect(e.failures).toContain('mass')
      }
    }
    expect(twistPasses).toBeGreaterThan(0)
  })

  it('prediction fixture: baseline → reference twist ratio is a decrease', () => {
    const prev = run(worksheetFixture('baseline')).analysis
    const next = run(worksheetFixture('reference')).analysis
    const r = (TORSION_PRIMARY_METRIC.read(next) as number) / (TORSION_PRIMARY_METRIC.read(prev) as number)
    expect(relClose(r, TORSION_DERIVED.baselineToReferenceTwistRatio, TORSION_WORKSHEET_REL_TOL)).toBe(true)
    expect(classifyRatio(r)).toBe('decrease')
  })

  it('prediction fixture: solid30 → reference twist ratio is a decrease', () => {
    const prev = run(worksheetFixture('solid30')).analysis
    const next = run(worksheetFixture('reference')).analysis
    const r = (TORSION_PRIMARY_METRIC.read(next) as number) / (TORSION_PRIMARY_METRIC.read(prev) as number)
    expect(relClose(r, TORSION_DERIVED.solid30ToReferenceTwistRatio, TORSION_WORKSHEET_REL_TOL)).toBe(true)
    expect(classifyRatio(r)).toBe('decrease')
  })
})
