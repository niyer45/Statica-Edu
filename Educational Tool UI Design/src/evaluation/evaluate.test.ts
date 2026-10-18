import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../challenge/content'
import type { Challenge } from '../challenge/types'
import type { BeamDesign, Orientation, Section } from '../geometry/sections'
import { analyze } from '../physics/analyze'
import type { Analysis } from '../physics/types'
import { CONSTRAINT_ORDER, evaluateConstraints } from './constraints'
import { evaluate } from './evaluate'
import { FACT_DIGITS, MODEL_LIMITS_FACT_ID, formatBasis } from './explain'
import type { ConstraintId } from './types'

if (!bundledChallengeResult.ok) throw new Error('bundled challenge failed to load')
const ch: Challenge = bundledChallengeResult.value
const L = ch.initialDesign.lengthM

const mm = (x: number) => x / 1000
const design = (section: Section, orientationDeg: Orientation = 0): BeamDesign => ({
  id: 'd',
  section,
  orientationDeg,
  lengthM: L,
  materialId: ch.material.id,
})
const circle = (d: number): Section => ({ kind: 'circle', diameterM: mm(d) })
const tube = (D: number, d: number): Section => ({ kind: 'tube', outerDiameterM: mm(D), innerDiameterM: mm(d) })
const rect = (b: number, h: number): Section => ({ kind: 'rectangle', widthM: mm(b), heightM: mm(h) })
const iSection = (h: number, b: number, tf: number, tw: number): Section => ({
  kind: 'iSection',
  heightM: mm(h),
  widthM: mm(b),
  flangeThicknessM: mm(tf),
  webThicknessM: mm(tw),
})

const run = (d: BeamDesign) => {
  const a = analyze(d, ch)
  return { a, e: evaluate(d, a, ch) }
}
const relClose = (actual: number, expected: number, rel = 1e-3) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(rel * Math.abs(expected))

/** Challenge copy with overridden constraint limits (the bundled one is frozen). */
const withLimits = (k: Partial<Challenge['constraints']>): Challenge => ({
  ...ch,
  constraints: { ...ch.constraints, ...k },
})

const reference = design(iSection(60, 40, 4, 3))

describe('evaluate: design fixtures (Req 12.7–12.9)', () => {
  const rows: { name: string; d: BeamDesign; status: string; failures: ConstraintId[] }[] = [
    { name: 'baseline', d: design(circle(30)), status: 'notAccepted', failures: ['deflection'] },
    { name: 'reference', d: reference, status: 'accepted', failures: [] },
    { name: 'tubeSameMass', d: design(tube(50, 40)), status: 'accepted', failures: [] },
    { name: 'rectTall', d: design(rect(15, 45)), status: 'accepted', failures: [] },
    { name: 'rectFlat', d: design(rect(15, 45), 90), status: 'notAccepted', failures: ['deflection'] },
    { name: 'heavySquare', d: design(rect(40, 40)), status: 'notAccepted', failures: ['mass'] },
    { name: 'wideI', d: design(iSection(60, 90, 4, 3)), status: 'notAccepted', failures: ['mass', 'envelopeWidth'] },
    { name: 'tinyCircle', d: design(circle(5)), status: 'modelNotApplicable', failures: ['deflection', 'stress', 'applicability'] },
  ]
  for (const r of rows) {
    it(`${r.name} → ${r.status} ${JSON.stringify(r.failures)}`, () => {
      const { e } = run(r.d)
      expect(e.status).toBe(r.status)
      expect(e.accepted).toBe(r.status === 'accepted')
      if (r.status !== 'modelNotApplicable') expect(e.failures).toEqual(r.failures)
      else expect(e.failures).toContain('applicability')
    })
  }

  it('baseline numbers, negative deflection and stress margins and mass over budget', () => {
    const { a, e } = run(ch.initialDesign)
    relClose(a.tipDeflectionM, 11.794e-3)
    relClose(a.massKg, 1.2393)
    relClose(a.nominalMaxStressPa, 123.76e6)
    expect(e.failures).toEqual(['deflection', 'stress', 'mass', 'envelopeWidth'])
    expect(e.efficiency.deflectionMargin).toBeLessThan(0)
    expect(e.efficiency.stressMargin).toBeLessThan(0)
    expect(e.efficiency.massUsage).toBeGreaterThan(1)
  })

  it('reference has no warnings and is accepted', () => {
    const { a, e } = run(reference)
    expect(a.warnings).toEqual([])
    expect(e.status).toBe('accepted')
  })
})

describe('evaluate: constraint results (Req 11.1–11.7)', () => {
  it('returns 7 constraints in fixed order with SI values, limits, units, utilization', () => {
    const d = ch.initialDesign
    const { a, e } = run(d)
    expect(e.constraints.map((c) => c.id)).toEqual([...CONSTRAINT_ORDER])
    const k = ch.constraints
    const [defl, stress, mass, w, h, geom, app] = e.constraints
    expect([defl.value, defl.limit, defl.unit]).toEqual([a.tipDeflectionM, k.maxDeflectionM, 'm'])
    expect([stress.value, stress.limit, stress.unit]).toEqual([a.nominalMaxStressPa, k.maxStressPa, 'Pa'])
    expect([mass.value, mass.limit, mass.unit]).toEqual([a.massKg, k.maxMassKg, 'kg'])
    // The baseline I-section is turned 90°: its 84 mm height is the envelope width.
    expect([w.value, w.limit, w.unit]).toEqual([0.084, k.maxWidthM, 'm'])
    expect([h.value, h.limit, h.unit]).toEqual([0.0365, k.maxHeightM, 'm'])
    for (const c of [defl, stress, mass, w, h]) expect(c.utilization).toBe(c.value / c.limit)
    expect(geom).toMatchObject({ unit: 'bool', value: 1, limit: 1, passed: true, utilization: 1 })
    expect(app).toMatchObject({ unit: 'bool', value: 1, limit: 1, passed: true, utilization: 1 })
    for (const c of e.constraints) expect(c.label.length).toBeGreaterThan(0)
  })

  it('uses the oriented envelope (90° swaps width and height)', () => {
    const { e } = run(design(rect(15, 45), 90))
    expect(e.constraints[3].value).toBeCloseTo(0.045, 12)
    expect(e.constraints[4].value).toBeCloseTo(0.015, 12)
  })

  it('re-runs validateDesign for featureGeometry', () => {
    const a = analyze(reference, ch)
    const bad = { ...reference, lengthM: 0.7 } // locked field changed
    const e = evaluate(bad, a, ch)
    expect(e.constraints[5]).toMatchObject({ id: 'featureGeometry', passed: false, value: 0, utilization: 0 })
    expect(e.failures).toEqual(['featureGeometry'])
    expect(e.status).toBe('notAccepted')
  })

  it('inclusive boundary: value = limit passes, limit·(1+1e-6) fails (Req 11.3)', () => {
    const a = analyze(reference, ch)
    const atLimit = evaluate(reference, a, withLimits({ maxDeflectionM: a.tipDeflectionM }))
    expect(atLimit.constraints[0].passed).toBe(true)
    expect(atLimit.status).toBe('accepted')
    const over = evaluate(reference, a, withLimits({ maxDeflectionM: a.tipDeflectionM / (1 + 1e-6) }))
    expect(over.constraints[0].passed).toBe(false)
    expect(over.failures).toEqual(['deflection'])
  })

  it('non-finite values fail and all 7 results are still returned (Req 11.4, 12.10)', () => {
    const a = analyze(reference, ch)
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const broken: Analysis = { ...a, tipDeflectionM: bad, massKg: bad, nominalMaxStressPa: bad }
      const e = evaluate(reference, broken, ch)
      expect(e.constraints).toHaveLength(7)
      expect(e.failures).toEqual(['deflection', 'stress', 'mass'])
      expect(e.status).not.toBe('accepted')
      expect(e.accepted).toBe(false)
    }
    const nanLimit = evaluateConstraints(reference, a, withLimits({ maxMassKg: Number.NaN }))
    expect(nanLimit).toHaveLength(7)
    expect(nanLimit[2].passed).toBe(false)
  })
})

describe('evaluate: status and efficiency (Req 12.1–12.6)', () => {
  it('not applicable dominates even when every other constraint passes', () => {
    const a = analyze(reference, ch)
    const e = evaluate(reference, { ...a, applicable: false }, ch)
    expect(e.status).toBe('modelNotApplicable')
    expect(e.accepted).toBe(false)
    expect(e.failures).toEqual(['applicability'])
  })

  it('warnings do not change status', () => {
    const a = analyze(reference, ch)
    const warned: Analysis = {
      ...a,
      warnings: [{ code: 'DEPTH_SPAN', message: 'w', value: 1, threshold: 0.5 }],
    }
    expect(evaluate(reference, warned, ch).status).toBe('accepted')
  })

  it('efficiency is unclamped and uses the documented formulas', () => {
    for (const d of [ch.initialDesign, reference, design(rect(40, 40))]) {
      const { a, e } = run(d)
      const k = ch.constraints
      expect(e.efficiency).toEqual({
        massUsage: a.massKg / k.maxMassKg,
        deflectionMargin: 1 - a.tipDeflectionM / k.maxDeflectionM,
        stressMargin: 1 - a.nominalMaxStressPa / k.maxStressPa,
      })
    }
    expect(run(design(rect(40, 40))).e.efficiency.massUsage).toBeGreaterThan(1)
  })

  it('result is deep-frozen and inputs are not mutated', () => {
    const d = structuredClone(reference)
    const a = analyze(d, ch)
    const before = structuredClone(d)
    const e = evaluate(d, a, ch)
    expect(d).toEqual(before)
    expect(Object.isFrozen(e)).toBe(true)
    expect(Object.isFrozen(e.constraints)).toBe(true)
    expect(Object.isFrozen(e.constraints[0])).toBe(true)
    expect(Object.isFrozen(e.failures)).toBe(true)
    expect(Object.isFrozen(e.efficiency)).toBe(true)
    expect(Object.isFrozen(e.facts[0].basis)).toBe(true)
  })
})

describe('evaluate: single-result facts (Req 13.1, 13.2, 13.8)', () => {
  const designs = [ch.initialDesign, reference, design(iSection(60, 90, 4, 3)), design(circle(5))]

  it('includes exactly one idealized-model fact', () => {
    for (const d of designs) {
      const { e } = run(d)
      const model = e.facts.filter((f) => f.id === MODEL_LIMITS_FACT_ID)
      expect(model).toHaveLength(1)
      expect(model[0].text).toMatch(/idealized beam model/)
      expect(model[0].text).toMatch(/local buckling/)
      expect(e.facts.filter((f) => /idealized/i.test(f.text))).toHaveLength(1)
    }
  })

  it('every number in text comes from basis; basis values are finite and copied', () => {
    for (const d of designs) {
      const { e } = run(d)
      const copied = new Set(e.constraints.flatMap((c) => [c.value, c.limit, c.utilization]))
      for (const f of e.facts) {
        const basis = Object.values(f.basis)
        for (const v of basis) {
          expect(Number.isFinite(v)).toBe(true)
          expect(copied.has(v)).toBe(true)
        }
        const rendered = new Set(basis.map((v) => formatBasis(v, FACT_DIGITS)))
        for (const n of f.text.match(/-?\d+(?:\.\d+)?/g) ?? []) expect(rendered.has(n)).toBe(true)
        expect(f.text).not.toMatch(/\bbest\b|\balways\b|\bnever\b/i)
      }
    }
  })

  it('facts are deterministic', () => {
    expect(run(reference).e.facts).toEqual(run(reference).e.facts)
  })
})
