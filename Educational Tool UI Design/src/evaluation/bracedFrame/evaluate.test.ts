import { describe, expect, it } from 'vitest'
import { bracedFrameChallenge, worksheetFixture } from '../../../test/fixtures/bracedFrame'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import type { BracedFrameChallenge } from '../../challenge/bracedFrame/types'
import { analyzeBracedFrame } from '../../physics/bracedFrame/analyze'
import type { BracedFrameAnalysis, BracedFrameSolvedAnalysis } from '../../physics/bracedFrame/types'
import { REL_TOL } from '../tolerance'
import { BRACED_FRAME_CONSTRAINT_LABELS, BRACED_FRAME_CONSTRAINT_ORDER, bracedFrameEfficiency, evaluateBracedFrameConstraints } from './constraints'
import { evaluateBracedFrame } from './evaluate'
import type { BracedFrameConstraintId } from './types'

// Braced frame evaluation (task 49.2; BFR-07, BFR-15 boundaries, MM-10, MM-11).

const ch = bracedFrameChallenge()
const run = (name: string, c: BracedFrameChallenge = ch) => {
  const f = worksheetFixture(name)
  const a = analyzeBracedFrame(f.design, c)
  return { f, a, e: evaluateBracedFrame(f.design, a, c) }
}
const solvedOf = (a: BracedFrameAnalysis): BracedFrameSolvedAnalysis => {
  if (a.status !== 'solved') throw new Error('expected solved')
  return a
}
const withLimits = (k: Partial<BracedFrameChallenge['constraints']>): BracedFrameChallenge => ({ ...ch, constraints: { ...ch.constraints, ...k } })

describe('evaluateBracedFrameConstraints', () => {
  it('returns stability, roofDrift, utilization, mass, applicability in order for a solved frame', () => {
    expect(BRACED_FRAME_CONSTRAINT_ORDER).toEqual(['stability', 'roofDrift', 'utilization', 'mass', 'applicability'])
    const { a, e } = run('reference')
    const s = solvedOf(a)
    expect(e.constraints.map((c) => [c.id, c.unit, c.label])).toEqual([
      ['stability', 'bool', 'Stability'],
      ['roofDrift', 'm', 'Roof drift'],
      ['utilization', 'ratio', 'Maximum member utilization'],
      ['mass', 'kg', 'Mass'],
      ['applicability', 'bool', 'Model applicability'],
    ])
    expect(e.constraints[0]).toEqual({ id: 'stability', label: 'Stability', value: 1, limit: 1, unit: 'bool', passed: true, utilization: 1 })
    expect(e.constraints[1]).toEqual({ id: 'roofDrift', label: 'Roof drift', value: Math.abs(s.roofDriftM), limit: 0.012, unit: 'm', passed: true, utilization: Math.abs(s.roofDriftM) / 0.012 })
    expect(e.constraints[2]).toMatchObject({ value: s.maxUtilization, limit: 1, passed: true })
  })

  it('omits roofDrift and utilization for a mechanism: undefined, not failed (BFR-07, MM-10)', () => {
    const { e } = run('upperUnbraced')
    expect(e.constraints.map((c) => [c.id, c.passed])).toEqual([
      ['stability', false],
      ['mass', true],
      ['applicability', false],
    ])
    expect(e.constraints[0]).toEqual({ id: 'stability', label: 'Stability', value: 0, limit: 1, unit: 'bool', passed: false, utilization: 0 })
  })

  it('labels contain no digits', () => {
    for (const label of Object.values(BRACED_FRAME_CONSTRAINT_LABELS)) expect(label).not.toMatch(/\d/)
  })

  it('fails non-finite values without throwing', () => {
    const s = solvedOf(run('reference').a)
    const broken: BracedFrameSolvedAnalysis = { ...s, roofDriftM: Number.NaN, maxUtilization: Number.POSITIVE_INFINITY, massKg: -Infinity }
    expect(evaluateBracedFrameConstraints(broken, ch).map((c) => c.passed)).toEqual([true, false, false, false, true])
  })

  it('uses |roof drift|: a negative drift of the same size passes the same way', () => {
    const s = solvedOf(run('lightLowerDiagonal').a)
    const mirrored = { ...s, roofDriftM: -s.roofDriftM }
    expect(evaluateBracedFrameConstraints(mirrored, ch)[1]).toEqual(evaluateBracedFrameConstraints(s, ch)[1])
  })
})

describe('inclusive boundaries via configured limits (BFR-15)', () => {
  const { f, a } = run('reference')
  const s = solvedOf(a)
  const cases: [BracedFrameConstraintId, keyof BracedFrameChallenge['constraints'], 'roofDriftM' | 'maxUtilization' | 'massKg'][] = [
    ['roofDrift', 'maxRoofDriftM', 'roofDriftM'],
    ['utilization', 'maxUtilization', 'maxUtilization'],
    ['mass', 'maxMassKg', 'massKg'],
  ]

  it.each(cases)('%s passes when the value equals its limit', (id, limit, field) => {
    const e = evaluateBracedFrame(f.design, s, withLimits({ [limit]: Math.abs(s[field]) }))
    expect(e.failures).toEqual([])
    expect(e.constraints.find((c) => c.id === id)).toMatchObject({ passed: true, utilization: 1 })
  })

  it.each(cases)('%s passes at the REL_TOL edge and fails one step beyond', (id, limit, field) => {
    const lim = ch.constraints[limit]
    const edge = toleranceEdge(lim, REL_TOL)
    const at = evaluateBracedFrameConstraints({ ...s, [field]: edge }, ch).find((c) => c.id === id)
    const past = evaluateBracedFrameConstraints({ ...s, [field]: nextUp(edge) }, ch).find((c) => c.id === id)
    expect(at?.passed).toBe(true)
    expect(past?.passed).toBe(false)
    expect(evaluateBracedFrame(f.design, { ...s, [field]: nextUp(edge) }, ch).failures).toEqual([id])
  })
})

describe('evaluateBracedFrame', () => {
  it('accepts the reference with margins below one', () => {
    const { e } = run('reference')
    expect(e.status).toBe('accepted')
    expect(e.accepted).toBe(true)
    expect(e.failures).toEqual([])
    expect(e.efficiency.massUsage).toBeCloseTo(189.969032143367 / 200, 12)
    expect(e.efficiency.driftUsage).toBeCloseTo(0.0103833770829032 / 0.012, 12)
    expect(e.efficiency.maxUtilization).toBeCloseTo(0.823533317932313, 12)
  })

  it('a mechanism is modelNotApplicable, never Accepted, and has only massUsage', () => {
    for (const name of ['upperUnbraced', 'unbraced', 'lowerXOnly', 'upperXOnly']) {
      const { e } = run(name)
      expect(e.status).toBe('modelNotApplicable')
      expect(e.accepted).toBe(false)
      expect(e.failures[0]).toBe('stability')
      expect(e.failures.at(-1)).toBe('applicability')
      expect(Object.keys(e.efficiency)).toEqual(['massUsage'])
    }
  })

  it('warnings do not affect acceptance (mixedLight is Accepted with INELASTIC_BUCKLING)', () => {
    const { a, e } = run('mixedLight')
    expect(a.warnings.map((w) => w.code)).toEqual(['INELASTIC_BUCKLING'])
    expect(e.status).toBe('accepted')
  })

  it('is deep-frozen and does not mutate inputs', () => {
    const { f, a } = run('baseline')
    const before = structuredClone(a)
    const e = evaluateBracedFrame(f.design, a, ch)
    expect(Object.isFrozen(e)).toBe(true)
    expect(Object.isFrozen(e.constraints[0])).toBe(true)
    expect(a).toEqual(before)
  })

  it('reports unclamped margins above one when limits are exceeded', () => {
    const eff = bracedFrameEfficiency(run('bruteForce').a, ch)
    expect(eff.massUsage).toBeGreaterThan(2)
    expect(bracedFrameEfficiency(run('baseline').a, ch).maxUtilization).toBeGreaterThan(3)
  })
})
