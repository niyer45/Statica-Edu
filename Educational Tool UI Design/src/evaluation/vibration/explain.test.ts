import { describe, expect, it } from 'vitest'
import { vibrationChallenge, worksheetFixture } from '../../../test/fixtures/vibration'
import { analyzeIsolator } from '../../physics/vibration/analyze'
import { evaluateIsolator } from './evaluate'
import { explainIsolatorSingle, explainVibrationChange, VIBRATION_MODEL_LIMITS_FACT_ID, vibrationModelLimitsFact } from './explain'
import type { VibrationComparable } from './types'

// Grounded vibration explanation facts (task 50.2; design.md "Explanation facts", MM-14).

const ch = vibrationChallenge()
function tested(name: string): VibrationComparable {
  const f = worksheetFixture(name)
  const analysis = analyzeIsolator(f.design, ch)
  return { designSnapshot: f.design, analysis, evaluation: evaluateIsolator(f.design, analysis, ch) }
}

describe('explainIsolatorSingle', () => {
  it('gives one utilization fact per numeric constraint, then the model fact', () => {
    const r = tested('baseline')
    const facts = r.evaluation.facts
    expect(facts.map((f) => f.id)).toEqual([
      'single.utilization.worstInBandTransmissibility',
      'single.utilization.staticDeflection',
      'single.utilization.peakTransmissibility',
      'single.utilization.relativeDisplacement',
      VIBRATION_MODEL_LIMITS_FACT_ID,
    ])
    const tr = r.evaluation.constraints[0]
    expect(facts[0]).toEqual({
      id: 'single.utilization.worstInBandTransmissibility',
      text: `Worst vibration transmitted in the operating band is ${tr.utilization.toFixed(2)} times its limit in this model (over its limit).`,
      basis: { value: tr.value, limit: tr.limit, utilization: tr.utilization },
    })
    expect(facts[1].text).toContain('(within its limit)')
    expect(facts.at(-1)).toEqual(vibrationModelLimitsFact())
  })

  it('skips facts for non-finite constraint values', () => {
    const cs = tested('reference').evaluation.constraints.map((c) => (c.id === 'staticDeflection' ? { ...c, value: Number.NaN, utilization: Number.NaN } : c))
    expect(explainIsolatorSingle(cs).map((f) => f.id)).not.toContain('single.utilization.staticDeflection')
  })

  it('the model fact names unmodeled effects, says steady state, and has no numbers', () => {
    expect(vibrationModelLimitsFact().text).not.toMatch(/\d/)
    expect(vibrationModelLimitsFact().text).toContain('steady-state')
  })
})

describe('explainVibrationChange', () => {
  it('baseline → reference compares stiffness, f_n, sag and worst-band ratios, names the material and the pass changes', () => {
    const prev = tested('baseline')
    const next = tested('reference')
    const facts = explainVibrationChange(prev, next, ch)
    const rK = 85000 / 1800000
    const rFn = next.analysis.naturalFrequencyHz / prev.analysis.naturalFrequencyHz
    expect(facts.map((f) => f.id)).toEqual([
      'change.naturalFrequency',
      'change.staticDeflection',
      'change.worstInBand',
      'change.material',
      'change.constraint.worstInBandTransmissibility',
      'change.constraint.peakTransmissibility',
      'change.constraint.relativeDisplacement',
      VIBRATION_MODEL_LIMITS_FACT_ID,
    ])
    expect(facts[0]).toEqual({
      id: 'change.naturalFrequency',
      text: `Stiffness changed by ×${rK.toFixed(2)}; in this model, the natural frequency scales with the square root of stiffness, so it changed by ×${rFn.toFixed(2)}.`,
      basis: { rK, rFn },
    })
    expect(facts[0].text).toBe(
      'Stiffness changed by ×0.05; in this model, the natural frequency scales with the square root of stiffness, so it changed by ×0.22.',
    )
    expect(Math.abs(rFn - Math.sqrt(rK))).toBeLessThan(1e-15)
    expect(facts[1].text).toBe('Static deflection (sag) changed by ×21.18; in this model, sag scales inversely with stiffness.')
    expect(facts[2].text).toBe('The worst vibration transmitted in the operating band changed by ×0.01.')
    expect(facts[3]).toEqual({
      id: 'change.material',
      text: 'Mount material changed from Natural rubber to Neoprene: damping ratio 0.05 → 0.10.',
      basis: { prevZeta: 0.05, nextZeta: 0.1 },
    })
    expect(facts[4].text).toBe('Worst vibration transmitted in the operating band: fail → pass.')
  })

  it('reports no material fact at the same ζ and lists constraint changes in fixed order', () => {
    const ids = explainVibrationChange(tested('sagBoundary'), tested('sagOnGridFail'), ch).map((f) => f.id)
    expect(ids).toEqual([
      'change.naturalFrequency',
      'change.staticDeflection',
      'change.worstInBand',
      'change.constraint.staticDeflection',
      VIBRATION_MODEL_LIMITS_FACT_ID,
    ])
  })

  it('reports applicability changes and skips ratio facts for non-finite ratios', () => {
    const prev = tested('reference')
    const next = tested('tooSoftLight')
    expect(explainVibrationChange(prev, next, ch).map((f) => f.id)).toContain('change.constraint.applicability')
    const zeroed: VibrationComparable = {
      ...prev,
      analysis: { ...prev.analysis, stiffnessNPerM: 0, naturalFrequencyHz: 0, staticDeflectionM: 0, worstInBandTransmissibility: 0 },
    }
    const ids = explainVibrationChange(zeroed, next, ch).map((f) => f.id)
    expect(ids).not.toContain('change.naturalFrequency')
    expect(ids).not.toContain('change.staticDeflection')
    expect(ids).not.toContain('change.worstInBand')
  })

  it('falls back to a generic name for an unlisted material and skips non-finite ζ', () => {
    const prev = tested('reference')
    const next = tested('dampedReference')
    const renamed: VibrationComparable = { ...next, designSnapshot: { ...next.designSnapshot, materialId: 'gone' } }
    const fact = explainVibrationChange(prev, renamed, ch).find((f) => f.id === 'change.material')
    expect(fact?.text).toBe('Mount material changed from Neoprene to another material: damping ratio 0.10 → 0.20.')
    const broken: VibrationComparable = { ...next, analysis: { ...next.analysis, dampingRatio: Number.NaN } }
    expect(explainVibrationChange(prev, broken, ch).map((f) => f.id)).not.toContain('change.material')
  })

  it('skips constraints missing from either evaluation and is deterministic', () => {
    const prev = tested('baseline')
    const next = tested('reference')
    const trimmed: VibrationComparable = { ...next, evaluation: { ...next.evaluation, constraints: [] } }
    expect(explainVibrationChange(prev, trimmed, ch).some((f) => f.id.startsWith('change.constraint.'))).toBe(false)
    expect(explainVibrationChange(prev, next, ch)).toEqual(explainVibrationChange(prev, next, ch))
  })
})
