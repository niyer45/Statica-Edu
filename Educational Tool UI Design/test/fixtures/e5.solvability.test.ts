import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../../src/challenge/content'
import { evaluate } from '../../src/evaluation/evaluate'
import type { BeamDesign } from '../../src/geometry/sections'
import { analyze } from '../../src/physics/analyze'
import { FIXTURE_REL_TOL, reference, solid30, tubeSameMass, type Fixture } from './designs'

// Example test E5 (solvability; Req 12.8, 12.9): the challenge is solvable by the reference
// I-section and by a same-mass tube, while no solid circle in the allowed range passes.

if (!bundledChallengeResult.ok) {
  throw new Error(
    `Bundled challenge failed to load: ${JSON.stringify(bundledChallengeResult.error)}`,
  )
}
const challenge = bundledChallengeResult.value

function expectRel(actual: number, expected: number, tol: number = FIXTURE_REL_TOL): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol * Math.abs(expected))
}

function runDesign(d: BeamDesign) {
  const analysis = analyze(d, challenge)
  const evaluation = evaluate(d, analysis, challenge)
  return { analysis, evaluation }
}

const run = (f: Fixture) => runDesign(f.design)

// Derived targets from the bundled challenge values.
const F = challenge.load.forceN
const L = challenge.initialDesign.lengthM
const E = challenge.material.elasticModulusPa
const rho = challenge.material.densityKgM3
const deltaAllow = challenge.constraints.maxDeflectionM
const massAllow = challenge.constraints.maxMassKg
const requiredInertiaM4 = (F * L ** 3) / (3 * E * deltaAllow)
const maxAreaM2 = massAllow / (rho * L)

describe('E5: solvability', () => {
  it('derives I_bend ≥ F·L³/(3·E·δ_allow) ≈ 7.826e-8 m⁴ and A ≤ m_allow/(ρ·L) ≈ 7.407e-4 m²', () => {
    expectRel(requiredInertiaM4, 7.826e-8)
    expectRel(maxAreaM2, 7.407e-4)
  })

  it('reference I-section is accepted and meets both derived targets', () => {
    const { analysis, evaluation } = run(reference)
    expect(evaluation.status).toBe('accepted')
    expect(evaluation.failures).toEqual([])
    expect(analysis.bendingInertiaM4).toBeGreaterThanOrEqual(requiredInertiaM4)
    expect(analysis.areaM2).toBeLessThanOrEqual(maxAreaM2)
  })

  it('tubeSameMass is within 2% of the Ø30 solid (v1 baseline) mass and is accepted', () => {
    const base = run(solid30)
    const { analysis, evaluation } = run(tubeSameMass)
    expectRel(analysis.massKg, base.analysis.massKg, 0.02)
    expect(evaluation.status).toBe('accepted')
    expect(evaluation.failures).toEqual([])
    expect(analysis.bendingInertiaM4).toBeGreaterThanOrEqual(requiredInertiaM4)
    expect(analysis.areaM2).toBeLessThanOrEqual(maxAreaM2)
  })

  it('no solid circle in the allowed diameter range passes (each fails deflection or mass)', () => {
    const { minM, maxM, stepM } = challenge.sectionLimits.circle.diameterM
    let count = 0
    for (let i = 0; minM + i * stepM <= maxM + 1e-12; i++) {
      // Round to whole micrometres to avoid float drift such as 0.0300000004.
      const diameterM = Math.round((minM + i * stepM) * 1e6) / 1e6
      const d: BeamDesign = {
        id: `circle-${diameterM}`,
        section: { kind: 'circle', diameterM },
        orientationDeg: 0,
        lengthM: challenge.initialDesign.lengthM,
        materialId: challenge.initialDesign.materialId,
      }
      const { evaluation } = runDesign(d)
      expect(evaluation.accepted, `D = ${diameterM} m`).toBe(false)
      const failsDeflectionOrMass =
        evaluation.failures.includes('deflection') || evaluation.failures.includes('mass')
      expect(failsDeflectionOrMass, `D = ${diameterM} m failures ${evaluation.failures.join(',')}`).toBe(
        true,
      )
      count++
    }
    // 5 mm to 100 mm at 0.5 mm steps.
    expect(count).toBe(Math.round((maxM - minM) / stepM) + 1)
  })
})
