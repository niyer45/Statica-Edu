import { describe, expect, it } from 'vitest'
import { axialChallenge, rod, worksheetFixture } from '../../../test/fixtures/axial'
import type { AxialChallenge } from '../../challenge/axial/types'
import { analyzeRod } from '../../physics/axial/analyze'
import { FACT_DIGITS, formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { AXIAL_CONSTRAINT_LABELS, AXIAL_CONSTRAINT_ORDER, axialStressLimit } from './constraints'
import { evaluateRod } from './evaluate'
import { AXIAL_MODEL_LIMITS_FACT_ID, explainRodChange } from './explain'
import { AXIAL_COMPARISON_METRICS, AXIAL_PRIMARY_METRIC } from './metrics'
import type { AxialComparable } from './types'

// Stress and Strain I evaluation, facts and metrics (task 72; SSR-07, SSR-08, MM-11, MM-13, MM-14).

const ch = axialChallenge()
const names = (id: string) => ch.materials.find((m) => m.id === id)!.shortName

function tested(d: AxialComparable['designSnapshot'], challenge: AxialChallenge = ch): AxialComparable {
  const analysis = analyzeRod(d, challenge)
  return { designSnapshot: d, analysis, evaluation: evaluateRod(d, analysis, challenge) }
}

function expectGrounded(facts: readonly ExplanationFact[]): void {
  for (const f of facts) {
    const allowed = Object.values(f.basis).map((v) => formatBasis(v, FACT_DIGITS))
    for (const token of f.text.match(/-?\d+(?:\.\d+)?/g) ?? []) expect(allowed, `${f.id}: ${f.text}`).toContain(token)
  }
  expect(facts.filter((f) => f.id === AXIAL_MODEL_LIMITS_FACT_ID)).toHaveLength(1)
  expect(facts.at(-1)?.id).toBe(AXIAL_MODEL_LIMITS_FACT_ID)
}

describe('evaluateRod', () => {
  it('reports the four checks in order with the material-dependent stress limit', () => {
    const e = tested(ch.initialDesign).evaluation
    expect(e.constraints.map((c) => c.id)).toEqual([...AXIAL_CONSTRAINT_ORDER])
    expect(e.constraints.map((c) => c.label)).toEqual(AXIAL_CONSTRAINT_ORDER.map((id) => AXIAL_CONSTRAINT_LABELS[id]))
    expect(e.constraints.map((c) => c.unit)).toEqual(['Pa', 'm', 'kg', 'bool'])
    expect(e.constraints[0]!.limit).toBe(125e6)
    expect(tested(rod('a', 0.013, 'aluminium')).evaluation.constraints[0]!.limit).toBe(138e6)
    expect(tested(rod('t', 0.013, 'titanium')).evaluation.constraints[0]!.limit).toBe(415e6)
    expect(axialStressLimit({ yieldStressPa: 300e6 }, { designFactor: 3 })).toBe(100e6)
    expect(e.failures).toEqual(['stress', 'mass'])
    expect(e.status).toBe('notAccepted')
    expect(Object.isFrozen(e)).toBe(true)
  })

  it('computes unclamped margins from stored values', () => {
    const { analysis: a, evaluation: e } = tested(worksheetFixture('reference').design)
    expect(e.efficiency.massUsage).toBeCloseTo(a.massKg / 2, 15)
    expect(e.efficiency.stressMargin).toBeCloseTo(1 - a.stressPa / 138e6, 15)
    expect(e.efficiency.elongationMargin).toBeCloseTo(1 - a.elongationM / 0.002, 15)
    expect(tested(ch.initialDesign).evaluation.efficiency.massUsage).toBeGreaterThan(1)
  })

  it('never accepts a rod that has yielded, whatever the limits', () => {
    const loose: AxialChallenge = { ...ch, designFactor: 1, constraints: { maxElongationM: 1, maxMassKg: 100 } }
    const e = tested(rod('tiny', 0.006, 'steel'), loose).evaluation
    expect(e.status).toBe('modelNotApplicable')
    expect(e.accepted).toBe(false)
    expect(e.failures).toEqual(['stress', 'applicability'])
  })

  it('writes grounded single-result facts with one model-limitation fact last', () => {
    const facts = tested(ch.initialDesign).evaluation.facts
    expect(facts.map((f) => f.id)).toEqual(['single.utilization.stress', 'single.utilization.elongation', 'single.utilization.mass', AXIAL_MODEL_LIMITS_FACT_ID])
    expect(facts[0]!.text).toBe('Axial stress is 1.21 times its limit in this model (over its limit).')
    expectGrounded(facts)
  })
})

describe('explainRodChange', () => {
  it('explains a thicker steel rod: area up, stress down, same modulus, heavier', () => {
    const facts = explainRodChange(tested(ch.initialDesign), tested(rod('s', 0.0145, 'steel')), names)
    expect(facts.map((f) => f.id)).toEqual(['change.areaAndStress', 'change.stiffnessAndStretch', 'change.mass', 'change.constraint.stress', AXIAL_MODEL_LIMITS_FACT_ID])
    expect(facts[0]!.text).toBe('Cross-sectional area changed by ×1.24; the stress is the load divided by the area, so it changed by ×0.80, whatever the material.')
    expect(facts[3]!.text).toBe('Axial stress: fail → pass.')
    expectGrounded(facts)
  })

  it('explains a material change at the same diameter: same stress, the modulus decides the stretch', () => {
    const facts = explainRodChange(tested(rod('s', 0.0145, 'steel')), tested(rod('t', 0.0145, 'titanium')), names)
    const byId = Object.fromEntries(facts.map((f) => [f.id, f]))
    expect(byId['change.areaAndStress']!.basis).toEqual({ rArea: 1, rStress: 1 })
    expect(byId['change.stiffnessAndStretch']!.text).toBe("Young's modulus changed by ×0.57 and the elongation by ×1.75: stretch falls as the modulus and the area grow.")
    expect(byId['change.material']!.text).toBe('Material changed from Steel to Titanium.')
    expect(byId['change.constraint.elongation']!.text).toBe('Elongation: pass → fail.')
    expect(byId['change.constraint.mass']!.text).toBe('Mass: fail → pass.')
    expectGrounded(facts)
  })
})

describe('metrics (SSR-08)', () => {
  it('scores predictions on the elongation and refuses non-finite values', () => {
    const a = tested(ch.initialDesign).analysis
    expect(AXIAL_PRIMARY_METRIC).toMatchObject({ id: 'elongationM', label: 'elongation' })
    expect(AXIAL_PRIMARY_METRIC.read(a)).toBe(a.elongationM)
    expect(AXIAL_PRIMARY_METRIC.read({ ...a, elongationM: Number.NaN })).toBeUndefined()
    expect(AXIAL_PRIMARY_METRIC.read({ ...a, elongationM: 0 })).toBeUndefined()
    expect(AXIAL_COMPARISON_METRICS.map((m) => m.id)).toEqual(['elongationM', 'stressPa', 'massKg', 'diameterM', 'strain', 'axialStiffnessNPerM'])
    for (const m of AXIAL_COMPARISON_METRICS) expect(m.label).not.toMatch(/\d/)
  })
})
