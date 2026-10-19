import { describe, expect, it } from 'vitest'
import { catalog } from '../challenge/catalog'
import { baseInput, cantileverResponse, deflectedShape, DEMO_DEFAULTS, DEMO_MATERIALS, DEMO_SECTIONS, demoMaterial, demoMaxDeflectionM, demoSection, momentAt, stressAt } from './beamDemo'
import { LEARN_MODULES, LEARN_SUBJECTS, learnModule } from './catalog'
import { beamBending } from './modules/beamBending'
import type { LearnStep } from './types'

// Task 67 (LRN-02, LRN-04): the Beam bending answers agree with the physics the demos use, so the
// content cannot drift from the model.

const step = (id: string): LearnStep => beamBending.steps.find((s) => s.id === id)!
const tip = (overrides: Parameters<typeof baseInput>[0]) => cantileverResponse(baseInput(overrides)).tipDeflectionM

/** The option whose stated factor is closest to the model's ratio. */
function closest(factors: Record<string, number>, ratio: number): string {
  return Object.entries(factors).sort(([, a], [, b]) => Math.abs(Math.log(a / ratio)) - Math.abs(Math.log(b / ratio)))[0]![0]
}

describe('Beam bending answers match the model (LRN-04)', () => {
  it('doubling the load doubles the tip deflection', () => {
    const ratio = tip({ forceN: 200 }) / tip({ forceN: 100 })
    expect(ratio).toBeCloseTo(2, 12)
    expect(closest({ same: 1, double: 2, quadruple: 4, half: 0.5 }, ratio)).toBe(step('load').question.answerId)
  })

  it('doubling the length multiplies the tip deflection by eight', () => {
    const ratio = tip({ lengthM: 1 }) / tip({ lengthM: 0.5 })
    expect(ratio).toBeCloseTo(8, 12)
    expect(closest({ x2: 2, x4: 4, x8: 8, x16: 16 }, ratio)).toBe(step('length').question.answerId)
  })

  it('aluminium deflects about 2.9 times as much as steel', () => {
    const ratio = tip({ youngsModulusPa: demoMaterial('aluminium').youngsModulusPa }) / tip({ youngsModulusPa: demoMaterial('steel').youngsModulusPa })
    expect(ratio.toFixed(1)).toBe('2.9')
    expect(step('material').question.explanation).toContain('2.9 times')
    expect(closest({ same: 1, 'x1.5': 1.5, x3: 3, x10: 10 }, ratio)).toBe(step('material').question.answerId)
  })

  it('standing the 40 × 20 mm bar upright quarters the tip deflection', () => {
    const ratio = tip({ section: demoSection('upright').section }) / tip({ section: demoSection('flat').section })
    expect(ratio).toBeCloseTo(0.25, 12)
    expect(closest({ same: 1, half: 0.5, quarter: 0.25, sixteenth: 1 / 16 }, ratio)).toBe(step('section').question.answerId)
  })

  it('bending stress peaks at the fixed end on the outer surfaces, tension on top', () => {
    const input = baseInput()
    const L = input.lengthM
    const candidates = {
      tip: Math.abs(stressAt(input, L, 1)),
      middle: Math.abs(stressAt(input, L / 2, 1)),
      rootSurface: Math.abs(stressAt(input, 0, 1)),
      rootCentre: Math.abs(stressAt(input, 0, 0)),
    }
    const highest = Object.entries(candidates).sort(([, a], [, b]) => b - a)[0]![0]
    expect(highest).toBe(step('stress').question.answerId)
    expect(stressAt(input, 0, 1)).toBeGreaterThan(0)
    expect(stressAt(input, 0, -1)).toBeLessThan(0)
    expect(stressAt(input, 0, 1)).toBeCloseTo(cantileverResponse(input).maxStressPa, 6)
    expect(momentAt(input, 0)).toBe(cantileverResponse(input).rootMomentNm)
    expect(momentAt(input, L)).toBe(0)
  })
})

describe('Beam bending content shape (LRN-02)', () => {
  it('has short concepts, four distinct options with a valid answer, and an equation for each step', () => {
    expect(beamBending.steps.length).toBeGreaterThanOrEqual(4)
    for (const s of beamBending.steps) {
      expect(s.concept.length).toBeGreaterThan(0)
      expect(s.concept.length).toBeLessThanOrEqual(3)
      const ids = s.question.options.map((o) => o.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toContain(s.question.answerId)
      expect(s.advanced.length).toBeGreaterThan(0)
      for (const a of s.advanced) expect(a.tex).not.toMatch(/\\fcolorbox|\\boldsymbol/) // CSP-safe KaTeX (D-56)
    }
  })

  it('suggests demo settings inside the control ranges', () => {
    const { force, length } = DEMO_DEFAULTS
    for (const n of [100, 200]) expect(n >= force.min && n <= force.max && (n - force.min) % force.step === 0).toBe(true)
    for (const m of [0.5, 1]) expect(m >= length.min && m <= length.max && Math.abs(((m - length.min) / length.step) % 1) < 1e-9).toBe(true)
  })

  it('compares sections of about the same area', () => {
    const areas = DEMO_SECTIONS.map((s) => cantileverResponse(baseInput({ section: s.section })).areaM2)
    for (const a of areas) expect(Math.abs(a - 8e-4) / 8e-4).toBeLessThan(0.01)
  })

  it('scales each demo drawing to the largest deflection its controls can reach', () => {
    expect(demoMaxDeflectionM('load')).toBe(tip({ forceN: 400 }))
    expect(demoMaxDeflectionM('length')).toBe(tip({ lengthM: 2 }))
    expect(demoMaxDeflectionM('material')).toBe(tip({ youngsModulusPa: Math.min(...DEMO_MATERIALS.map((m) => m.youngsModulusPa)) }))
    expect(demoMaxDeflectionM('section')).toBe(tip({ section: demoSection('flat').section }))
    expect(demoMaxDeflectionM('stress')).toBe(tip({}))
  })

  it('draws a shape that starts at the wall and ends at the tip deflection', () => {
    const input = baseInput()
    const shape = deflectedShape(input, 10)
    expect(shape[0]).toEqual({ xM: 0, deflectionM: 0 })
    expect(shape[10]!.xM).toBe(input.lengthM)
    expect(shape[10]!.deflectionM).toBeCloseTo(cantileverResponse(input).tipDeflectionM, 12)
  })
})

describe('Learn catalog (LRN-01, LRN-06)', () => {
  it('lists Beam bending under Solid mechanics → Mechanics of materials and opens a runnable challenge', () => {
    const topic = LEARN_SUBJECTS[0]!.topics[0]!
    expect([LEARN_SUBJECTS[0]!.title, topic.title]).toEqual(['Solid mechanics', 'Mechanics of materials'])
    expect(topic.modules[0]).toEqual({ status: 'available', module: beamBending })
    expect(LEARN_MODULES).toEqual([beamBending])
    expect(learnModule('beam-bending')).toBe(beamBending)
    expect(learnModule('nope')).toBeUndefined()
    const entry = catalog.find((e) => e.available && e.challengeId === beamBending.apply.challengeId)
    expect(entry?.title).toBe(beamBending.apply.title)
  })

  it('gives every module and planned entry a unique id', () => {
    const ids = LEARN_SUBJECTS.flatMap((s) => s.topics.flatMap((t) => t.modules.map((m) => (m.status === 'available' ? m.module.id : m.id))))
    expect(new Set(ids).size).toBe(ids.length)
  })
})
