import { describe, expect, it } from 'vitest'
import { bracket, bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import type { BracketDesign } from '../../geometry/bracket/design'
import { analyzeBracket } from '../../physics/bracket/analyze'
import { BRACKET_KT_SOURCE_NOTE } from '../../physics/bracket/constants'
import { formatBasis } from '../explain'
import { evaluateBracket } from './evaluate'
import { BRACKET_MODEL_LIMITS_FACT_ID, bracketModelLimitsFact, explainBracketChange, NO_STEP_TEXT } from './explain'
import type { BracketComparable } from './types'

// Grounded bracket explanation facts (task 46.2; MBR-03, MBR-12, MBR-19, MBR-20, MM-14).

const ch = bracketChallenge()

function tested(d: BracketDesign): BracketComparable {
  const analysis = analyzeBracket(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateBracket(d, analysis, ch) }
}
const fixture = (name: string) => tested(worksheetFixture(name).design)
const ids = (facts: { id: string }[]) => facts.map((f) => f.id)

describe('bracketModelLimitsFact', () => {
  it('discloses the secondary-copy Kt source and the local-peak meaning, with no numbers (MBR-03, MBR-20)', () => {
    const f = bracketModelLimitsFact()
    expect(f.id).toBe(BRACKET_MODEL_LIMITS_FACT_ID)
    expect(f.text).toContain(BRACKET_KT_SOURCE_NOTE)
    expect(f.text).toContain('pending printed-edition verification')
    expect(f.text).toContain('Kt is a local elastic peak at the fillet; it does not change the moment, the deflection or the root stress.')
    expect(f.text).not.toMatch(/\d/)
    expect(f.basis).toEqual({})
  })
})

describe('single-result facts', () => {
  it('step-governed design: utilizations, peak at the step, model limits last', () => {
    const { evaluation: e } = fixture('baseline')
    expect(ids(e.facts)).toEqual([
      'single.utilization.peakStress',
      'single.utilization.tipDeflection',
      'single.utilization.mass',
      'single.utilization.envelopeDepth',
      'single.peakLocation',
      BRACKET_MODEL_LIMITS_FACT_ID,
    ])
    expect(e.facts[0].text).toBe(`Peak stress is ${formatBasis(e.constraints[0].utilization as number)} times its limit in this model (over its limit).`)
    expect(e.facts[4].text).toBe('The peak stress is at the step, where the fillet concentrates the local bending stress.')
  })

  it('root-governed design says so', () => {
    const facts = fixture('rootGoverned').evaluation.facts
    expect(facts.find((f) => f.id === 'single.peakLocation')?.text).toBe('The peak stress is at the root, where the bending moment is largest.')
  })

  it('uniform bar: "no step: stress concentration not applied" (MBR-12)', () => {
    const facts = fixture('uniformDeep').evaluation.facts
    expect(ids(facts)).toContain('single.noStep')
    expect(facts.find((f) => f.id === 'single.noStep')?.text).toBe(NO_STEP_TEXT)
    expect(NO_STEP_TEXT.toLowerCase()).toContain('no step: stress concentration not applied')
  })

  it('undefined Kt fit: no peak utilization or location, an explicit fact instead', () => {
    const facts = fixture('fitShallowNA').evaluation.facts
    expect(ids(facts)).toEqual([
      'single.utilization.tipDeflection',
      'single.utilization.mass',
      'single.utilization.envelopeDepth',
      'single.ktFitUndefined',
      BRACKET_MODEL_LIMITS_FACT_ID,
    ])
  })

  it('skips non-finite utilizations', () => {
    const t = fixture('reference')
    const broken = evaluateBracket(t.designSnapshot, { ...t.analysis, massKg: Number.NaN }, ch)
    expect(ids(broken.facts)).not.toContain('single.utilization.mass')
  })
})

describe('explainBracketChange', () => {
  it('rootGoverned → rootToStep: location change, Kt ratio, unchanged nominal stress and mass, peak ratio', () => {
    const prev = fixture('rootGoverned')
    const next = fixture('rootToStep')
    const facts = explainBracketChange(prev, next)
    expect(ids(facts)).toEqual(['change.peakLocation', 'change.kt', 'change.stepNominal', 'change.peakStress', 'change.mass', BRACKET_MODEL_LIMITS_FACT_ID])
    expect(facts[0].text).toBe('The peak stress moved from the root to the step.')
    const rKt = (next.analysis.ktStep as number) / (prev.analysis.ktStep as number)
    expect(facts[1].basis).toEqual({ rKt })
    expect(facts[1].text).toContain(`×${formatBasis(rKt)}`)
    expect(facts[2].basis).toEqual({ rStepNominal: 1 })
    expect(facts[4]).toEqual({ id: 'change.mass', text: 'Mass changed by 0.00 g.', basis: { deltaMassG: 0 } })
  })

  it('baseline → reference: lower Kt, step moved outboard, heavier, peakStress now passes', () => {
    const facts = explainBracketChange(fixture('baseline'), fixture('reference'))
    expect(ids(facts)).toEqual(['change.kt', 'change.stepNominal', 'change.peakStress', 'change.mass', 'change.constraint.peakStress', BRACKET_MODEL_LIMITS_FACT_ID])
    expect(facts.find((f) => f.id === 'change.mass')?.text).toBe('Mass changed by +6.75 g.')
    expect(facts.find((f) => f.id === 'change.constraint.peakStress')?.text).toBe('Peak stress: fail → pass.')
    expect(facts.find((f) => f.id === 'change.stepNominal')?.text).toContain('bending moment at the shoulder')
  })

  it('a lighter design reports a signed negative mass change', () => {
    const facts = explainBracketChange(fixture('reference'), fixture('baseline'))
    expect(facts.find((f) => f.id === 'change.mass')?.text).toBe('Mass changed by -6.75 g.')
  })

  it('omits ratios whose quantities are absent (uniform bar, undefined fit)', () => {
    const toUniform = explainBracketChange(fixture('baseline'), fixture('uniformDeep'))
    expect(ids(toUniform)).toEqual(['change.peakLocation', 'change.peakStress', 'change.mass', 'change.constraint.peakStress', 'change.constraint.mass', BRACKET_MODEL_LIMITS_FACT_ID])
    const toUndefined = explainBracketChange(fixture('baseline'), fixture('fitShallowNA'))
    expect(ids(toUndefined)).toEqual(['change.stepNominal', 'change.mass', 'change.constraint.mass', 'change.constraint.applicability', BRACKET_MODEL_LIMITS_FACT_ID])
  })

  it('is deterministic', () => {
    const a = tested(bracket('a', 0.03, 0.02, 0.15, 0.002))
    const b = tested(bracket('b', 0.032, 0.022, 0.2, 0.003))
    expect(explainBracketChange(a, b)).toEqual(explainBracketChange(a, b))
  })
})
