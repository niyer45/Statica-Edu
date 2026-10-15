import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../../src/challenge/content'
import { evaluate } from '../../src/evaluation/evaluate'
import { analyze } from '../../src/physics/analyze'
import {
  FIXTURE_REL_TOL,
  heavySquare,
  rectFlat,
  rectTall,
  tinyCircle,
  tubeSameMass,
  wideI,
  type Fixture,
} from './designs'

// E3: remaining verified fixtures (Req 8.10, 12.9). Each fixture's status, failures in fixed
// constraint order, warning and not-applicable codes, and A, m, I_bend, δ, σ within tolerance.

if (!bundledChallengeResult.ok) {
  throw new Error(`Bundled challenge failed to load: ${JSON.stringify(bundledChallengeResult.error)}`)
}
const challenge = bundledChallengeResult.value

function expectRelClose(actual: number, expected: number, label: string): void {
  const rel = Math.abs(actual - expected) / Math.abs(expected)
  expect(rel, `${label}: actual ${actual}, expected ${expected}`).toBeLessThanOrEqual(FIXTURE_REL_TOL)
}

const REMAINING: readonly Fixture[] = [tubeSameMass, rectTall, rectFlat, heavySquare, wideI, tinyCircle]

describe('E3: remaining fixtures', () => {
  it.each(REMAINING.map((f) => [f.name, f] as const))('%s matches the design table', (_name, f) => {
    const a = analyze(f.design, challenge)
    const e = evaluate(f.design, a, challenge)
    const x = f.expected

    expect(e.status).toBe(x.status)
    expect(e.accepted).toBe(x.status === 'accepted')
    expect([...e.failures]).toEqual([...x.failures])
    expect(a.warnings.map((w) => w.code)).toEqual([...x.warningCodes])
    expect(a.notApplicableReasons.map((r) => r.code)).toEqual([...x.notApplicableCodes])
    expect(a.applicable).toBe(x.notApplicableCodes.length === 0)

    expectRelClose(a.areaM2, x.areaM2, 'areaM2')
    expectRelClose(a.massKg, x.massKg, 'massKg')
    expectRelClose(a.bendingInertiaM4, x.bendingInertiaM4, 'bendingInertiaM4')
    expectRelClose(a.tipDeflectionM, x.tipDeflectionM, 'tipDeflectionM')
    expectRelClose(a.nominalMaxStressPa, x.nominalMaxStressPa, 'nominalMaxStressPa')
  })

  it('rectFlat warns LARGE_DEFLECTION and wideI warns FLANGE_OUTSTAND', () => {
    expect(analyze(rectFlat.design, challenge).warnings.map((w) => w.code)).toContain('LARGE_DEFLECTION')
    expect(analyze(wideI.design, challenge).warnings.map((w) => w.code)).toContain('FLANGE_OUTSTAND')
  })
})
