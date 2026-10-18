import { describe, expect, it } from 'vitest'
import { bracket, bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import type { BracketDesign } from '../../geometry/bracket/design'
import { analyzeBracket } from '../../physics/bracket/analyze'
import { BRACKET_SOURCE_NOTE } from '../../physics/bracket/constants'
import { formatBasis } from '../explain'
import { evaluateBracket } from './evaluate'
import { BRACKET_MODEL_LIMITS_FACT_ID, bracketModelLimitsFact, explainBracketChange } from './explain'
import type { BracketComparable } from './types'

// Grounded bracket explanation facts (task 55 L-bracket; MM-14).

const ch = bracketChallenge()

function tested(d: BracketDesign): BracketComparable {
  const analysis = analyzeBracket(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateBracket(d, analysis, ch) }
}
const fixture = (name: string) => tested(worksheetFixture(name).design)
const ids = (facts: { id: string }[]) => facts.map((f) => f.id)

describe('bracketModelLimitsFact', () => {
  it('discloses the model, its source and the unmodeled bolt effects, with no numbers', () => {
    const f = bracketModelLimitsFact()
    expect(f.id).toBe(BRACKET_MODEL_LIMITS_FACT_ID)
    expect(f.text).toContain(BRACKET_SOURCE_NOTE)
    expect(f.text).toMatch(/Bolt preload, prying/)
    expect(f.text).not.toMatch(/\d/)
    expect(f.basis).toEqual({})
  })
})

describe('single-result facts', () => {
  it('utilizations for the four numeric checks, the curved-beam factor, then the model limits', () => {
    const { analysis: a, evaluation: e } = fixture('baseline')
    expect(ids(e.facts)).toEqual([
      'single.utilization.bendStress',
      'single.utilization.deflection',
      'single.utilization.boltTension',
      'single.utilization.mass',
      'single.curvedBeam',
      BRACKET_MODEL_LIMITS_FACT_ID,
    ])
    expect(e.facts[0].text).toBe(`Bend stress is ${formatBasis(e.constraints[0].utilization)} times its limit in this model (over its limit).`)
    expect(e.facts[4]).toEqual({
      id: 'single.curvedBeam',
      text: `The inner bend raises the bending stress to ×${formatBasis(a.curvedBeamFactor)} the straight-beam value; a larger inner radius relative to the thickness lowers this factor.`,
      basis: { curvedBeamFactor: a.curvedBeamFactor },
    })
  })

  it('skips non-finite utilizations', () => {
    const t = fixture('reference')
    const broken = evaluateBracket(t.designSnapshot, { ...t.analysis, massKg: Number.NaN }, ch)
    expect(ids(broken.facts)).not.toContain('single.utilization.mass')
  })
})

describe('explainBracketChange', () => {
  it('baseline → reference: every ratio, a lighter bracket and four checks now passing', () => {
    const prev = fixture('baseline')
    const next = fixture('reference')
    const facts = explainBracketChange(prev, next)
    expect(ids(facts)).toEqual([
      'change.curvedBeam',
      'change.bendStress',
      'change.boltTension',
      'change.deflection',
      'change.mass',
      'change.constraint.bendStress',
      'change.constraint.deflection',
      'change.constraint.boltTension',
      'change.constraint.mass',
      BRACKET_MODEL_LIMITS_FACT_ID,
    ])
    const rStress = next.analysis.bendStressPa / prev.analysis.bendStressPa
    expect(facts[1]).toEqual({ id: 'change.bendStress', text: `Bend stress changed by ×${formatBasis(rStress)}.`, basis: { rStress } })
    expect(facts[4].text).toBe('Mass changed by -26.56 g.')
    expect(facts[5].text).toBe('Bend stress: fail → pass.')
    expect(facts[2].text).toContain('distance from the heel to the bolt row')
  })

  it('a heavier design reports a signed positive mass change and a check that now fails', () => {
    const facts = explainBracketChange(fixture('reference'), fixture('oversized'))
    expect(facts.find((f) => f.id === 'change.mass')?.text).toMatch(/^Mass changed by \+\d+\.\d\d g\.$/)
    expect(facts.find((f) => f.id === 'change.constraint.mass')?.text).toBe('Mass: pass → fail.')
  })

  it('a pure flange change leaves the curved-beam factor and bend stress unchanged (ratio 1)', () => {
    const facts = explainBracketChange(fixture('baseline'), fixture('flangeOnly'))
    expect(facts.find((f) => f.id === 'change.curvedBeam')?.basis).toEqual({ rFactor: 1 })
    expect(facts.find((f) => f.id === 'change.bendStress')?.basis).toEqual({ rStress: 1 })
    expect(facts.find((f) => f.id === 'change.constraint.boltTension')?.text).toBe('Bolt tension: fail → pass.')
  })

  it('is deterministic', () => {
    const a = tested(bracket('a', 0.005, 0.05, 0.07, 0.003))
    const b = tested(bracket('b', 0.006, 0.06, 0.09, 0.004))
    expect(explainBracketChange(a, b)).toEqual(explainBracketChange(a, b))
  })
})
