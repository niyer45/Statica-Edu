import { describe, expect, it } from 'vitest'
import json from '../../src/challenge/challenges/cantilever-beam-2.json'
import originalJson from '../../src/challenge/challenges/cantilever-beam-1.json'
import { catalog } from '../../src/challenge/catalog'
import { toStudentChallenge } from '../../src/challenge/content'
import { loadChallenge } from '../../src/challenge/loader'
import { validateDesign } from '../../src/geometry/validate'
import { analyze } from '../../src/physics/analyze'
import { evaluate } from '../../src/evaluation/evaluate'
import { exportDesign, importDesign } from '../../src/state/importExport'
import type { BeamDesign } from '../../src/geometry/sections'

// CB2-01–CB2-08: hand-derived SI fixtures in .kiro/specs/cantilever-beam-2/design.md.
// Expected values are constants, not calculations through the implementation under test.
const loaded = loadChallenge(json)
if (!loaded.ok) throw new Error(JSON.stringify(loaded.error))
const challenge = loaded.value
const fixtures = [
  { name: 'flat Baseline', design: challenge.initialDesign, area: 0.0008, inertia: 2.666666666666667e-8, mass: 1.296, deflection: 0.01173913043478261, stress: 67.5e6, failures: ['deflection'] },
  { name: 'rotated reference', design: challenge.referenceDesign!, area: 0.0008, inertia: 1.066666666666667e-7, mass: 1.296, deflection: 0.002934782608695652, stress: 33.75e6, failures: [] },
  { name: 'heavy square', design: { ...challenge.initialDesign, section: { kind: 'rectangle', widthM: 0.04, heightM: 0.04 } } as BeamDesign, area: 0.0016, inertia: 2.133333333333334e-7, mass: 2.592, deflection: 0.001467391304347826, stress: 16.875e6, failures: ['mass'] },
]
const close = (actual: number, expected: number) => expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-9)

describe('Cantilever Beam II configuration', () => {
  it('loads a distinct versioned, frozen configuration without activating an unreviewed challenge', () => {
    expect(challenge.id).toBe('cantilever-beam-2')
    expect(challenge.id).not.toBe(originalJson.id)
    expect(challenge.version).toBe(1)
    expect(challenge.allowedModes).toEqual(['guided', 'parametric'])
    expect(challenge.allowedSections).toEqual(['rectangle'])
    expect(Object.isFrozen(challenge.constraints)).toBe(true)
    expect(catalog.some((entry) => entry.available && entry.challengeId === challenge.id)).toBe(false)
  })

  it('defines the fixed challenge values, feature defaults and learning prompts', () => {
    expect(challenge.lockedFields).toEqual(['lengthM', 'materialId', 'forceN', 'support'])
    expect(challenge.initialDesign.lengthM).toBe(0.6)
    expect(challenge.load).toEqual({ forceN: 300, location: 'freeEnd', direction: 'down' })
    expect(challenge.support).toBe('fixedRoot')
    expect(challenge.sectionDefaults).toEqual(originalJson.sectionDefaults)
    expect(challenge.constraints).toEqual({ maxMassKg: 1.4, maxDeflectionM: 0.003, maxStressPa: 120e6, maxWidthM: 0.06, maxHeightM: 0.06 })
    expect(challenge.predictionPolicy.requiredOnIterations).toEqual([1, 3])
    expect(challenge.reflectionPrompt.text).toContain('mass stay the same')
    expect('referenceDesign' in toStudentChallenge(challenge)).toBe(false)
  })

  it.each(fixtures)('matches hand-derived properties and acceptance for $name', (fixture) => {
    expect(validateDesign(fixture.design, challenge)).toEqual([])
    const result = analyze(fixture.design, challenge)
    close(result.areaM2, fixture.area)
    close(result.bendingInertiaM4, fixture.inertia)
    close(result.massKg, fixture.mass)
    close(result.tipDeflectionM, fixture.deflection)
    close(result.nominalMaxStressPa, fixture.stress)
    expect(result.applicable).toBe(true)
    expect(result.warnings).toEqual([])
    const evaluation = evaluate(fixture.design, result, challenge)
    expect(evaluation.failures).toEqual(fixture.failures)
    expect(evaluation.status).toBe(fixture.failures.length ? 'notAccepted' : 'accepted')
    expect(evaluation.facts.every((fact) => Object.values(fact.basis).every(Number.isFinite))).toBe(true)
  })

  it('changes stiffness, deflection and stress while preserving mass under rotation', () => {
    const flat = analyze(challenge.initialDesign, challenge)
    const rotated = analyze(challenge.referenceDesign!, challenge)
    expect(rotated.areaM2).toBe(flat.areaM2)
    expect(rotated.massKg).toBe(flat.massKg)
    close(rotated.bendingInertiaM4 / flat.bendingInertiaM4, 4)
    close(rotated.tipDeflectionM / flat.tipDeflectionM, 0.25)
    close(rotated.nominalMaxStressPa / flat.nominalMaxStressPa, 0.5)
  })

  it.each(['maxMassKg', 'maxDeflectionM', 'maxStressPa', 'maxWidthM', 'maxHeightM'] as const)(
    'accepts equality and rejects an exceeded %s boundary', (key) => {
      const design = challenge.referenceDesign!
      const analysis = analyze(design, challenge)
      const values = { maxMassKg: 1.296, maxDeflectionM: 0.002934782608695652, maxStressPa: 33.75e6, maxWidthM: 0.02, maxHeightM: 0.04 }
      const equal = { ...challenge, constraints: { ...challenge.constraints, [key]: values[key] } }
      expect(evaluate(design, analysis, equal).accepted).toBe(true)
      const exceeded = { ...equal, constraints: { ...equal.constraints, [key]: values[key] * 0.9999 } }
      expect(evaluate(design, analysis, exceeded).accepted).toBe(false)
    },
  )

  it('rejects invalid dimensions and unsupported sections before analysis', () => {
    const invalid: BeamDesign = { ...challenge.initialDesign, section: { kind: 'rectangle', widthM: 0.002, heightM: 0.02 } }
    expect(validateDesign(invalid, challenge).some((error) => error.code === 'BELOW_MIN')).toBe(true)
    const unsupported: BeamDesign = { ...challenge.initialDesign, section: { kind: 'circle', diameterM: 0.04 } }
    expect(validateDesign(unsupported, challenge).some((error) => error.code === 'SECTION_NOT_ALLOWED')).toBe(true)
  })

  it('rejects model applicability for a very flexible valid rectangle', () => {
    const design: BeamDesign = { ...challenge.initialDesign, section: { kind: 'rectangle', widthM: 0.003, heightM: 0.003 } }
    expect(validateDesign(design, challenge)).toEqual([])
    const analysis = analyze(design, challenge)
    expect(analysis.notApplicableReasons.map((reason) => reason.code)).toContain('LARGE_DEFLECTION')
    expect(evaluate(design, analysis, challenge).status).toBe('modelNotApplicable')
  })

  it('round-trips its design and rejects a matching geometry from a different challenge', () => {
    const exported = exportDesign(challenge.referenceDesign!, challenge)
    expect(importDesign(exported, challenge)).toEqual({ ok: true, value: challenge.referenceDesign })
    const wrongId = JSON.stringify({ ...JSON.parse(exported), challengeId: originalJson.id })
    expect(importDesign(wrongId, challenge).ok).toBe(false)
    const original = loadChallenge(originalJson)
    if (!original.ok) throw new Error('original configuration invalid')
    expect(importDesign(exported, original.value).ok).toBe(false)
  })
})
