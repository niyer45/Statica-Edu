import { describe, expect, it } from 'vitest'
import { heatSinkChallenge, worksheetFixture } from '../../../test/fixtures/heatSink'
import { analyzeHeatSink } from '../../physics/heatSink/analyze'
import { evaluateHeatSink } from './evaluate'
import { explainHeatSinkChange, explainHeatSinkSingle, HEAT_SINK_MODEL_LIMITS_FACT_ID, heatSinkModelLimitsFact } from './explain'
import type { HeatSinkComparable } from './types'

// Grounded heat sink explanation facts (task 48.2; HSK-15, MM-14).

const ch = heatSinkChallenge()
function tested(name: string): HeatSinkComparable {
  const f = worksheetFixture(name)
  const analysis = analyzeHeatSink(f.design, ch)
  return { designSnapshot: f.design, analysis, evaluation: evaluateHeatSink(f.design, analysis, ch) }
}

describe('explainHeatSinkSingle', () => {
  it('gives one fact per numeric constraint, then the model fact', () => {
    const r = tested('baseline')
    const facts = r.evaluation.facts
    expect(facts.map((f) => f.id)).toEqual([
      'single.utilization.baseTemperature',
      'single.utilization.mass',
      'single.utilization.finHeight',
      'single.utilization.finGap',
      HEAT_SINK_MODEL_LIMITS_FACT_ID,
    ])
    const [temp, mass, , gap] = r.evaluation.constraints
    const marginK = Math.abs(temp.limit - temp.value)
    expect(facts[0]).toEqual({
      id: 'single.utilization.baseTemperature',
      text: `Base temperature is ${marginK.toFixed(2)} K above its limit in this model (over its limit).`,
      basis: { value: temp.value, limit: temp.limit, marginK },
    })
    expect(facts[1]).toEqual({
      id: 'single.utilization.mass',
      text: `Mass is ${mass.utilization.toFixed(2)} times its limit in this model (within its limit).`,
      basis: { value: mass.value, limit: mass.limit, utilization: mass.utilization },
    })
    expect(facts[3]).toEqual({
      id: 'single.utilization.finGap',
      text: 'Fin gap is 4.00 times its minimum in this model (meets its minimum).',
      basis: { value: gap.value, limit: gap.limit, ratio: gap.value / gap.limit },
    })
    expect(facts.at(-1)).toEqual(heatSinkModelLimitsFact())
  })

  it('words a passing temperature as below its limit and a failing gap as below its minimum', () => {
    expect(tested('reference').evaluation.facts[0].text).toMatch(/^Base temperature is \d+\.\d\d K below its limit in this model \(within its limit\)\.$/)
    expect(tested('denseFins').evaluation.facts[3].text).toBe('Fin gap is 0.88 times its minimum in this model (below its minimum).')
  })

  it('skips facts for non-finite constraint values', () => {
    const cs = tested('reference').evaluation.constraints.map((c) => (c.id === 'mass' || c.id === 'finGap' ? { ...c, value: Number.NaN, utilization: Number.NaN } : c))
    const ids = explainHeatSinkSingle(cs).map((f) => f.id)
    expect(ids).not.toContain('single.utilization.mass')
    expect(ids).not.toContain('single.utilization.finGap')
    expect(ids).toContain('single.utilization.baseTemperature')
  })

  it('the model fact says the coefficient is given, names unmodeled effects and has no numbers', () => {
    const text = heatSinkModelLimitsFact().text
    expect(text).not.toMatch(/\d/)
    expect(text).toContain('given convection coefficient')
    expect(text).toContain('airflow between the fins')
  })
})

describe('explainHeatSinkChange', () => {
  it('baseline → reference compares effective area, rise, mass and fin efficiency and the pass changes', () => {
    const prev = tested('baseline')
    const next = tested('reference')
    const facts = explainHeatSinkChange(prev, next)
    const rArea = next.analysis.effectiveAreaM2 / prev.analysis.effectiveAreaM2
    const rRise = next.analysis.baseTemperatureRiseK / prev.analysis.baseTemperatureRiseK
    const rMass = next.analysis.massKg / prev.analysis.massKg
    expect(facts.map((f) => f.id)).toEqual([
      'change.effectiveArea',
      'change.massAndRise',
      'change.finEfficiency',
      'change.constraint.baseTemperature',
      HEAT_SINK_MODEL_LIMITS_FACT_ID,
    ])
    expect(facts[0]).toEqual({
      id: 'change.effectiveArea',
      text:
        `Effective surface area (fin-efficiency weighted) changed by ×${rArea.toFixed(2)}; in this model, the convective part ` +
        `of the temperature rise scales inversely with it, so the base temperature rise changed by ×${rRise.toFixed(2)}.`,
      basis: { rArea, rRise },
    })
    expect(facts[1].basis).toEqual({ rMass, rRise })
    expect(facts[2]).toEqual({
      id: 'change.finEfficiency',
      text: 'Fin efficiency changed from 0.99 to 0.93; in this model, fin efficiency falls as fins get taller or thinner.',
      basis: { prev: prev.analysis.finEfficiency, next: next.analysis.finEfficiency },
    })
    expect(facts[3].text).toBe('Base temperature: fail → pass.')
  })

  it('adds the same-mass fact when mass holds and the rise drops', () => {
    // eightFins (116.64 g) → gapWarning (116.64 g): same mass, more surface.
    const facts = explainHeatSinkChange(tested('eightFins'), tested('gapWarning'))
    const same = facts.find((f) => f.id === 'change.sameMass')
    expect(same?.basis.rMass).toBeCloseTo(1, 12)
    expect(same?.basis.rRise).toBeLessThan(0.98)
    expect(facts.map((f) => f.id)).toContain('change.constraint.finGap')
  })

  it('omits the fin-efficiency fact when η_f is unchanged (it depends on t and H only)', () => {
    const ids = explainHeatSinkChange(tested('acceptedWarning'), tested('denseFins')).map((f) => f.id)
    expect(ids).not.toContain('change.finEfficiency')
    expect(ids).toContain('change.constraint.finGap')
  })

  it('skips ratio facts for non-finite stored values but keeps the model fact last', () => {
    const prev = tested('baseline')
    const broken: HeatSinkComparable = { ...prev, analysis: { ...prev.analysis, effectiveAreaM2: 0, massKg: 0, finEfficiency: Number.NaN } }
    const ids = explainHeatSinkChange(broken, tested('reference')).map((f) => f.id)
    expect(ids).not.toContain('change.effectiveArea')
    expect(ids).not.toContain('change.massAndRise')
    expect(ids).not.toContain('change.finEfficiency')
    expect(ids.at(-1)).toBe(HEAT_SINK_MODEL_LIMITS_FACT_ID)
  })

  it('is deterministic', () => {
    expect(explainHeatSinkChange(tested('baseline'), tested('tallFins'))).toEqual(explainHeatSinkChange(tested('baseline'), tested('tallFins')))
  })
})
