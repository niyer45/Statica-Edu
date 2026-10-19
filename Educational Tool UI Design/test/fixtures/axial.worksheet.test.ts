import { describe, expect, it } from 'vitest'
import { evaluateRod } from '../../src/evaluation/axial/evaluate'
import { AXIAL_PRIMARY_METRIC } from '../../src/evaluation/axial/metrics'
import { classifyRatio } from '../../src/evaluation/prediction'
import { validateAxialDesign } from '../../src/geometry/axial/validate'
import { analyzeRod } from '../../src/physics/axial/analyze'
import { AXIAL_DERIVED, AXIAL_WORKSHEET, axialChallenge, gridDesigns, relClose, rod, worksheetFixture, type AxialFixture } from './axial'

// SSR-13: every worksheet row of .kiro/specs/stress-strain-1/design.md at 1e-9 relative, plus the
// derived limits, the accepted grid designs and the prediction fixture. Expected values are
// transcribed constants from the independent worksheet script.

const ch = axialChallenge()

function run(f: AxialFixture) {
  const analysis = analyzeRod(f.design, ch)
  return { analysis, evaluation: evaluateRod(f.design, analysis, ch) }
}

const expectRel = (actual: number, expected: number, what: string) => expect(relClose(actual, expected), `${what}: ${actual} vs ${expected}`).toBe(true)

describe('Stress and Strain I worksheet (SSR-13)', () => {
  it('covers all thirteen worksheet rows', () => {
    expect(AXIAL_WORKSHEET.map((f) => f.name)).toEqual([
      'baseline', 'reference', 'titaniumSlim', 'titaniumMargin', 'steelStrong', 'aluminiumSameDiameter', 'titaniumSameDiameter',
      'aluminiumThin', 'titaniumThin', 'aluminiumHeavy', 'steelMax', 'warningAluminium', 'tinySteel',
    ])
  })

  it('uses the worksheet constants P = 20 kN, L = 2 m, n = 2, δ_max = 2 mm, m_max = 2 kg and the three materials', () => {
    expect([ch.forceN, ch.lengthM, ch.designFactor, ch.constraints.maxElongationM, ch.constraints.maxMassKg]).toEqual([20000, 2, 2, 0.002, 2])
    expect(ch.materials.map((m) => [m.id, m.elasticModulusPa, m.yieldStressPa, m.densityKgM3])).toEqual([
      ['steel', 200e9, 250e6, 7850],
      ['aluminium', 69e9, 276e6, 2700],
      ['titanium', 114e9, 830e6, 4430],
    ])
  })

  it.each(AXIAL_WORKSHEET.map((f) => [f.name, f] as const))('%s is a valid design (validated before analysis)', (_n, f) => {
    expect(validateAxialDesign(f.design, ch)).toEqual([])
  })

  it.each(AXIAL_WORKSHEET.map((f) => [f.name, f] as const))('%s matches A, σ, ε, δ, m, EA/L, σ_allow and σ/σ_y at 1e-9', (_n, f) => {
    const { analysis: a, evaluation: e } = run(f)
    const x = f.expected
    expectRel(a.areaM2, x.areaM2, 'area')
    expectRel(a.stressPa, x.stressPa, 'stress')
    expectRel(a.strain, x.strain, 'strain')
    expectRel(a.elongationM, x.elongationM, 'elongation')
    expectRel(a.massKg, x.massKg, 'mass')
    expectRel(a.axialStiffnessNPerM, x.axialStiffnessNPerM, 'axial stiffness')
    expectRel(e.constraints.find((c) => c.id === 'stress')!.limit, x.allowableStressPa, 'allowable stress')
    expectRel(a.yieldRatio, x.yieldRatio, 'yield ratio')
  })

  it.each(AXIAL_WORKSHEET.map((f) => [f.name, f] as const))('%s has the expected status, failures and applicability codes', (_n, f) => {
    const { analysis: a, evaluation: e } = run(f)
    expect(e.status).toBe(f.expected.status)
    expect(e.failures).toEqual(f.expected.failures)
    expect(a.warnings.map((w) => w.code)).toEqual(f.expected.warningCodes)
    expect(a.notApplicableReasons.map((w) => w.code)).toEqual(f.expected.notApplicableCodes)
  })

  it('reproduces the derived limits: no steel rod passes; aluminium and titanium are stiffness-governed', () => {
    const at = (materialId: string, d: number) => {
      const design = rod('x', d, materialId)
      const a = analyzeRod(design, ch)
      return evaluateRod(design, a, ch)
    }
    const pass = (materialId: string, d: number, id: string) => at(materialId, d).constraints.find((c) => c.id === id)!.passed
    for (const m of ['steel', 'aluminium', 'titanium'] as const) {
      const lim = AXIAL_DERIVED[m]
      expect(pass(m, lim.stressMinD, 'stress'), `${m} stress at bound`).toBe(true)
      expect(pass(m, lim.stressMinD * (1 - 1e-6), 'stress'), `${m} stress below bound`).toBe(false)
      expect(pass(m, lim.stretchMinD, 'elongation'), `${m} stretch at bound`).toBe(true)
      expect(pass(m, lim.stretchMinD * (1 - 1e-6), 'elongation'), `${m} stretch below bound`).toBe(false)
      expect(pass(m, lim.massMaxD, 'mass'), `${m} mass at bound`).toBe(true)
      expect(pass(m, lim.massMaxD * (1 + 1e-6), 'mass'), `${m} mass above bound`).toBe(false)
      const governing = Math.max(lim.stressMinD, lim.stretchMinD)
      expectRel(analyzeRod(rod('x', governing, m), ch).massKg, lim.lightestPassingKg, `${m} lightest passing mass`)
    }
    expect(AXIAL_DERIVED.steel.lightestPassingKg).toBeGreaterThan(ch.constraints.maxMassKg)
  })

  it('lists exactly the Accepted grid designs of the worksheet', () => {
    const accepted: Record<string, number[]> = { steel: [], aluminium: [], titanium: [] }
    for (const d of gridDesigns(ch)) {
      const a = analyzeRod(d, ch)
      if (evaluateRod(d, a, ch).accepted) accepted[d.materialId]!.push(Math.round(d.diameterM * 1e4) / 10)
    }
    expect(accepted).toEqual(AXIAL_DERIVED.acceptedGridMm)
  })

  it('prediction fixture: baseline → reference elongation ratio is an increase', () => {
    const base = AXIAL_PRIMARY_METRIC.read(run(worksheetFixture('baseline')).analysis)!
    const ref = AXIAL_PRIMARY_METRIC.read(run(worksheetFixture('reference')).analysis)!
    expectRel(ref / base, AXIAL_DERIVED.baselineToReferenceElongationRatio, 'ratio')
    expect(classifyRatio(ref / base)).toBe('increase')
  })
})
