import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../../src/challenge/content'
import { evaluate } from '../../src/evaluation/evaluate'
import { analyze } from '../../src/physics/analyze'
import { baseline, FIXTURE_REL_TOL, reference, sidewaysI, solid30, type Fixture } from './designs'

// Example tests E1 (baseline) and E2 (reference) against the verified fixtures table
// (Req 8.10, 12.7, 12.8).

if (!bundledChallengeResult.ok) {
  throw new Error(
    `Bundled challenge failed to load: ${JSON.stringify(bundledChallengeResult.error)}`,
  )
}
const challenge = bundledChallengeResult.value

function expectRel(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(FIXTURE_REL_TOL * Math.abs(expected))
}

function run(f: Fixture) {
  const analysis = analyze(f.design, challenge)
  const evaluation = evaluate(f.design, analysis, challenge)
  return { analysis, evaluation }
}

function expectTableValues(f: Fixture): void {
  const { analysis } = run(f)
  expectRel(analysis.areaM2, f.expected.areaM2)
  expectRel(analysis.massKg, f.expected.massKg)
  expectRel(analysis.bendingInertiaM4, f.expected.bendingInertiaM4)
  expectRel(analysis.tipDeflectionM, f.expected.tipDeflectionM)
  expectRel(analysis.nominalMaxStressPa, f.expected.nominalMaxStressPa)
}

describe('E1: baseline (solid circle D = 31 mm)', () => {
  it('is the bundled challenge baseline', () => {
    expect(challenge.initialDesign.section).toEqual(baseline.design.section)
    expect(challenge.initialDesign.orientationDeg).toBe(baseline.design.orientationDeg)
  })

  it('is notAccepted, failing deflection and mass, with no warnings', () => {
    const { analysis, evaluation } = run(baseline)
    expect(evaluation.status).toBe('notAccepted')
    expect(evaluation.accepted).toBe(false)
    expect(evaluation.failures).toEqual(['deflection', 'mass'])
    expect(analysis.applicable).toBe(true)
    expect(analysis.warnings).toEqual([])
  })

  it('has δ ≈ 6.91 mm, m ≈ 1.223 kg, σ ≈ 61.5 MPa', () => {
    const { analysis } = run(baseline)
    expectRel(analysis.tipDeflectionM, 6.9054e-3)
    expectRel(analysis.massKg, 1.2227)
    expectRel(analysis.nominalMaxStressPa, 61.544e6)
  })

  it('matches the fixture table', () => {
    expectTableValues(baseline)
  })

  it('has a negative deflection margin and uses more than the mass budget', () => {
    const { evaluation } = run(baseline)
    expect(evaluation.efficiency.deflectionMargin).toBeLessThan(0)
    expect(evaluation.efficiency.massUsage).toBeGreaterThan(1)
  })
})

describe('E1 (v2): I-section 36.5 × 84, tf = 3, tw = 7 mm, turned 90° (the challenge v2 baseline)', () => {
  it('is notAccepted, failing deflection, stress, mass and envelope width, with no warnings', () => {
    const { analysis, evaluation } = run(sidewaysI)
    expect(evaluation.failures).toEqual(['deflection', 'stress', 'mass', 'envelopeWidth'])
    expect(analysis.applicable).toBe(true)
    expect(analysis.warnings).toEqual([])
    expectRel(evaluation.constraints.find((c) => c.id === 'envelopeWidth')!.value, 0.084)
  })

  it('matches the fixture table', () => {
    expectTableValues(sidewaysI)
  })
})

describe('E1 (v1): solid circle D = 30 mm, the challenge v1 baseline', () => {
  it('is notAccepted, failing only deflection', () => {
    const { evaluation } = run(solid30)
    expect(evaluation.status).toBe('notAccepted')
    expect(evaluation.accepted).toBe(false)
    expect(evaluation.failures).toEqual(['deflection'])
  })

  it('has δ ≈ 7.87 mm, m ≈ 1.145 kg, σ ≈ 67.9 MPa', () => {
    const { analysis } = run(solid30)
    expectRel(analysis.tipDeflectionM, 7.87e-3)
    expectRel(analysis.massKg, 1.145)
    expectRel(analysis.nominalMaxStressPa, 67.9e6)
  })

  it('matches the fixture table', () => {
    expectTableValues(solid30)
  })

  it('has a negative deflection margin', () => {
    const { evaluation } = run(solid30)
    expect(evaluation.efficiency.deflectionMargin).toBeLessThan(0)
  })
})

describe('E2: reference (I-section 40×60, tf = 4, tw = 3 mm)', () => {
  it('is accepted with no failures and no warnings', () => {
    const { analysis, evaluation } = run(reference)
    expect(evaluation.status).toBe('accepted')
    expect(evaluation.accepted).toBe(true)
    expect(evaluation.failures).toEqual([])
    expect(analysis.applicable).toBe(true)
    expect(analysis.warnings).toEqual([])
    expect(analysis.notApplicableReasons).toEqual([])
  })

  it('matches the fixture table within FIXTURE_REL_TOL', () => {
    expectTableValues(reference)
  })
})
