import { describe, expect, it } from 'vitest'
import { bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import type { BracketChallenge } from '../../challenge/bracket/types'
import { analyzeBracket } from '../../physics/bracket/analyze'
import type { BracketAnalysis } from '../../physics/bracket/types'
import { REL_TOL } from '../tolerance'
import { BRACKET_CONSTRAINT_LABELS, BRACKET_CONSTRAINT_ORDER, bracketEfficiency, evaluateBracketConstraints } from './constraints'
import { evaluateBracket } from './evaluate'

// Bracket evaluation (task 55 L-bracket; MM-11).

const ch = bracketChallenge()
const run = (name: string, c: BracketChallenge = ch) => {
  const f = worksheetFixture(name)
  const a = analyzeBracket(f.design, c)
  return { f, a, e: evaluateBracket(f.design, a, c) }
}

describe('evaluateBracketConstraints', () => {
  it('returns bendStress, deflection, boltTension, mass, applicability in order with SI units', () => {
    expect(BRACKET_CONSTRAINT_ORDER).toEqual(['bendStress', 'deflection', 'boltTension', 'mass', 'applicability'])
    const { a, e } = run('reference')
    expect(e.constraints.map((c) => [c.id, c.unit, c.label])).toEqual([
      ['bendStress', 'Pa', 'Bend stress'],
      ['deflection', 'm', 'Deflection at the load'],
      ['boltTension', 'N', 'Bolt tension'],
      ['mass', 'kg', 'Mass'],
      ['applicability', 'bool', 'Model applicability'],
    ])
    expect(e.constraints[2]).toEqual({
      id: 'boltTension',
      label: 'Bolt tension',
      value: a.boltTensionN,
      limit: 300,
      unit: 'N',
      passed: true,
      utilization: a.boltTensionN / 300,
    })
    expect(e.constraints[4]).toEqual({ id: 'applicability', label: 'Model applicability', value: 1, limit: 1, unit: 'bool', passed: true, utilization: 1 })
  })

  it('labels contain no digits', () => {
    for (const label of Object.values(BRACKET_CONSTRAINT_LABELS)) expect(label).not.toMatch(/\d/)
  })

  it('fails non-finite values without throwing and still returns all five', () => {
    const { a } = run('reference')
    const broken: BracketAnalysis = { ...a, bendStressPa: Number.NaN, deflectionM: Number.POSITIVE_INFINITY, massKg: -Infinity }
    const cs = evaluateBracketConstraints(broken, ch)
    expect(cs.map((c) => c.passed)).toEqual([false, false, true, false, true])
    expect(cs).toHaveLength(5)
  })

  it('is inclusive at each limit within REL_TOL', () => {
    const { a } = run('reference')
    const k = ch.constraints
    const at = (over: Partial<BracketAnalysis>) => evaluateBracketConstraints({ ...a, ...over }, ch).map((c) => c.passed)
    expect(at({ bendStressPa: toleranceEdge(k.maxBendStressPa, REL_TOL) })[0]).toBe(true)
    expect(at({ bendStressPa: nextUp(toleranceEdge(k.maxBendStressPa, REL_TOL)) })[0]).toBe(false)
    expect(at({ deflectionM: k.maxDeflectionM })[1]).toBe(true)
    expect(at({ boltTensionN: k.maxBoltTensionN })[2]).toBe(true)
    expect(at({ boltTensionN: nextUp(toleranceEdge(k.maxBoltTensionN, REL_TOL)) })[2]).toBe(false)
    expect(at({ massKg: k.maxMassKg })[3]).toBe(true)
  })
})

describe('evaluateBracket', () => {
  it('accepts the reference and rejects the baseline on all four numeric checks', () => {
    expect(run('reference').e).toMatchObject({ status: 'accepted', accepted: true, failures: [] })
    expect(run('baseline').e).toMatchObject({ status: 'notAccepted', accepted: false, failures: ['bendStress', 'deflection', 'boltTension', 'mass'] })
  })

  it('a not-applicable design is never Accepted, even when every numeric check passes', () => {
    const { e } = run('legSpanNA')
    expect(e.status).toBe('modelNotApplicable')
    expect(e.failures).toContain('applicability')
    const loose: BracketChallenge = { ...ch, constraints: { maxBendStressPa: 1e12, maxDeflectionM: 1, maxBoltTensionN: 1e9, maxMassKg: 100 } }
    const r = run('legSpanNA', loose).e
    expect(r.failures).toEqual(['applicability'])
    expect(r.accepted).toBe(false)
  })

  it('reports unclamped margins from the stored analysis', () => {
    const { a, e } = run('baseline')
    expect(e.efficiency).toEqual(bracketEfficiency(a, ch))
    expect(e.efficiency.massUsage).toBeGreaterThan(1)
    expect(e.efficiency.stressMargin).toBeLessThan(0)
    expect(e.efficiency.deflectionMargin).toBeLessThan(0)
    expect(e.efficiency.boltMargin).toBe(1 - a.boltTensionN / 300)
  })

  it('is deep-frozen and ends with the model-limitation fact', () => {
    const { e } = run('reference')
    expect(Object.isFrozen(e)).toBe(true)
    expect(e.facts.at(-1)?.id).toBe('model.idealizedBracket')
  })
})
