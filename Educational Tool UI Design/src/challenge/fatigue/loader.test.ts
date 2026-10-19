import { describe, expect, it } from 'vitest'
import json from '../challenges/fatigue-analysis-1.json'
import { FATIGUE_CROSS_FIELD_RULES, loadFatigueChallenge } from './loader'

// Task 70 (FAT-13, MM-02): the bundled config loads and is frozen; every structural and
// cross-field rule rejects its own violation with a stable rule id.

type Json = Record<string, unknown>
const clone = (): Json => JSON.parse(JSON.stringify(json)) as Json
const rules = (data: unknown) => {
  const r = loadFatigueChallenge(data)
  return r.ok ? [] : r.error.map((i) => i.rule)
}
const R = FATIGUE_CROSS_FIELD_RULES

describe('loadFatigueChallenge', () => {
  it('loads the bundled config, deep-frozen and detached from the input', () => {
    const r = loadFatigueChallenge(json)
    if (!r.ok) throw new Error(JSON.stringify(r.error))
    expect(r.value.model).toEqual({ id: 'steppedShaftFatigue', version: 1 })
    expect(Object.isFrozen(r.value.designLimits.neckDiameterM)).toBe(true)
    expect(r.value).not.toBe(json)
    expect(loadFatigueChallenge(JSON.stringify(json)).ok).toBe(true)
  })

  it('reports JSON parse failures and hostile input without throwing', () => {
    expect(rules('{')).toEqual(['JSON_PARSE'])
    const hostile = new Proxy({}, { get() { throw new Error('boom') }, ownKeys() { throw new Error('boom') } })
    expect(rules(hostile)).toEqual(['UNEXPECTED'])
  })

  it('requires the exact model identity and rejects unknown keys at any level', () => {
    expect(rules({ ...clone(), model: { id: 'circularShaftTorsion', version: 1 } })).toContain('invalid_literal')
    const extra = clone()
    ;(extra.load as Json).preload = 1
    const r = loadFatigueChallenge(extra)
    expect(!r.ok && r.error).toEqual([{ path: 'load.preload', rule: 'unrecognized_keys', message: 'Unknown key "preload" is not defined by the fatigue challenge schema.' }])
  })

  const cases: [string, (c: Json) => unknown, string][] = [
    ['inverted range', (c: Json) => ((c.designLimits as Json).filletRadiusM = { minM: 0.006, maxM: 0.005, stepM: 0.00025 }), R.RANGE_MIN_GT_MAX],
    ['Sut below the Neuber fit', (c: Json) => Object.assign(c.material as Json, { ultimateStrengthPa: 300e6, yieldStrengthPa: 200e6 }), R.NEUBER_RANGE],
    ['Sut above the S-N estimate range', (c: Json) => Object.assign(c.material as Json, { ultimateStrengthPa: 1500e6 }), R.ENDURANCE_RANGE],
    ['yield above ultimate', (c: Json) => Object.assign(c.material as Json, { yieldStrengthPa: 700e6 }), R.YIELD_ABOVE_ULTIMATE],
    ['neck range outside the size factor', (c: Json) => ((c.designLimits as Json).neckDiameterM = { minM: 0.005, maxM: 0.04, stepM: 0.0005 }), R.SIZE_FACTOR_RANGE],
    ['ranges beyond the Kt chart', (c: Json) => ((c.designLimits as Json).collarDiameterM = { minM: 0.03, maxM: 0.07, stepM: 0.0005 }), R.KT_CHART_RANGE],
    ['target life beyond a million cycles', (c: Json) => (c.targetLifeCycles = 2e6), R.TARGET_LIFE_RANGE],
    ['wrong reliability factor', (c: Json) => (c.reliability = { percent: 90, factor: 0.9 }), R.RELIABILITY_FACTOR],
    ['untabulated reliability', (c: Json) => (c.reliability = { percent: 80, factor: 0.9 }), R.RELIABILITY_FACTOR],
    ['load beyond the neck', (c: Json) => ((c.load as Json).armM = 0.07), R.LOAD_OFF_NECK],
    ['duplicate finish', (c: Json) => (c.allowedFinishes = ['ground', 'ground']), R.DUPLICATE_FINISH],
    ['design material mismatch', (c: Json) => ((c.referenceDesign as Json).materialId = 'other'), R.DESIGN_MATERIAL_MISMATCH],
    ['invalid design', (c: Json) => ((c.initialDesign as Json).filletRadiusM = 0.02), R.DESIGN_INVALID],
    ['baseline finish not offered', (c: Json) => (c.allowedFinishes = ['ground', 'machined']), R.DESIGN_INVALID],
    ['missing locked field', (c: Json) => (c.lockedFields = ['materialId', 'load', 'geometry']), R.LOCKED_FIELD_MISSING],
  ]
  it.each(cases)('rejects %s', (_name, mutate, rule) => {
    const c = clone()
    mutate(c)
    expect(rules(c)).toContain(rule)
  })

  it('accepts a config without a reference design', () => {
    const c = clone()
    delete c.referenceDesign
    expect(loadFatigueChallenge(c).ok).toBe(true)
  })
})
