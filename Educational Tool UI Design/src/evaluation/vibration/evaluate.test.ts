import { describe, expect, it } from 'vitest'
import { isolator, VIBRATION_DERIVED, vibrationChallenge, worksheetFixture } from '../../../test/fixtures/vibration'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import type { VibrationChallenge } from '../../challenge/vibration/types'
import { analyzeIsolator } from '../../physics/vibration/analyze'
import type { VibrationAnalysis } from '../../physics/vibration/types'
import { REL_TOL } from '../tolerance'
import { evaluateVibrationConstraints, VIBRATION_CONSTRAINT_LABELS, VIBRATION_CONSTRAINT_ORDER, vibrationEfficiency } from './constraints'
import { evaluateIsolator } from './evaluate'
import type { VibrationConstraintId } from './types'

// Vibration evaluation (task 50.2; VIB-07, VIB-13 boundaries, MM-11).

const ch = vibrationChallenge()
const run = (name: string, c: VibrationChallenge = ch) => {
  const f = worksheetFixture(name)
  const a = analyzeIsolator(f.design, c)
  return { f, a, e: evaluateIsolator(f.design, a, c) }
}

describe('evaluateVibrationConstraints', () => {
  it('returns the five VIB-07 constraints in order with SI units and no Hz constraint', () => {
    expect(VIBRATION_CONSTRAINT_ORDER).toEqual(['worstInBandTransmissibility', 'staticDeflection', 'peakTransmissibility', 'relativeDisplacement', 'applicability'])
    const { a, e } = run('reference')
    expect(e.constraints.map((c) => [c.id, c.unit, c.label])).toEqual([
      ['worstInBandTransmissibility', 'ratio', 'Worst vibration transmitted in the operating band'],
      ['staticDeflection', 'm', 'Static deflection (sag)'],
      ['peakTransmissibility', 'ratio', 'Peak transmissibility (resonance)'],
      ['relativeDisplacement', 'm', 'Peak relative displacement (clearance)'],
      ['applicability', 'bool', 'Model applicability'],
    ])
    expect(e.constraints[0]).toEqual({
      id: 'worstInBandTransmissibility',
      label: 'Worst vibration transmitted in the operating band',
      value: a.worstInBandTransmissibility,
      limit: 0.12,
      unit: 'ratio',
      passed: true,
      utilization: a.worstInBandTransmissibility / 0.12,
    })
    expect(e.constraints[1]).toMatchObject({ value: a.staticDeflectionM, limit: 0.008 })
    expect(e.constraints[2]).toMatchObject({ value: a.peakTransmissibility, limit: 6 })
    expect(e.constraints[3]).toMatchObject({ value: a.peakRelativeDisplacementM, limit: 0.0015 })
    expect(e.constraints[4]).toEqual({ id: 'applicability', label: 'Model applicability', value: 1, limit: 1, unit: 'bool', passed: true, utilization: 1 })
    expect(e.constraints.some((c) => (c.unit as string) === 'Hz')).toBe(false)
  })

  it('labels contain no digits', () => {
    for (const label of Object.values(VIBRATION_CONSTRAINT_LABELS)) expect(label).not.toMatch(/\d/)
  })

  it('fails non-finite values without throwing and still returns all five', () => {
    const { a } = run('reference')
    const broken: VibrationAnalysis = { ...a, worstInBandTransmissibility: Number.NaN, staticDeflectionM: Number.POSITIVE_INFINITY, peakTransmissibility: -Infinity }
    const cs = evaluateVibrationConstraints(broken, ch)
    // Non-finite values never pass, even −∞ below a limit.
    expect(cs.map((c) => c.passed)).toEqual([false, false, false, true, true])
    expect(cs).toHaveLength(5)
  })
})

describe('evaluateIsolator', () => {
  it('accepts the reference with positive margins', () => {
    const { a, e } = run('reference')
    expect(e.status).toBe('accepted')
    expect(e.accepted).toBe(true)
    expect(e.failures).toEqual([])
    expect(e.efficiency).toEqual({
      isolationMargin: 1 - a.worstInBandTransmissibility / 0.12,
      sagUsage: a.staticDeflectionM / 0.008,
      clearanceUsage: a.peakRelativeDisplacementM / 0.0015,
    })
    expect(e.efficiency.isolationMargin).toBeGreaterThan(0)
    expect(Object.isFrozen(e)).toBe(true)
    expect(Object.isFrozen(e.constraints[0])).toBe(true)
  })

  it('gives the baseline a negative isolation margin and the three resonance failures', () => {
    const { e } = run('baseline')
    expect(e.failures).toEqual(['worstInBandTransmissibility', 'peakTransmissibility', 'relativeDisplacement'])
    expect(e.efficiency.isolationMargin).toBeLessThan(0)
    expect(e.efficiency.sagUsage).toBeLessThan(1)
    expect(e.efficiency.clearanceUsage).toBeGreaterThan(1)
  })

  it('is modelNotApplicable, never Accepted, when the model does not apply', () => {
    const { a, e } = run('tooSoftHeavy')
    expect(a.applicable).toBe(false)
    expect(e.status).toBe('modelNotApplicable')
    expect(e.accepted).toBe(false)
    // Even with every numeric limit relaxed so all numeric constraints pass.
    const relaxed: VibrationChallenge = {
      ...ch,
      constraints: { maxWorstInBandTransmissibility: 10, maxStaticDeflectionM: 1, maxPeakTransmissibility: 100, maxRelativeDisplacementM: 1 },
    }
    const r = evaluateIsolator(worksheetFixture('tooSoftHeavy').design, a, relaxed)
    expect(r.failures).toEqual(['applicability'])
    expect(r.status).toBe('modelNotApplicable')
    expect(r.accepted).toBe(false)
  })

  it('ignores warnings: a warned design can be accepted when every limit passes', () => {
    const { a } = run('softWarning')
    expect(a.warnings.map((w) => w.code)).toEqual(['SPRING_STROKE'])
    const relaxed: VibrationChallenge = { ...ch, constraints: { ...ch.constraints, maxStaticDeflectionM: 0.02 } }
    expect(evaluateIsolator(worksheetFixture('softWarning').design, a, relaxed).status).toBe('accepted')
  })

  it('does not mutate its inputs', () => {
    const { f, a } = run('baseline')
    const before = structuredClone(a)
    evaluateIsolator(f.design, a, ch)
    expect(a).toEqual(before)
  })
})

describe('inclusive boundaries constructed from the design (VIB-13)', () => {
  it('k = m g/δ_lim sits on the sag limit and passes; the next grid value below fails sag only', () => {
    const k = (ch.component.massKg * 9.80665) / ch.constraints.maxStaticDeflectionM
    expect(k).toBe(VIBRATION_DERIVED.sagFloorNPerM)
    const d = isolator('sag', k, 0.2)
    const a = analyzeIsolator(d, ch)
    const e = evaluateIsolator(d, a, ch)
    expect(e.constraints[1].passed).toBe(true)
    expect(e.status).toBe('accepted')
    // A stiffness a few REL_TOL softer moves δ_st beyond the tolerance edge.
    const softer = isolator('soft', k / (1 + 4 * REL_TOL), 0.2)
    const es = evaluateIsolator(softer, analyzeIsolator(softer, ch), ch)
    expect(es.failures).toEqual(['staticDeflection'])
  })

  it('k = m(2π·25/r_iso)² sits on the isolation limit and passes; slightly stiffer fails isolation only', () => {
    const k = worksheetFixture('isoBoundary').design.stiffnessNPerM
    const d = isolator('iso', k, 0.2)
    const e = evaluateIsolator(d, analyzeIsolator(d, ch), ch)
    expect(e.constraints[0].passed).toBe(true)
    expect(e.status).toBe('accepted')
    const stiffer = isolator('stiff', k * (1 + 1e-7), 0.2)
    expect(evaluateIsolator(stiffer, analyzeIsolator(stiffer, ch), ch).failures).toEqual(['worstInBandTransmissibility'])
  })

  const { f, a } = run('reference')
  const limitKey: Record<Exclude<VibrationConstraintId, 'applicability'>, [keyof VibrationChallenge['constraints'], keyof VibrationAnalysis]> = {
    worstInBandTransmissibility: ['maxWorstInBandTransmissibility', 'worstInBandTransmissibility'],
    staticDeflection: ['maxStaticDeflectionM', 'staticDeflectionM'],
    peakTransmissibility: ['maxPeakTransmissibility', 'peakTransmissibility'],
    relativeDisplacement: ['maxRelativeDisplacementM', 'peakRelativeDisplacementM'],
  }

  it.each(Object.entries(limitKey))('%s passes when its configured limit equals the computed value, fails a few REL_TOL beyond', (id, [limit, field]) => {
    const value = a[field] as number
    const atLimit: VibrationChallenge = { ...ch, constraints: { ...ch.constraints, [limit]: value } }
    const e = evaluateIsolator(f.design, a, atLimit)
    expect(e.constraints.find((c) => c.id === id)?.passed).toBe(true)
    expect(e.status).toBe('accepted')
    const justBelow: VibrationChallenge = { ...ch, constraints: { ...ch.constraints, [limit]: value / (1 + 0.5 * REL_TOL) } }
    expect(evaluateIsolator(f.design, a, justBelow).accepted).toBe(true)
    const beyond: VibrationChallenge = { ...ch, constraints: { ...ch.constraints, [limit]: value / (1 + 4 * REL_TOL) } }
    const eb = evaluateIsolator(f.design, a, beyond)
    expect(eb.failures).toEqual([id])
    expect(eb.status).toBe('notAccepted')
  })

  it.each(Object.entries(limitKey))('%s fails one double past the tolerance edge', (id, [limit, field]) => {
    const lim = ch.constraints[limit]
    const edge = toleranceEdge(lim, REL_TOL)
    const at = evaluateVibrationConstraints({ ...a, [field]: edge }, ch).find((c) => c.id === id)
    const past = evaluateVibrationConstraints({ ...a, [field]: nextUp(edge) }, ch).find((c) => c.id === id)
    expect(at?.passed).toBe(true)
    expect(past?.passed).toBe(false)
  })
})

describe('vibrationEfficiency', () => {
  it('propagates non-finite values unclamped', () => {
    const { a } = run('reference')
    const e = vibrationEfficiency({ ...a, staticDeflectionM: Number.NaN }, ch)
    expect(Number.isNaN(e.sagUsage)).toBe(true)
  })
})
