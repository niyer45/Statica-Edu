import { describe, expect, it } from 'vitest'
import { columnChallenge, worksheetRow } from '../../../test/fixtures/column'
import { analyzeColumn } from '../../physics/column/analyze'
import { evaluateColumn } from './evaluate'
import { COLUMN_MODEL_LIMITS_FACT_ID, columnModelLimitsFact, explainColumnChange } from './explain'
import type { ColumnComparable } from './types'

// Grounded column explanation facts (task 68; CBK-02, MM-14).

const ch = columnChallenge()
const tested = (name: string): ColumnComparable => {
  const d = worksheetRow(name).design
  const analysis = analyzeColumn(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateColumn(d, analysis, ch) }
}

describe('column facts', () => {
  it('the model-limits fact has no numbers and names the idealizations', () => {
    const f = columnModelLimitsFact()
    expect(f.id).toBe(COLUMN_MODEL_LIMITS_FACT_ID)
    expect(f.text).not.toMatch(/\d/)
    expect(f.text).toMatch(/pins at both ends/)
    expect(f.basis).toEqual({})
  })

  it('single facts: the minimum check as a ratio to the requirement, and the stiffness-not-strength lesson', () => {
    const ids = tested('baseline').evaluation.facts.map((f) => f.id)
    expect(ids).toEqual(['single.utilization.buckling', 'single.utilization.axialStress', 'single.utilization.mass', 'single.stiffnessNotStrength', COLUMN_MODEL_LIMITS_FACT_ID])
    const facts = tested('baseline').evaluation.facts
    expect(facts[0]!.text).toBe('Critical buckling load is 0.15 times the required value in this model (falls short of the requirement).')
    expect(facts[3]!.text).toBe('The column buckles although its axial stress is only 0.18 times the allowable: it is strong enough but not stiff enough.')
  })

  it('omits the lesson when buckling passes or the stress also fails', () => {
    expect(tested('reference').evaluation.facts.map((f) => f.id)).not.toContain('single.stiffnessNotStrength')
    expect(tested('thinSmallTube').evaluation.facts.map((f) => f.id)).not.toContain('single.stiffnessNotStrength')
  })

  it('change facts, solid bar to tube of equal mass: ×5.60 critical load and per kilogram', () => {
    const facts = explainColumnChange(tested('solid30'), tested('tubeEqualMass'))
    expect(facts.map((f) => f.id)).toEqual([
      'change.criticalLoad',
      'change.secondMoment',
      'change.area',
      'change.loadPerMass',
      'change.mass',
      'change.constraint.buckling',
      COLUMN_MODEL_LIMITS_FACT_ID,
    ])
    expect(facts[0]!.text).toBe('Critical buckling load changed by ×5.60.')
    expect(facts[2]!.text).toBe('Cross-section area changed by ×1.00, and the mass with it.')
    expect(facts[4]!.text).toBe('Mass changed by 0.00 kg.')
    expect(facts[5]!.text).toBe('Critical buckling load: fail → pass.')
  })

  it('reports a mass increase with a plus sign', () => {
    const facts = explainColumnChange(tested('baseline'), tested('solid30'))
    expect(facts.find((f) => f.id === 'change.mass')!.text).toBe('Mass changed by +1.27 kg.')
  })
})
