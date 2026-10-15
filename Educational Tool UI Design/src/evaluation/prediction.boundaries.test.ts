import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../challenge/content'
import type { Challenge } from '../challenge/types'
import type { BeamDesign, Orientation, Section } from '../geometry/sections'
import { analyze } from '../physics/analyze'
import type { Analysis } from '../physics/types'
import { CONSTRAINT_ORDER } from './constraints'
import { evaluate } from './evaluate'
import { DEFLECTION_DROP_RATIO, SAME_MASS_TOL, compareResults, explainChange } from './explain'
import { SAME_BAND_HIGH, SAME_BAND_LOW, classifyRatio, scorePrediction } from './prediction'
import type { ConstraintId, ExplanationFact, Prediction, PredictionDirection, TestResult } from './types'

// Boundary unit tests for prediction scoring (Req 14.7, 14.8) and comparison-fact
// conditions (Req 13.4–13.7, 13.9).
//
// Floating-point note: the decimal literals 0.98 and 1.02 are not exactly representable.
// The double 1.02 is 1.0200000000000000177… and the double 0.98 is 0.9799999999999999822…,
// so |1.02 − 1| and |0.98 − 1| both evaluate to 0.020000000000000018 > SAME_MASS_TOL.
// In exact arithmetic on those stored values that is also > 0.02, so the same-mass fact is
// (correctly) absent for them. No double r near 1 gives |r − 1| === 0.02; the closest
// in-band values are the neighbours 1.0199999999999998 and 0.9800000000000001, which are
// within tolerance and get the fact. Ratios below are built with prev = 1 so next / prev
// equals next exactly; each test asserts the computed ratio before checking behaviour.

if (!bundledChallengeResult.ok) throw new Error('bundled challenge failed to load')
const ch: Challenge = bundledChallengeResult.value

const design = (section: Section, orientationDeg: Orientation = 0): BeamDesign => ({
  id: 'd',
  section,
  orientationDeg,
  lengthM: ch.initialDesign.lengthM,
  materialId: ch.material.id,
})

const real = (d: BeamDesign, id: string): TestResult => {
  const analysis = analyze(d, ch)
  const evaluation = evaluate(d, analysis, ch)
  return {
    id,
    iteration: 0,
    designSnapshot: d,
    analysis,
    evaluation,
    accepted: evaluation.accepted,
    failures: evaluation.failures,
    timestamp: '2024-01-01T00:00:00.000Z',
  }
}

const circle = design({ kind: 'circle', diameterM: 0.03 })
const base = real(circle, 'base')

/** Synthetic result: real baseline with overridden analysis fields / design / pass flags. */
const synth = (
  id: string,
  over: Partial<Pick<Analysis, 'massKg' | 'tipDeflectionM' | 'bendingInertiaM4'>>,
  opts: { design?: BeamDesign; flip?: ConstraintId[] } = {},
): TestResult => {
  const flip = opts.flip ?? []
  return {
    ...base,
    id,
    designSnapshot: opts.design ?? base.designSnapshot,
    analysis: { ...base.analysis, massKg: 1, tipDeflectionM: 1, bendingInertiaM4: 1, ...over },
    evaluation: {
      ...base.evaluation,
      constraints: base.evaluation.constraints.map((c) => (flip.includes(c.id) ? { ...c, passed: !c.passed } : c)),
    },
  }
}

const unit = synth('unit', {})
const predict = (direction: PredictionDirection): Prediction => ({
  iteration: 1,
  direction,
  createdAt: '2024-01-01T00:00:00.000Z',
})

/** Adjacent double toward +∞ (dir = 1) or −∞ (dir = −1); x must be finite and > 0. */
function nextAfter(x: number, dir: 1 | -1): number {
  const f = new Float64Array([x])
  const b = new BigInt64Array(f.buffer)
  b[0] += BigInt(dir)
  return f[0]
}

const ids = (fs: ExplanationFact[]) => fs.map((f) => f.id)
const has = (fs: ExplanationFact[], id: string) => fs.some((f) => f.id === id)

describe('classifyRatio / scorePrediction boundaries (Req 14.7)', () => {
  const cases: [string, number, PredictionDirection][] = [
    ['exactly 0.98', 0.98, 'same'],
    ['exactly 1.02', 1.02, 'same'],
    ['0.98 − 1e-12', 0.98 - 1e-12, 'decrease'],
    ['1.02 + 1e-12', 1.02 + 1e-12, 'increase'],
    ['nextDown(0.98)', nextAfter(0.98, -1), 'decrease'],
    ['nextUp(1.02)', nextAfter(1.02, 1), 'increase'],
    ['nextUp(0.98)', nextAfter(0.98, 1), 'same'],
    ['nextDown(1.02)', nextAfter(1.02, -1), 'same'],
    ['exactly 1', 1, 'same'],
  ]

  it('thresholds are the documented constants', () => {
    expect(SAME_BAND_LOW).toBe(0.98)
    expect(SAME_BAND_HIGH).toBe(1.02)
    expect(nextAfter(0.98, -1)).toBeLessThan(0.98)
    expect(nextAfter(1.02, 1)).toBeGreaterThan(1.02)
  })

  for (const [name, r, expected] of cases) {
    it(`r = ${name} → ${expected}`, () => {
      const out = scorePrediction(predict(expected), unit, { tipDeflectionM: r })
      expect(out.ratio).toBe(r) // prev δ = 1, so the computed ratio is exact
      expect(classifyRatio(r)).toBe(expected)
      expect(out.actual).toBe(expected)
      expect(out.matched).toBe(true)
    })
  }

  it('ratio is computed as next / prev for non-unit prev', () => {
    const prev = synth('p', { tipDeflectionM: 2 })
    const out = scorePrediction(predict('same'), prev, { tipDeflectionM: 1.96 })
    expect(out.ratio).toBe(1.96 / 2)
    expect(out.ratio).toBe(0.98)
    expect(out.actual).toBe('same')
  })
})

describe('scorePrediction match flag: every predicted × actual combination (Req 14.8)', () => {
  const dirs: PredictionDirection[] = ['increase', 'decrease', 'same']
  const ratioFor: Record<PredictionDirection, number> = { increase: 1.5, decrease: 0.5, same: 1 }
  for (const predicted of dirs) {
    for (const actual of dirs) {
      it(`predicted ${predicted}, actual ${actual} → matched ${predicted === actual}`, () => {
        const out = scorePrediction(predict(predicted), unit, { tipDeflectionM: ratioFor[actual] })
        expect(out).toEqual({ predicted, actual, ratio: ratioFor[actual], matched: predicted === actual })
        expect(Object.isFrozen(out)).toBe(true)
      })
    }
  }
})

describe('same-mass fact boundaries (Req 13.4, 13.5)', () => {
  const sameMass = (rMass: number, rDelta: number) =>
    has(explainChange(unit, synth('n', { massKg: rMass, tipDeflectionM: rDelta })), 'change.sameMass')

  it('constants', () => {
    expect(SAME_MASS_TOL).toBe(0.02)
    expect(DEFLECTION_DROP_RATIO).toBe(0.98)
  })

  it('rMass at the closest in-band doubles to 1 ± 0.02 → present', () => {
    for (const rMass of [nextAfter(1.02, -1), nextAfter(0.98, 1)]) {
      expect(Math.abs(rMass - 1)).toBeLessThanOrEqual(SAME_MASS_TOL)
      expect(sameMass(rMass, 0.5)).toBe(true)
    }
  })

  it('rMass = 1.02 and 0.98 literals: |r − 1| = 0.020000000000000018 > 0.02 → absent', () => {
    for (const rMass of [1.02, 0.98]) {
      expect(Math.abs(rMass - 1)).toBe(0.020000000000000018)
      expect(sameMass(rMass, 0.5)).toBe(false)
    }
  })

  it('|rMass − 1| = 0.02 + 1e-9 → absent', () => {
    for (const rMass of [1 + 0.02 + 1e-9, 1 - 0.02 - 1e-9]) {
      expect(Math.abs(rMass - 1)).toBeGreaterThan(SAME_MASS_TOL)
      expect(sameMass(rMass, 0.5)).toBe(false)
    }
  })

  it('rDelta exactly 0.98 → absent; 0.98 − 1e-9 and nextDown(0.98) → present', () => {
    const c = compareResults(unit, synth('n', { massKg: 1, tipDeflectionM: 0.98 }))
    expect(c.metrics.tipDeflectionM.ratio).toBe(0.98)
    expect(c.metrics.massKg.ratio).toBe(1)
    expect(sameMass(1, 0.98)).toBe(false)
    expect(sameMass(1, 0.98 - 1e-9)).toBe(true)
    expect(sameMass(1, nextAfter(0.98, -1))).toBe(true)
  })

  it('basis holds rMass and rDelta exactly', () => {
    const fs = explainChange(unit, synth('n', { massKg: 1.01, tipDeflectionM: 0.5 }))
    expect(fs.find((f) => f.id === 'change.sameMass')!.basis).toEqual({ rMass: 1.01, rDelta: 0.5 })
  })
})

describe('section-change fact (Req 13.6)', () => {
  const rect = (o: Orientation) => design({ kind: 'rectangle', widthM: 0.015, heightM: 0.045 }, o)
  const tube = design({ kind: 'tube', outerDiameterM: 0.05, innerDiameterM: 0.04 })

  it('absent when kind and orientation are the same (even if dimensions differ)', () => {
    const other = design({ kind: 'circle', diameterM: 0.04 })
    expect(has(explainChange(unit, synth('n', {}, { design: other })), 'change.section')).toBe(false)
    const a = synth('a', {}, { design: rect(90) })
    const b = synth('b', {}, { design: rect(90) })
    expect(has(explainChange(a, b), 'change.section')).toBe(false)
  })

  it('present when only kind differs', () => {
    expect(has(explainChange(unit, synth('n', {}, { design: tube })), 'change.section')).toBe(true)
  })

  it('present when only orientation differs', () => {
    const fs = explainChange(synth('a', {}, { design: rect(0) }), synth('b', {}, { design: rect(90) }))
    expect(fs.filter((f) => f.id === 'change.section')).toHaveLength(1)
  })

  it('present when both differ', () => {
    expect(has(explainChange(unit, synth('n', {}, { design: rect(90) })), 'change.section')).toBe(true)
  })
})

describe('constraint-change facts (Req 13.7)', () => {
  it('no constraint facts when no pass state changes', () => {
    expect(ids(explainChange(unit, synth('n', {}))).some((id) => id.startsWith('change.constraint.'))).toBe(false)
  })

  it('exactly one fact per changed constraint, in CONSTRAINT_ORDER', () => {
    const flip: ConstraintId[] = ['applicability', 'stress', 'deflection', 'envelopeHeight']
    const fs = explainChange(unit, synth('n', {}, { flip }))
    const got = ids(fs).filter((id) => id.startsWith('change.constraint.'))
    expect(got).toEqual(CONSTRAINT_ORDER.filter((id) => flip.includes(id)).map((id) => `change.constraint.${id}`))
  })

  it('every single constraint flip produces exactly its own fact with prev → next state', () => {
    for (const id of CONSTRAINT_ORDER) {
      const next = synth('n', {}, { flip: [id] })
      const fs = explainChange(unit, next)
      const cs = fs.filter((f) => f.id.startsWith('change.constraint.'))
      expect(cs).toHaveLength(1)
      expect(cs[0].id).toBe(`change.constraint.${id}`)
      const prevPassed = unit.evaluation.constraints.find((c) => c.id === id)!.passed
      const word = (p: boolean) => (p ? 'pass' : 'fail')
      expect(cs[0].text).toContain(`${word(prevPassed)} → ${word(!prevPassed)}`)
    }
  })
})

describe('repeated comparisons are identical (Req 13.9)', () => {
  it('same pair compared three times yields equal facts and comparison', () => {
    const prev = unit
    const next = synth('n', { massKg: 1.01, tipDeflectionM: 0.5, bendingInertiaM4: 2 }, {
      design: design({ kind: 'tube', outerDiameterM: 0.05, innerDiameterM: 0.04 }),
      flip: ['deflection', 'mass'],
    })
    const runs = [explainChange(prev, next), explainChange(prev, next), explainChange(prev, next)]
    expect(runs[1]).toEqual(runs[0])
    expect(runs[2]).toEqual(runs[0])
    expect(ids(runs[0])).toEqual([
      'change.stiffness',
      'change.sameMass',
      'change.section',
      'change.constraint.deflection',
      'change.constraint.mass',
      'model.idealizedBeam',
    ])
    expect(compareResults(prev, next)).toEqual(compareResults(prev, next))
    expect(real(circle, 'x').analysis).toEqual(base.analysis)
  })
})
