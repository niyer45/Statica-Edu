import { describe, expect, it } from 'vitest'
import { fatigueChallenge, spindle, worksheetFixture } from '../../../test/fixtures/fatigue'
import { analyzeFatigue } from '../../physics/fatigue/analyze'
import type { FatigueAnalysis } from '../../physics/fatigue/types'
import { evaluateFatigueConstraints, FATIGUE_CONSTRAINT_LABELS, fatigueEfficiency } from './constraints'
import { evaluateFatigue } from './evaluate'
import { explainFatigueChange, explainFatigueSingle, FATIGUE_MODEL_LIMITS_FACT_ID } from './explain'
import { FATIGUE_COMPARISON_METRICS, FATIGUE_PRIMARY_METRIC } from './metrics'
import type { FatigueComparable } from './types'

const ch = fatigueChallenge()
function tested(name: string): FatigueComparable {
  const d = worksheetFixture(name).design
  const analysis = analyzeFatigue(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateFatigue(d, analysis, ch) }
}

describe('evaluateFatigue', () => {
  it('Baseline fails fatigue, yield and mass; the reference is Accepted', () => {
    const b = tested('baseline').evaluation
    expect(b.status).toBe('notAccepted')
    expect(b.failures).toEqual(['fatigueSafetyFactor', 'yieldSafetyFactor', 'mass'])
    const r = tested('reference').evaluation
    expect(r).toMatchObject({ status: 'accepted', accepted: true, failures: [] })
    expect(r.efficiency.fatigueMargin).toBeCloseTo(1.40168491090465 / 1.3 - 1, 12)
    expect(r.efficiency.shoulderFaceMarginM).toBeCloseTo(0.00025, 12)
  })

  it('limits equal to the values pass on both bounds; one relative step beyond fails', () => {
    const a = analyzeFatigue(ch.referenceDesign!, ch)
    const exact = { constraints: { minFatigueSafetyFactor: a.fatigueSafetyFactor, minYieldSafetyFactor: a.yieldSafetyFactor, maxMassKg: a.massKg, minShoulderFaceM: a.shoulderFaceM } }
    expect(evaluateFatigueConstraints(a, exact).every((c) => c.passed)).toBe(true)
    const over = { constraints: { minFatigueSafetyFactor: a.fatigueSafetyFactor * (1 + 1e-8), minYieldSafetyFactor: a.yieldSafetyFactor * (1 + 1e-8), maxMassKg: a.massKg * (1 - 1e-8), minShoulderFaceM: a.shoulderFaceM * (1 + 1e-8) } }
    expect(evaluateFatigueConstraints(a, over).filter((c) => !c.passed).map((c) => c.id)).toEqual(['fatigueSafetyFactor', 'yieldSafetyFactor', 'mass', 'shoulderFace'])
  })

  it('non-finite values never pass and margins propagate them', () => {
    const a = { ...analyzeFatigue(ch.initialDesign, ch), fatigueSafetyFactor: Number.NaN, massKg: Number.POSITIVE_INFINITY } as FatigueAnalysis
    const cs = evaluateFatigueConstraints(a, ch)
    expect(cs.find((c) => c.id === 'fatigueSafetyFactor')!.passed).toBe(false)
    expect(cs.find((c) => c.id === 'mass')!.passed).toBe(false)
    expect(Number.isNaN(fatigueEfficiency(a, ch).fatigueMargin)).toBe(true)
    // Non-finite utilizations produce no utilization fact.
    expect(explainFatigueSingle(cs, a).map((f) => f.id)).not.toContain('single.utilization.mass')
  })

  it('a not-applicable design is never Accepted', () => {
    const e = tested('fitRangeNA').evaluation
    expect(e.status).toBe('modelNotApplicable')
    expect(e.accepted).toBe(false)
  })

  it('labels contain no digits and the facts describe the life regime', () => {
    for (const label of Object.values(FATIGUE_CONSTRAINT_LABELS)) expect(label).not.toMatch(/\d/)
    const base = tested('baseline').evaluation.facts
    expect(base.find((f) => f.id === 'single.life')!.text).toBe('The S-N line predicts failure after about 6.99 thousand cycles at this stress.')
    expect(base.find((f) => f.id === 'single.notch')!.text).toContain('Kt 2.36')
    expect(base.find((f) => f.id === 'single.utilization.fatigueSafetyFactor')!.text).toContain('required minimum is 2.09 times')
    expect(base.find((f) => f.id === 'single.utilization.mass')!.text).toBe('Mass is 1.30 times its limit in this model (past its limit).')
    expect(tested('reference').evaluation.facts.find((f) => f.id === 'single.life')!.text).toMatch(/no fatigue failure/)
    expect(tested('fitRangeNA').evaluation.facts.map((f) => f.id)).not.toContain('single.life')
    expect(base.at(-1)!.id).toBe(FATIGUE_MODEL_LIMITS_FACT_ID)
  })

  it('change facts compare stored values and report flipped checks', () => {
    const facts = explainFatigueChange(tested('baseline'), tested('reference'))
    expect(facts.map((f) => f.id)).toEqual([
      'change.kf',
      'change.endurance',
      'change.stress',
      'change.fatigue',
      'change.mass',
      'change.constraint.fatigueSafetyFactor',
      'change.constraint.yieldSafetyFactor',
      'change.constraint.mass',
      FATIGUE_MODEL_LIMITS_FACT_ID,
    ])
    expect(facts.find((f) => f.id === 'change.fatigue')!.text).toBe('The fatigue safety factor changed by ×2.25.')
    expect(facts.find((f) => f.id === 'change.mass')!.text).toBe('Mass changed by -171.30 g.')
    const same = explainFatigueChange(tested('reference'), tested('reference'))
    expect(same.find((f) => f.id === 'change.mass')!.text).toBe('Mass changed by 0.00 g.')
    const heavier = explainFatigueChange(tested('reference'), tested('allMax'))
    expect(heavier.find((f) => f.id === 'change.mass')!.text).toMatch(/^Mass changed by \+/)
  })
})

describe('fatigue metrics', () => {
  it('reads stored values and returns undefined for absent life', () => {
    const ref = analyzeFatigue(ch.referenceDesign!, ch)
    expect(FATIGUE_PRIMARY_METRIC.read(ref)).toBe(ref.fatigueSafetyFactor)
    const life = FATIGUE_COMPARISON_METRICS.find((m) => m.id === 'predictedLifeCycles')!
    expect(life.read(ref)).toBeUndefined()
    expect(life.read(analyzeFatigue(spindle('b', 0.022, 0.045, 0.001, 'asForged'), ch))).toBeCloseTo(6993.74165928361, 6)
    for (const m of FATIGUE_COMPARISON_METRICS) expect(m.label).not.toMatch(/\d/)
  })
})
