import { describe, expect, it } from 'vitest'
import { bracket, bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import type { BracketChallenge } from '../../challenge/bracket/types'
import { analyzeBracket } from '../../physics/bracket/analyze'
import type { BracketAnalysis } from '../../physics/bracket/types'
import { REL_TOL } from '../tolerance'
import { BRACKET_CONSTRAINT_LABELS, BRACKET_CONSTRAINT_ORDER, bracketEfficiency, evaluateBracketConstraints } from './constraints'
import { evaluateBracket } from './evaluate'
import type { BracketConstraintId } from './types'

// Bracket evaluation (task 46.2; MBR-08, MBR-17 boundaries, MM-10, MM-11).

const ch = bracketChallenge()
const run = (name: string, c: BracketChallenge = ch) => {
  const f = worksheetFixture(name)
  const a = analyzeBracket(f.design, c)
  return { f, a, e: evaluateBracket(f.design, a, c) }
}

describe('evaluateBracketConstraints', () => {
  it('returns peakStress, tipDeflection, mass, envelopeDepth, applicability in order with SI units', () => {
    expect(BRACKET_CONSTRAINT_ORDER).toEqual(['peakStress', 'tipDeflection', 'mass', 'envelopeDepth', 'applicability'])
    const { a, e } = run('reference')
    expect(e.constraints.map((c) => [c.id, c.unit, c.label])).toEqual([
      ['peakStress', 'Pa', 'Peak stress'],
      ['tipDeflection', 'm', 'Tip deflection'],
      ['mass', 'kg', 'Mass'],
      ['envelopeDepth', 'm', 'Envelope depth'],
      ['applicability', 'bool', 'Model applicability'],
    ])
    expect(e.constraints[0]).toEqual({
      id: 'peakStress',
      label: 'Peak stress',
      value: a.peakStressPa,
      limit: 120e6,
      unit: 'Pa',
      passed: true,
      utilization: (a.peakStressPa as number) / 120e6,
    })
    expect(e.constraints[4]).toEqual({ id: 'applicability', label: 'Model applicability', value: 1, limit: 1, unit: 'bool', passed: true, utilization: 1 })
  })

  it('labels contain no digits', () => {
    for (const label of Object.values(BRACKET_CONSTRAINT_LABELS)) expect(label).not.toMatch(/\d/)
  })

  it('reports an absent peak stress without a value or utilization, failing (MBR-08)', () => {
    const { e } = run('fitShallowNA')
    expect(e.constraints[0]).toEqual({ id: 'peakStress', label: 'Peak stress', limit: 120e6, unit: 'Pa', passed: false })
    expect('value' in e.constraints[0]).toBe(false)
  })

  it('fails non-finite values without throwing and still returns all five', () => {
    const { a } = run('reference')
    const broken: BracketAnalysis = { ...a, peakStressPa: Number.NaN, tipDeflectionM: Number.POSITIVE_INFINITY, massKg: -Infinity }
    const cs = evaluateBracketConstraints(broken, ch)
    // Non-finite values never pass, even −∞ below a limit.
    expect(cs.map((c) => c.passed)).toEqual([false, false, false, true, true])
    expect(cs).toHaveLength(5)
  })
})

describe('evaluateBracket', () => {
  it('accepts the reference with positive margins, in the MBR-08 margin order', () => {
    const { a, e } = run('reference')
    expect(e.status).toBe('accepted')
    expect(e.accepted).toBe(true)
    expect(e.failures).toEqual([])
    expect(e.efficiency).toEqual({
      massUsage: a.massKg / 0.215,
      stressMargin: 1 - (a.peakStressPa as number) / 120e6,
      deflectionMargin: 1 - a.tipDeflectionM / 0.0024,
    })
    expect(Object.keys(e.efficiency)).toEqual(['massUsage', 'stressMargin', 'deflectionMargin'])
    expect(Object.isFrozen(e)).toBe(true)
    expect(Object.isFrozen(e.constraints[0])).toBe(true)
  })

  it('gives the baseline a negative stress margin and peakStress as its only failure', () => {
    const { e } = run('baseline')
    expect(e.failures).toEqual(['peakStress'])
    expect(e.efficiency.stressMargin).toBeLessThan(0)
    expect(e.efficiency.deflectionMargin).toBeGreaterThan(0)
  })

  it('omits the stress margin and reports modelNotApplicable when the peak stress is undefined (MM-10)', () => {
    const { e } = run('fitShallowNA')
    expect(e.status).toBe('modelNotApplicable')
    expect(e.accepted).toBe(false)
    expect(Object.keys(e.efficiency)).toEqual(['massUsage', 'deflectionMargin'])
    expect(JSON.stringify(e)).not.toMatch(/NaN|null/)
  })

  it('is modelNotApplicable, never Accepted, when the model does not apply even if every limit passes', () => {
    const { f, a } = run('ratioNA')
    const relaxed: BracketChallenge = { ...ch, constraints: { maxPeakStressPa: 1e10, maxTipDeflectionM: 1, maxMassKg: 100, maxEnvelopeDepthM: 1 } }
    const r = evaluateBracket(f.design, a, relaxed)
    expect(r.failures).toEqual(['applicability'])
    expect(r.status).toBe('modelNotApplicable')
    expect(r.accepted).toBe(false)
  })

  it('ignores warnings: a warned design can be accepted', () => {
    const { a, e } = run('ratioWarning')
    expect(a.warnings.map((w) => w.code)).toEqual(['KT_STEP_RATIO', 'DEPTH_SPAN'])
    expect(e.status).toBe('accepted')
  })

  it('evaluates a uniform bar on its root stress', () => {
    const d = bracket('u', 0.027, 0.027, 0.15, 0.001)
    const a = analyzeBracket(d, ch)
    const e = evaluateBracket(d, a, ch)
    expect(e.constraints[0].value).toBe(a.rootStressPa)
    expect(e.failures).toEqual(['mass'])
  })

  it('does not mutate its inputs', () => {
    const { f, a } = run('baseline')
    const before = structuredClone(a)
    evaluateBracket(f.design, a, ch)
    expect(a).toEqual(before)
  })
})

describe('inclusive boundaries via configured limits (MBR-17)', () => {
  const { f, a } = run('reference')
  const limitKey: Record<Exclude<BracketConstraintId, 'applicability'>, [keyof BracketChallenge['constraints'], keyof BracketAnalysis]> = {
    peakStress: ['maxPeakStressPa', 'peakStressPa'],
    tipDeflection: ['maxTipDeflectionM', 'tipDeflectionM'],
    mass: ['maxMassKg', 'massKg'],
    envelopeDepth: ['maxEnvelopeDepthM', 'envelopeDepthM'],
  }

  it.each(Object.entries(limitKey))('%s passes when the value equals its limit and within REL_TOL above it', (id, [limit, field]) => {
    const value = a[field] as number
    const atLimit: BracketChallenge = { ...ch, constraints: { ...ch.constraints, [limit]: value } }
    const e = evaluateBracket(f.design, a, atLimit)
    expect(e.constraints.find((c) => c.id === id)?.passed).toBe(true)
    expect(e.status).toBe('accepted')
    const justBelow: BracketChallenge = { ...ch, constraints: { ...ch.constraints, [limit]: value / (1 + 0.5 * REL_TOL) } }
    expect(evaluateBracket(f.design, a, justBelow).accepted).toBe(true)
    const beyond: BracketChallenge = { ...ch, constraints: { ...ch.constraints, [limit]: value / (1 + 4 * REL_TOL) } }
    const eb = evaluateBracket(f.design, a, beyond)
    expect(eb.failures).toEqual([id])
    expect(eb.status).toBe('notAccepted')
  })

  it.each(Object.entries(limitKey))('%s fails one double past the tolerance edge', (id, [limit, field]) => {
    const lim = ch.constraints[limit]
    const edge = toleranceEdge(lim, REL_TOL)
    const atEdge = evaluateBracketConstraints({ ...a, [field]: edge }, ch).find((c) => c.id === id)
    const past = evaluateBracketConstraints({ ...a, [field]: nextUp(edge) }, ch).find((c) => c.id === id)
    expect(atEdge?.passed).toBe(true)
    expect(past?.passed).toBe(false)
  })

  it('shoulderNA: the 40 mm envelope equals its limit and passes', () => {
    const { e } = run('shoulderNA')
    expect(e.constraints.find((c) => c.id === 'envelopeDepth')).toMatchObject({ value: 0.04, limit: 0.04, passed: true, utilization: 1 })
  })
})

describe('bracketEfficiency', () => {
  it('propagates non-finite values unclamped', () => {
    const { a } = run('reference')
    expect(Number.isNaN(bracketEfficiency({ ...a, massKg: Number.NaN }, ch).massUsage)).toBe(true)
  })
})
