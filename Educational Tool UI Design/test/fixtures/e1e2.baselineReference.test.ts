import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../../src/challenge/content'
import { evaluate } from '../../src/evaluation/evaluate'
import { analyze } from '../../src/physics/analyze'
import { baseline, FIXTURE_REL_TOL, reference, type Fixture } from './designs'

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

describe('E1: baseline (solid circle D = 30 mm)', () => {
  it('is notAccepted, failing only deflection', () => {
    const { evaluation } = run(baseline)
    expect(evaluation.status).toBe('notAccepted')
    expect(evaluation.accepted).toBe(false)
    expect(evaluation.failures).toEqual(['deflection'])
  })

  it('has δ ≈ 7.87 mm, m ≈ 1.145 kg, σ ≈ 67.9 MPa', () => {
    const { analysis } = run(baseline)
    expectRel(analysis.tipDeflectionM, 7.87e-3)
    expectRel(analysis.massKg, 1.145)
    expectRel(analysis.nominalMaxStressPa, 67.9e6)
  })

  it('matches the fixture table', () => {
    expectTableValues(baseline)
  })

  it('has a negative deflection margin', () => {
    const { evaluation } = run(baseline)
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
