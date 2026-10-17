import { describe, expect, it } from 'vitest'
import { heatSinkChallenge, worksheetFixture } from '../../../test/fixtures/heatSink'
import { lowerToleranceEdge, nextDown } from '../../../test/heatSinkNumeric'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import type { HeatSinkChallenge } from '../../challenge/heatSink/types'
import { analyzeHeatSink } from '../../physics/heatSink/analyze'
import type { HeatSinkAnalysis } from '../../physics/heatSink/types'
import { REL_TOL } from '../tolerance'
import { evaluateHeatSinkConstraints, HEAT_SINK_CONSTRAINT_LABELS, HEAT_SINK_CONSTRAINT_ORDER, heatSinkEfficiency } from './constraints'
import { evaluateHeatSink } from './evaluate'
import type { HeatSinkConstraintId } from './types'

// Heat sink evaluation (task 48.2; HSK-07, HSK-13 boundaries, MM-11).

const ch = heatSinkChallenge()
const run = (name: string, c: HeatSinkChallenge = ch) => {
  const f = worksheetFixture(name)
  const a = analyzeHeatSink(f.design, c)
  return { f, a, e: evaluateHeatSink(f.design, a, c) }
}

describe('evaluateHeatSinkConstraints', () => {
  it('returns baseTemperature, mass, finHeight, finGap, applicability in order with SI units', () => {
    expect(HEAT_SINK_CONSTRAINT_ORDER).toEqual(['baseTemperature', 'mass', 'finHeight', 'finGap', 'applicability'])
    const { a, e } = run('reference')
    expect(e.constraints.map((c) => [c.id, c.unit, c.bound, c.label])).toEqual([
      ['baseTemperature', 'K', 'upper', 'Base temperature'],
      ['mass', 'kg', 'upper', 'Mass'],
      ['finHeight', 'm', 'upper', 'Fin height'],
      ['finGap', 'm', 'lower', 'Fin gap'],
      ['applicability', 'bool', 'upper', 'Model applicability'],
    ])
    expect(e.constraints[0]).toEqual({
      id: 'baseTemperature',
      label: 'Base temperature',
      value: a.baseTemperatureK,
      limit: 328.15,
      unit: 'K',
      bound: 'upper',
      passed: true,
      utilization: a.baseTemperatureK / 328.15,
    })
    // The lower bound reports utilization = limit / value, so > 1 still means exceeded.
    expect(e.constraints[3]).toEqual({
      id: 'finGap',
      label: 'Fin gap',
      value: a.finGapM,
      limit: 0.004,
      unit: 'm',
      bound: 'lower',
      passed: true,
      utilization: 0.004 / a.finGapM,
    })
    expect(e.constraints[2]).toMatchObject({ value: 0.035, limit: 0.035, passed: true, utilization: 1 })
    expect(e.constraints[4]).toEqual({ id: 'applicability', label: 'Model applicability', value: 1, limit: 1, unit: 'bool', bound: 'upper', passed: true, utilization: 1 })
  })

  it('a failing gap has utilization above 1', () => {
    const gap = run('denseFins').e.constraints[3]
    expect(gap.passed).toBe(false)
    expect(gap.utilization).toBeGreaterThan(1)
  })

  it('labels contain no digits', () => {
    for (const label of Object.values(HEAT_SINK_CONSTRAINT_LABELS)) expect(label).not.toMatch(/\d/)
  })

  it('fails non-finite values without throwing and still returns all five', () => {
    const { a } = run('reference')
    const broken: HeatSinkAnalysis = { ...a, baseTemperatureK: Number.NaN, massKg: Number.POSITIVE_INFINITY, finHeightM: -Infinity, finGapM: Number.NaN }
    const cs = evaluateHeatSinkConstraints(broken, ch)
    // Non-finite values never pass, even −∞ below an upper limit.
    expect(cs.map((c) => c.passed)).toEqual([false, false, false, false, true])
    expect(cs).toHaveLength(5)
    expect(evaluateHeatSinkConstraints({ ...a, finGapM: Number.POSITIVE_INFINITY }, ch)[3].passed).toBe(false)
  })
})

describe('evaluateHeatSink', () => {
  it('accepts the reference with positive margins', () => {
    const { a, e } = run('reference')
    expect(e.status).toBe('accepted')
    expect(e.accepted).toBe(true)
    expect(e.failures).toEqual([])
    expect(e.efficiency).toEqual({
      temperatureMarginK: 328.15 - a.baseTemperatureK,
      massUsage: a.massKg / 0.13,
      gapMarginM: a.finGapM - 0.004,
    })
    expect(e.efficiency.temperatureMarginK).toBeGreaterThan(0)
    expect(e.efficiency.gapMarginM).toBeGreaterThan(0)
    expect(Object.isFrozen(e)).toBe(true)
    expect(Object.isFrozen(e.constraints[0])).toBe(true)
  })

  it('gives the baseline a negative temperature margin and baseTemperature as its only failure', () => {
    const { e } = run('baseline')
    expect(e.failures).toEqual(['baseTemperature'])
    expect(e.efficiency.temperatureMarginK).toBeLessThan(0)
    expect(e.efficiency.massUsage).toBeLessThan(1)
  })

  it('gives denseFins a negative gap margin', () => {
    expect(run('denseFins').e.efficiency.gapMarginM).toBeLessThan(0)
  })

  it('is modelNotApplicable, never Accepted, when the model does not apply', () => {
    const { f, a, e } = run('deepChannels')
    expect(a.applicable).toBe(false)
    expect(e.status).toBe('modelNotApplicable')
    expect(e.accepted).toBe(false)
    // Even with every numeric limit relaxed so all numeric constraints pass.
    const relaxed: HeatSinkChallenge = { ...ch, constraints: { maxBaseTemperatureK: 1000, maxMassKg: 10, maxFinHeightM: 1, minFinGapM: 0.0001 } }
    const r = evaluateHeatSink(f.design, a, relaxed)
    expect(r.failures).toEqual(['applicability'])
    expect(r.status).toBe('modelNotApplicable')
    expect(r.accepted).toBe(false)
  })

  it('ignores warnings: the acceptedWarning row is Accepted with a CHANNEL_ASPECT warning', () => {
    const { a, e } = run('acceptedWarning')
    expect(a.warnings.map((w) => w.code)).toEqual(['CHANNEL_ASPECT'])
    expect(e.status).toBe('accepted')
  })

  it('does not mutate its inputs', () => {
    const { f, a } = run('baseline')
    const before = structuredClone(a)
    evaluateHeatSink(f.design, a, ch)
    expect(a).toEqual(before)
  })
})

describe('inclusive boundaries via configured limits (HSK-13)', () => {
  const { f, a } = run('reference')
  type Limit = keyof HeatSinkChallenge['constraints']
  const upperKey: Record<'baseTemperature' | 'mass' | 'finHeight', [Limit, keyof HeatSinkAnalysis]> = {
    baseTemperature: ['maxBaseTemperatureK', 'baseTemperatureK'],
    mass: ['maxMassKg', 'massKg'],
    finHeight: ['maxFinHeightM', 'finHeightM'],
  }
  const withLimit = (limit: Limit, value: number): HeatSinkChallenge => ({ ...ch, constraints: { ...ch.constraints, [limit]: value } })

  it.each(Object.entries(upperKey))('%s passes when the value equals its limit and within REL_TOL above it', (id, [limit, field]) => {
    const value = a[field] as number
    const e = evaluateHeatSink(f.design, a, withLimit(limit, value))
    expect(e.constraints.find((c) => c.id === id)?.passed).toBe(true)
    expect(e.status).toBe('accepted')
    expect(evaluateHeatSink(f.design, a, withLimit(limit, value / (1 + 0.5 * REL_TOL))).accepted).toBe(true)
    const eb = evaluateHeatSink(f.design, a, withLimit(limit, value / (1 + 4 * REL_TOL)))
    expect(eb.failures).toEqual([id as HeatSinkConstraintId])
    expect(eb.status).toBe('notAccepted')
  })

  it.each(Object.entries(upperKey))('%s fails one double past the tolerance edge', (id, [limit, field]) => {
    const edge = toleranceEdge(ch.constraints[limit], REL_TOL)
    expect(evaluateHeatSinkConstraints({ ...a, [field]: edge }, ch).find((c) => c.id === id)?.passed).toBe(true)
    expect(evaluateHeatSinkConstraints({ ...a, [field]: nextUp(edge) }, ch).find((c) => c.id === id)?.passed).toBe(false)
  })

  it('finGap passes when the gap equals its minimum and within REL_TOL below it, fails beyond (withinLowerLimit)', () => {
    const s = a.finGapM
    expect(evaluateHeatSink(f.design, a, withLimit('minFinGapM', s)).status).toBe('accepted')
    expect(evaluateHeatSink(f.design, a, withLimit('minFinGapM', s * (1 + 0.5 * REL_TOL))).accepted).toBe(true)
    const eb = evaluateHeatSink(f.design, a, withLimit('minFinGapM', s * (1 + 4 * REL_TOL)))
    expect(eb.failures).toEqual(['finGap'])
    expect(eb.status).toBe('notAccepted')
  })

  it('finGap fails one double below the lower tolerance edge', () => {
    const edge = lowerToleranceEdge(ch.constraints.minFinGapM, REL_TOL)
    expect(evaluateHeatSinkConstraints({ ...a, finGapM: edge }, ch)[3].passed).toBe(true)
    expect(evaluateHeatSinkConstraints({ ...a, finGapM: nextDown(edge) }, ch)[3].passed).toBe(false)
  })

  it('thickFins sits at s = 4 mm and passes finGap inclusively', () => {
    const t = run('thickFins')
    expect(Math.abs(t.a.finGapM - 0.004)).toBeLessThan(1e-15)
    expect(t.e.constraints.find((c) => c.id === 'finGap')?.passed).toBe(true)
    expect(t.e.failures).toEqual(['mass'])
  })
})

describe('heatSinkEfficiency', () => {
  it('propagates non-finite values unclamped', () => {
    const { a } = run('reference')
    const e = heatSinkEfficiency({ ...a, massKg: Number.NaN, finGapM: Number.POSITIVE_INFINITY }, ch)
    expect(Number.isNaN(e.massUsage)).toBe(true)
    expect(e.gapMarginM).toBe(Number.POSITIVE_INFINITY)
  })
})
