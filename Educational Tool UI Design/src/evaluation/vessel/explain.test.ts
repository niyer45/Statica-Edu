import { describe, expect, it } from 'vitest'
import { vesselChallenge, vesselFixture } from '../../../test/fixtures/vessel'
import { analyzeVessel } from '../../physics/vessel/analyze'
import { evaluateVessel } from './evaluate'
import { explainVesselChange, explainVesselSingle, vesselModelLimitsFact, VESSEL_MODEL_LIMITS_FACT_ID } from './explain'
import type { VesselComparable } from './types'

// Grounded pressure vessel explanation facts (task 69; MM-14).

const ch = vesselChallenge()
const tested = (name: string): VesselComparable => {
  const d = vesselFixture(name).design
  const analysis = analyzeVessel(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateVessel(d, analysis, ch) }
}

describe('single-result facts', () => {
  it('state utilizations, the hoop-to-longitudinal ratio and the head-to-hoop ratio, then the model limits', () => {
    const facts = tested('baseline').evaluation.facts
    expect(facts.map((f) => f.id)).toEqual([
      'single.utilization.hoopStress',
      'single.utilization.longitudinalStress',
      'single.utilization.headStress',
      'single.utilization.volume',
      'single.utilization.overallLength',
      'single.utilization.mass',
      'single.hoopToLongitudinal',
      'single.headToHoop',
      VESSEL_MODEL_LIMITS_FACT_ID,
    ])
    const text = (id: string) => facts.find((f) => f.id === id)!.text
    expect(text('single.utilization.hoopStress')).toBe('Hoop stress (shell) is 1.54 times its limit in this model (over its limit).')
    expect(text('single.utilization.longitudinalStress')).toBe('Longitudinal stress (shell) is 0.77 times its limit in this model (within its limit).')
    expect(text('single.utilization.volume')).toBe('Internal volume is 0.62 times the required minimum in this model (too small).')
    expect(text('single.hoopToLongitudinal')).toBe('The hoop stress is ×2.00 the longitudinal stress, so the hoop stress governs the shell.')
    expect(text('single.headToHoop')).toMatch(/^The head stress is ×0\.83 the hoop stress/)
  })

  it('reports an enough-volume fact and skips non-finite values', () => {
    const ref = tested('reference')
    expect(ref.evaluation.facts.find((f) => f.id === 'single.utilization.volume')!.text).toMatch(/\(enough\)\.$/)
    const cs = ref.evaluation.constraints.map((c) => (c.id === 'volume' ? { ...c, value: Number.NaN } : c.id === 'mass' ? { ...c, limit: 0, utilization: Number.POSITIVE_INFINITY } : c))
    const facts = explainVesselSingle(cs, { hoopStressPa: 1, longitudinalStressPa: 0, headStressPa: Number.NaN })
    expect(facts.map((f) => f.id)).not.toContain('single.utilization.volume')
    expect(facts.map((f) => f.id)).not.toContain('single.utilization.mass')
    expect(facts.map((f) => f.id)).not.toContain('single.hoopToLongitudinal')
    expect(facts.map((f) => f.id)).not.toContain('single.headToHoop')
    const zeroVolume = ref.evaluation.constraints.map((c) => (c.id === 'volume' ? { ...c, limit: 0 } : c))
    expect(explainVesselSingle(zeroVolume, ref.analysis).map((f) => f.id)).not.toContain('single.utilization.volume')
  })

  it('names the unmodeled junction stresses and the code disclaimer, with no numbers', () => {
    const f = vesselModelLimitsFact()
    expect(f.text).toMatch(/heads meet the shell/)
    expect(f.text).toMatch(/not a pressure-vessel code check/)
    expect(f.text).not.toMatch(/\d/)
    expect(f.basis).toEqual({})
  })
})

describe('change facts', () => {
  it('compare stored values as ratios, the mass in kilograms, and pass changes', () => {
    const facts = explainVesselChange(tested('baseline'), tested('reference'))
    expect(facts.map((f) => f.id)).toEqual([
      'change.hoopStress',
      'change.headStress',
      'change.volume',
      'change.mass',
      'change.constraint.hoopStress',
      'change.constraint.headStress',
      'change.constraint.volume',
      'change.constraint.overallLength',
      VESSEL_MODEL_LIMITS_FACT_ID,
    ])
    expect(facts[0]!.text).toBe('Hoop stress changed by ×0.64; it grows with the radius and falls with the shell thickness.')
    expect(facts[3]!.text).toBe('Mass changed by +28.49 kg.')
    expect(facts[4]!.text).toBe('Hoop stress (shell): fail → pass.')
  })

  it('writes a negative mass change without a plus sign and is deterministic', () => {
    const facts = explainVesselChange(tested('equalHeads'), tested('reference'))
    expect(facts.find((f) => f.id === 'change.mass')!.text).toBe('Mass changed by -12.44 kg.')
    expect(explainVesselChange(tested('equalHeads'), tested('reference'))).toEqual(facts)
  })

  it('omits a ratio that is not finite', () => {
    const prev = tested('baseline')
    const broken = { ...prev, analysis: { ...prev.analysis, hoopStressPa: 0, headStressPa: 0, volumeM3: 0, massKg: Number.NaN } }
    const ids = explainVesselChange(broken, tested('reference')).map((f) => f.id)
    expect(ids).not.toContain('change.hoopStress')
    expect(ids).not.toContain('change.headStress')
    expect(ids).not.toContain('change.volume')
    expect(ids).not.toContain('change.mass')
  })
})
