import { describe, expect, it } from 'vitest'
import { shaft, solid, torsionChallenge, tube, worksheetFixture } from '../../../test/fixtures/torsion'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import type { TorsionChallenge } from '../../challenge/torsion/types'
import { analyzeShaft } from '../../physics/torsion/analyze'
import type { TorsionAnalysis } from '../../physics/torsion/types'
import { REL_TOL } from '../tolerance'
import { evaluateTorsionConstraints, TORSION_CONSTRAINT_LABELS, TORSION_CONSTRAINT_ORDER, torsionEfficiency } from './constraints'
import { evaluateShaft } from './evaluate'
import type { TorsionConstraintId } from './types'

// Torsion evaluation (task 47.2; TSH-07, TSH-13 boundaries, MM-11).

const ch = torsionChallenge()
const run = (name: string, c: TorsionChallenge = ch) => {
  const f = worksheetFixture(name)
  const a = analyzeShaft(f.design, c)
  return { f, a, e: evaluateShaft(f.design, a, c) }
}

describe('evaluateTorsionConstraints', () => {
  it('returns twist, shearStress, mass, outerDiameter, applicability in order with SI units', () => {
    expect(TORSION_CONSTRAINT_ORDER).toEqual(['twist', 'shearStress', 'mass', 'outerDiameter', 'applicability'])
    const { a, e } = run('reference')
    expect(e.constraints.map((c) => [c.id, c.unit, c.label])).toEqual([
      ['twist', 'rad', 'Angle of twist'],
      ['shearStress', 'Pa', 'Maximum shear stress'],
      ['mass', 'kg', 'Mass'],
      ['outerDiameter', 'm', 'Outer diameter'],
      ['applicability', 'bool', 'Model applicability'],
    ])
    expect(e.constraints[0]).toEqual({
      id: 'twist',
      label: 'Angle of twist',
      value: a.twistRad,
      limit: ch.constraints.maxTwistRad,
      unit: 'rad',
      passed: true,
      utilization: a.twistRad / ch.constraints.maxTwistRad,
    })
    expect(e.constraints[3]).toMatchObject({ value: 0.05, limit: 0.05, passed: true, utilization: 1 })
    expect(e.constraints[4]).toEqual({ id: 'applicability', label: 'Model applicability', value: 1, limit: 1, unit: 'bool', passed: true, utilization: 1 })
  })

  it('labels contain no digits', () => {
    for (const label of Object.values(TORSION_CONSTRAINT_LABELS)) expect(label).not.toMatch(/\d/)
  })

  it('fails non-finite values without throwing and still returns all five', () => {
    const { a } = run('reference')
    const broken: TorsionAnalysis = { ...a, twistRad: Number.NaN, maxShearStressPa: Number.POSITIVE_INFINITY, massKg: -Infinity }
    const cs = evaluateTorsionConstraints(broken, ch)
    // Non-finite values never pass, even −∞ below a limit.
    expect(cs.map((c) => c.passed)).toEqual([false, false, false, true, true])
    expect(cs).toHaveLength(5)
  })
})

describe('evaluateShaft', () => {
  it('accepts the reference with positive margins', () => {
    const { a, e } = run('reference')
    expect(e.status).toBe('accepted')
    expect(e.accepted).toBe(true)
    expect(e.failures).toEqual([])
    expect(e.efficiency).toEqual({
      massUsage: a.massKg / 4.5,
      twistMargin: 1 - a.twistRad / ch.constraints.maxTwistRad,
      stressMargin: 1 - a.maxShearStressPa / 80e6,
    })
    expect(e.efficiency.twistMargin).toBeGreaterThan(0)
    expect(Object.isFrozen(e)).toBe(true)
    expect(Object.isFrozen(e.constraints[0])).toBe(true)
  })

  it('gives the Ø30 solid a negative twist margin and twist as its only failure', () => {
    const { e } = run('solid30')
    expect(e.failures).toEqual(['twist'])
    expect(e.efficiency.twistMargin).toBeLessThan(0)
    expect(e.efficiency.stressMargin).toBeGreaterThan(0)
  })

  it('gives the baseline a negative twist margin and mass usage above 1, failing both (version 3, D-61)', () => {
    const { e } = run('baseline')
    expect(e.status).toBe('notAccepted')
    expect(e.failures).toEqual(['twist', 'mass'])
    expect(e.efficiency.twistMargin).toBeLessThan(0)
    expect(e.efficiency.massUsage).toBeGreaterThan(1)
    expect(e.efficiency.stressMargin).toBeGreaterThan(0)
  })

  it('gives the version 2 baseline (Ø26.5 mm) negative twist and stress margins, failing both', () => {
    const { e } = run('solid26_5')
    expect(e.failures).toEqual(['twist', 'shearStress'])
    expect(e.efficiency.twistMargin).toBeLessThan(0)
    expect(e.efficiency.stressMargin).toBeLessThan(0)
  })

  it('is modelNotApplicable, never Accepted, when the model does not apply', () => {
    const { a, e } = run('tinySolid')
    expect(a.applicable).toBe(false)
    expect(e.status).toBe('modelNotApplicable')
    expect(e.accepted).toBe(false)
    // Even with every numeric limit relaxed so all numeric constraints pass.
    const relaxed: TorsionChallenge = { ...ch, constraints: { maxTwistRad: 10, maxShearStressPa: 1e10, maxMassKg: 100, maxOuterDiameterM: 1 } }
    const r = evaluateShaft(worksheetFixture('tinySolid').design, a, relaxed)
    expect(r.failures).toEqual(['applicability'])
    expect(r.status).toBe('modelNotApplicable')
    expect(r.accepted).toBe(false)
  })

  it('ignores warnings: a warned design can be accepted when every limit passes', () => {
    const { a } = run('warningSolid')
    expect(a.warnings.map((w) => w.code)).toEqual(['PLASTICITY_SHEAR'])
    const relaxed: TorsionChallenge = { ...ch, constraints: { ...ch.constraints, maxTwistRad: 1, maxShearStressPa: 200e6 } }
    expect(evaluateShaft(worksheetFixture('warningSolid').design, a, relaxed).status).toBe('accepted')
  })

  it('matches the d = 0 tube and the solid of the same diameter', () => {
    const s = shaft('s', solid(0.04))
    const t = shaft('t', tube(0.04, 0))
    expect(evaluateShaft(t, analyzeShaft(t, ch), ch)).toEqual(evaluateShaft(s, analyzeShaft(s, ch), ch))
  })

  it('does not mutate its inputs', () => {
    const { f, a } = run('baseline')
    const before = structuredClone(a)
    evaluateShaft(f.design, a, ch)
    expect(a).toEqual(before)
  })
})

describe('inclusive boundaries via configured limits (TSH-13)', () => {
  const { f, a } = run('reference')
  const limitKey: Record<Exclude<TorsionConstraintId, 'applicability'>, [keyof TorsionChallenge['constraints'], keyof TorsionAnalysis]> = {
    twist: ['maxTwistRad', 'twistRad'],
    shearStress: ['maxShearStressPa', 'maxShearStressPa'],
    mass: ['maxMassKg', 'massKg'],
    outerDiameter: ['maxOuterDiameterM', 'outerDiameterM'],
  }

  it.each(Object.entries(limitKey))('%s passes when the value equals its limit and within REL_TOL above it', (id, [limit, field]) => {
    const value = a[field] as number
    const atLimit: TorsionChallenge = { ...ch, constraints: { ...ch.constraints, [limit]: value } }
    const e = evaluateShaft(f.design, a, atLimit)
    expect(e.constraints.find((c) => c.id === id)?.passed).toBe(true)
    expect(e.status).toBe('accepted')
    const justBelow: TorsionChallenge = { ...ch, constraints: { ...ch.constraints, [limit]: value / (1 + 0.5 * REL_TOL) } }
    expect(evaluateShaft(f.design, a, justBelow).accepted).toBe(true)
    const beyond: TorsionChallenge = { ...ch, constraints: { ...ch.constraints, [limit]: value / (1 + 4 * REL_TOL) } }
    const eb = evaluateShaft(f.design, a, beyond)
    expect(eb.failures).toEqual([id])
    expect(eb.status).toBe('notAccepted')
  })

  it.each(Object.entries(limitKey))('%s fails one double past the tolerance edge', (id, [limit, field]) => {
    const lim = ch.constraints[limit]
    const edge = toleranceEdge(lim, REL_TOL)
    const at = evaluateTorsionConstraints({ ...a, [field]: edge }, ch).find((c) => c.id === id)
    const past = evaluateTorsionConstraints({ ...a, [field]: nextUp(edge) }, ch).find((c) => c.id === id)
    expect(at?.passed).toBe(true)
    expect(past?.passed).toBe(false)
  })
})

describe('torsionEfficiency', () => {
  it('propagates non-finite values unclamped', () => {
    const { a } = run('reference')
    const e = torsionEfficiency({ ...a, massKg: Number.NaN }, ch)
    expect(Number.isNaN(e.massUsage)).toBe(true)
  })
})
