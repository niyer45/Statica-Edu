import { describe, expect, it } from 'vitest'
import { torsionChallenge, worksheetFixture } from '../../../test/fixtures/torsion'
import { analyzeShaft } from '../../physics/torsion/analyze'
import { evaluateShaft } from './evaluate'
import { explainShaftSingle, explainTorsionChange, TORSION_MODEL_LIMITS_FACT_ID, torsionModelLimitsFact } from './explain'
import type { TorsionComparable } from './types'

// Grounded torsion explanation facts (task 47.2; TSH-15, MM-14).

const ch = torsionChallenge()
function tested(name: string): TorsionComparable {
  const f = worksheetFixture(name)
  const analysis = analyzeShaft(f.design, ch)
  return { designSnapshot: f.design, analysis, evaluation: evaluateShaft(f.design, analysis, ch) }
}

describe('explainShaftSingle', () => {
  it('gives one utilization fact per numeric constraint, then the model fact', () => {
    const r = tested('solid30')
    const facts = r.evaluation.facts
    expect(facts.map((f) => f.id)).toEqual([
      'single.utilization.twist',
      'single.utilization.shearStress',
      'single.utilization.mass',
      'single.utilization.outerDiameter',
      TORSION_MODEL_LIMITS_FACT_ID,
    ])
    const twist = r.evaluation.constraints[0]
    expect(facts[0]).toEqual({
      id: 'single.utilization.twist',
      text: `Angle of twist is ${twist.utilization.toFixed(2)} times its limit in this model (over its limit).`,
      basis: { value: twist.value, limit: twist.limit, utilization: twist.utilization },
    })
    expect(facts[1].text).toContain('(within its limit)')
    expect(facts.at(-1)).toEqual(torsionModelLimitsFact())
  })

  it('skips facts for non-finite constraint values', () => {
    const cs = tested('reference').evaluation.constraints.map((c) => (c.id === 'mass' ? { ...c, value: Number.NaN, utilization: Number.NaN } : c))
    expect(explainShaftSingle(cs).map((f) => f.id)).not.toContain('single.utilization.mass')
  })

  it('the model fact names unmodeled effects and has no numbers', () => {
    expect(torsionModelLimitsFact().text).not.toMatch(/\d/)
    expect(torsionModelLimitsFact().text).toContain('shaft torsion model')
  })
})

describe('explainTorsionChange', () => {
  it('solid30 → reference compares J, twist and mass ratios and the pass changes', () => {
    const prev = tested('solid30')
    const next = tested('reference')
    const facts = explainTorsionChange(prev, next)
    const rJ = next.analysis.polarMomentM4 / prev.analysis.polarMomentM4
    const rTwist = next.analysis.twistRad / prev.analysis.twistRad
    const rMass = next.analysis.massKg / prev.analysis.massKg
    expect(facts.map((f) => f.id)).toEqual([
      'change.torsionalStiffness',
      'change.massAndTwist',
      'change.section',
      'change.constraint.twist',
      TORSION_MODEL_LIMITS_FACT_ID,
    ])
    expect(facts[0]).toEqual({
      id: 'change.torsionalStiffness',
      text: `Polar moment (J) changed by ×${rJ.toFixed(2)}; in this model, the angle of twist scales inversely with J, so twist changed by ×${rTwist.toFixed(2)}.`,
      basis: { rJ, rTwist },
    })
    expect(facts[0].text).toBe(
      'Polar moment (J) changed by ×3.09; in this model, the angle of twist scales inversely with J, so twist changed by ×0.32.',
    )
    expect(facts[1]).toEqual({
      id: 'change.massAndTwist',
      text: 'Mass changed by ×0.63 while the angle of twist changed by ×0.32.',
      basis: { rMass, rTwist },
    })
    expect(facts[2].text).toBe('Section changed from Solid circle to Hollow circle.')
    expect(facts[3].text).toBe('Angle of twist: fail → pass.')
  })

  it('solid30 → tubeEqualMass adds the same-mass fact', () => {
    const facts = explainTorsionChange(tested('solid30'), tested('tubeEqualMass'))
    const same = facts.find((f) => f.id === 'change.sameMass')
    expect(same?.text).toBe(
      "Mass stayed about the same (×1.00) while twist dropped (×0.22): in this model, material moved farther from the shaft's axis.",
    )
  })

  it('reports no section fact for the same kind and lists constraint changes in fixed order', () => {
    const facts = explainTorsionChange(tested('reference'), tested('oversizeSolid'))
    expect(facts.map((f) => f.id)).toEqual([
      'change.torsionalStiffness',
      'change.massAndTwist',
      'change.section',
      'change.constraint.mass',
      'change.constraint.outerDiameter',
      TORSION_MODEL_LIMITS_FACT_ID,
    ])
    const solids = explainTorsionChange(tested('solid30'), tested('heavySolid')).map((f) => f.id)
    expect(solids).not.toContain('change.section')
    expect(solids).toEqual([
      'change.torsionalStiffness',
      'change.massAndTwist',
      'change.constraint.twist',
      'change.constraint.mass',
      TORSION_MODEL_LIMITS_FACT_ID,
    ])
  })

  it('reports applicability changes and skips ratio facts for non-finite ratios', () => {
    const prev = tested('baseline')
    const next = tested('tinySolid')
    expect(explainTorsionChange(prev, next).map((f) => f.id)).toContain('change.constraint.applicability')
    const zeroed: TorsionComparable = { ...prev, analysis: { ...prev.analysis, polarMomentM4: 0, twistRad: 0, massKg: 0 } }
    expect(explainTorsionChange(zeroed, next).map((f) => f.id)).not.toContain('change.torsionalStiffness')
    expect(explainTorsionChange(zeroed, next).map((f) => f.id)).not.toContain('change.massAndTwist')
  })

  it('skips constraints missing from either evaluation and is deterministic', () => {
    const prev = tested('baseline')
    const next = tested('reference')
    const trimmed: TorsionComparable = { ...next, evaluation: { ...next.evaluation, constraints: [] } }
    expect(explainTorsionChange(prev, trimmed).some((f) => f.id.startsWith('change.constraint.'))).toBe(false)
    expect(explainTorsionChange(prev, next)).toEqual(explainTorsionChange(prev, next))
  })
})
