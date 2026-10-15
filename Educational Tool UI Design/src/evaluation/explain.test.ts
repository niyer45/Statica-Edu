import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../challenge/content'
import type { Challenge } from '../challenge/types'
import type { BeamDesign, Orientation, Section } from '../geometry/sections'
import { analyze } from '../physics/analyze'
import { evaluate } from './evaluate'
import {
  FACT_DIGITS,
  MODEL_LIMITS_FACT_ID,
  ORIENTATION_DIGITS,
  compareResults,
  explainChange,
  formatBasis,
} from './explain'
import type { ExplanationFact, TestResult } from './types'

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

let seq = 0
const result = (d: BeamDesign): TestResult => {
  const analysis = analyze(d, ch)
  const evaluation = evaluate(d, analysis, ch)
  const iteration = seq++
  return {
    id: `r${iteration}`,
    iteration,
    designSnapshot: d,
    analysis,
    evaluation,
    accepted: evaluation.accepted,
    failures: evaluation.failures,
    timestamp: '2024-01-01T00:00:00.000Z',
  }
}

const baseline = result(design({ kind: 'circle', diameterM: mm(30) }))
const reference = result(
  design({ kind: 'iSection', heightM: mm(60), widthM: mm(40), flangeThicknessM: mm(4), webThicknessM: mm(3) }),
)
const tubeSameMass = result(design({ kind: 'tube', outerDiameterM: mm(50), innerDiameterM: mm(40) }))
const rectTall = result(design({ kind: 'rectangle', widthM: mm(15), heightM: mm(45) }))
const rectFlat = result(design({ kind: 'rectangle', widthM: mm(15), heightM: mm(45) }, 90))

const ids = (fs: ExplanationFact[]) => fs.map((f) => f.id)
const byId = (fs: ExplanationFact[], id: string) => fs.find((f) => f.id === id)

/** Every number token in text equals formatBasis(v, d) for some basis v, d = shown decimals ∈ {0, FACT_DIGITS}. */
function expectGrounded(f: ExplanationFact) {
  for (const v of Object.values(f.basis)) expect(Number.isFinite(v)).toBe(true)
  for (const tok of f.text.match(/-?\d+(?:\.\d+)?/g) ?? []) {
    const d = tok.includes('.') ? tok.split('.')[1].length : 0
    expect([0, FACT_DIGITS]).toContain(d)
    expect(Object.values(f.basis).some((v) => formatBasis(v, d) === tok)).toBe(true)
  }
}

describe('compareResults', () => {
  it('copies metrics, computes delta and ratio, and is frozen', () => {
    const c = compareResults(baseline, reference)
    expect(c.prevId).toBe(baseline.id)
    expect(c.nextId).toBe(reference.id)
    const m = c.metrics.bendingInertiaM4
    expect(m.prev).toBe(baseline.analysis.bendingInertiaM4)
    expect(m.next).toBe(reference.analysis.bendingInertiaM4)
    expect(m.delta).toBe(m.next - m.prev)
    expect(m.ratio).toBe(m.next / m.prev)
    expect(c.constraintChanges).toEqual([
      { id: 'deflection', label: 'Tip deflection', prevPassed: false, nextPassed: true },
    ])
    expect(c.section.changed).toBe(true)
    expect(c.status).toEqual({ prev: 'notAccepted', next: 'accepted' })
    expect(Object.isFrozen(c)).toBe(true)
    expect(Object.isFrozen(c.metrics.massKg)).toBe(true)
  })

  it('reports no section change for an identical section and orientation', () => {
    const c = compareResults(baseline, baseline)
    expect(c.section.changed).toBe(false)
    expect(c.constraintChanges).toEqual([])
  })
})

describe('explainChange (Req 13.1–13.7, 13.9)', () => {
  it('baseline → reference: stiffness fact, no same-mass fact, section and deflection facts', () => {
    const fs = explainChange(baseline, reference)
    expect(ids(fs)).toEqual(['change.stiffness', 'change.section', 'change.constraint.deflection', MODEL_LIMITS_FACT_ID])
    const s = byId(fs, 'change.stiffness')!
    expect(s.basis.rI).toBeCloseTo(7.205, 2)
    expect(s.basis.rDelta).toBeCloseTo(0.1388, 3)
    expect(s.text).toContain(`×${formatBasis(s.basis.rI)}`)
    expect(s.text).toContain('×0.14')
    expect(s.text).toContain('in this model')
    expect(reference.analysis.massKg / baseline.analysis.massKg).toBeCloseTo(0.673, 2)
    expect(byId(fs, 'change.section')!.text).toBe('Section changed from Solid circle at 0° to I-section at 0°.')
    expect(byId(fs, 'change.constraint.deflection')!.text).toBe('Tip deflection: fail → pass.')
  })

  it('baseline → tubeSameMass: same-mass fact present (Req 13.4)', () => {
    const fs = explainChange(baseline, tubeSameMass)
    expect(ids(fs)).toEqual([
      'change.stiffness',
      'change.sameMass',
      'change.section',
      'change.constraint.deflection',
      MODEL_LIMITS_FACT_ID,
    ])
    const f = byId(fs, 'change.sameMass')!
    expect(f.basis.rMass).toBeCloseTo(1, 10)
    expect(f.basis.rDelta).toBeCloseTo(0.2195, 3)
    expect(f.text).toContain('farther from the bending axis')
  })

  it('rectTall 0° → 90°: orientation fact, deflection pass → fail, no same-mass fact (rδ ≥ 0.98)', () => {
    const fs = explainChange(rectTall, rectFlat)
    expect(byId(fs, 'change.sameMass')).toBeUndefined()
    expect(byId(fs, 'change.section')!.text).toBe('Section changed from Rectangle at 0° to Rectangle at 90°.')
    expect(byId(fs, 'change.section')!.basis).toEqual({ prevOrientationDeg: 0, nextOrientationDeg: 90 })
    expect(byId(fs, 'change.constraint.deflection')!.text).toBe('Tip deflection: pass → fail.')
  })

  it('identical pair: only stiffness (×1.00) and model facts', () => {
    const fs = explainChange(baseline, baseline)
    expect(ids(fs)).toEqual(['change.stiffness', MODEL_LIMITS_FACT_ID])
    expect(fs[0].text).toContain('×1.00')
  })

  it('reverse of same-mass change gets no same-mass fact (Req 13.5)', () => {
    expect(byId(explainChange(tubeSameMass, baseline), 'change.sameMass')).toBeUndefined()
  })

  it('is deterministic for the same pair (Req 13.9)', () => {
    expect(explainChange(baseline, tubeSameMass)).toEqual(explainChange(baseline, tubeSameMass))
  })

  it('every number in every fact text is formatBasis of a basis value; exactly one model fact', () => {
    const pairs: [TestResult, TestResult][] = [
      [baseline, reference],
      [baseline, tubeSameMass],
      [rectTall, rectFlat],
      [rectFlat, rectTall],
      [reference, baseline],
    ]
    for (const [p, n] of pairs) {
      const fs = explainChange(p, n)
      fs.forEach(expectGrounded)
      expect(fs.filter((f) => f.id === MODEL_LIMITS_FACT_ID)).toHaveLength(1)
      expect(fs[fs.length - 1].id).toBe(MODEL_LIMITS_FACT_ID)
    }
    expect(ORIENTATION_DIGITS).toBe(0)
  })
})
