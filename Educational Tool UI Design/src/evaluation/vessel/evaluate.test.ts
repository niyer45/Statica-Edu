import { describe, expect, it } from 'vitest'
import { vesselChallenge, vesselFixture } from '../../../test/fixtures/vessel'
import { analyzeVessel } from '../../physics/vessel/analyze'
import type { VesselAnalysis } from '../../physics/vessel/types'
import { evaluateVesselConstraints, vesselEfficiency, VESSEL_CONSTRAINT_LABELS, VESSEL_CONSTRAINT_ORDER } from './constraints'
import { evaluateVessel } from './evaluate'
import { VESSEL_COMPARISON_METRICS, VESSEL_PRIMARY_METRIC } from './metrics'

// Pressure vessel evaluation (task 69; PVS-07, PVS-08, MM-11, MM-13).

const ch = vesselChallenge()
const tested = (name: string) => {
  const d = vesselFixture(name).design
  const a = analyzeVessel(d, ch)
  return { d, a, e: evaluateVessel(d, a, ch) }
}

describe('vessel constraints', () => {
  it('reports seven checks in the fixed order with digit-free labels', () => {
    const { a } = tested('baseline')
    const cs = evaluateVesselConstraints(a, ch)
    expect(cs.map((c) => c.id)).toEqual([...VESSEL_CONSTRAINT_ORDER])
    expect(cs.map((c) => c.unit)).toEqual(['Pa', 'Pa', 'Pa', 'm3', 'm', 'kg', 'bool'])
    expect(cs.map((c) => c.bound)).toEqual(['max', 'max', 'max', 'min', 'max', 'max', 'max'])
    for (const label of Object.values(VESSEL_CONSTRAINT_LABELS)) expect(label).not.toMatch(/\d/)
  })

  it('uses the allowable σ_y / n for all three stresses and the configured limits for the rest', () => {
    const cs = evaluateVesselConstraints(tested('reference').a, ch)
    expect(cs.slice(0, 3).map((c) => c.limit)).toEqual([125e6, 125e6, 125e6])
    expect(cs[3]!.limit).toBe(0.1)
    expect(cs[4]!.limit).toBe(1)
    expect(cs[5]!.limit).toBe(55)
  })

  it('treats the volume as a minimum: passes at or above it, with utilization limit ÷ value', () => {
    const { a } = tested('baseline')
    const volume = evaluateVesselConstraints(a, ch)[3]!
    expect(volume.passed).toBe(false)
    expect(volume.utilization).toBeCloseTo(0.1 / a.volumeM3, 12)
    expect(volume.utilization).toBeGreaterThan(1)
    const exact = evaluateVesselConstraints({ ...a, volumeM3: 0.1 }, ch)[3]!
    expect(exact.passed).toBe(true)
    expect(exact.utilization).toBe(1)
  })

  it('never passes a non-finite value and mirrors applicability as a bool', () => {
    const a = tested('reference').a
    const broken = { ...a, hoopStressPa: Number.NaN, volumeM3: Number.POSITIVE_INFINITY, applicable: false } as VesselAnalysis
    const cs = evaluateVesselConstraints(broken, ch)
    expect(cs[0]!.passed).toBe(false)
    expect(cs[3]!.passed).toBe(false)
    expect(cs[6]).toMatchObject({ value: 0, limit: 1, passed: false, utilization: 0 })
    const nanVolume = evaluateVesselConstraints({ ...a, volumeM3: Number.NaN }, ch)[3]!
    expect(nanVolume.passed).toBe(false)
  })

  it('reports unclamped margins from stored values', () => {
    const { a } = tested('reference')
    expect(vesselEfficiency(a, ch)).toEqual({
      massUsage: a.massKg / 55,
      hoopMargin: 1 - a.hoopStressPa / 125e6,
      headMargin: 1 - a.headStressPa / 125e6,
      volumeMargin: a.volumeM3 / 0.1 - 1,
    })
  })
})

describe('evaluateVessel', () => {
  it('Accepted iff applicable and every check passes; not applicable is never Accepted', () => {
    expect(tested('reference').e).toMatchObject({ status: 'accepted', accepted: true, failures: [] })
    expect(tested('baseline').e).toMatchObject({ status: 'notAccepted', accepted: false, failures: ['hoopStress', 'headStress', 'volume', 'overallLength'] })
    expect(tested('thickWallNotApplicable').e).toMatchObject({ status: 'modelNotApplicable', accepted: false })
    expect(tested('thickShellWarning').e.status).toBe('notAccepted')
    expect(Object.isFrozen(tested('reference').e)).toBe(true)
  })
})

describe('vessel metrics', () => {
  it('scores predictions on the hoop stress and reads stored values only', () => {
    const { a } = tested('baseline')
    expect(VESSEL_PRIMARY_METRIC).toMatchObject({ id: 'hoopStressPa', label: 'hoop stress' })
    expect(VESSEL_PRIMARY_METRIC.read(a)).toBe(a.hoopStressPa)
    expect(VESSEL_PRIMARY_METRIC.read({ ...a, hoopStressPa: Number.NaN })).toBeUndefined()
    expect(VESSEL_PRIMARY_METRIC.read({ ...a, hoopStressPa: -1 })).toBeUndefined()
    expect(VESSEL_COMPARISON_METRICS.map((m) => m.id)).toEqual(['hoopStressPa', 'longitudinalStressPa', 'headStressPa', 'volumeM3', 'overallLengthM', 'massKg', 'shellRadiusRatio'])
    for (const m of VESSEL_COMPARISON_METRICS) {
      expect(m.label).not.toMatch(/\d/)
      expect(m.read(a)).toBe(a[m.id])
    }
  })
})
