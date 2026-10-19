import { describe, expect, it } from 'vitest'
import { catalog } from '../challenge/catalog'
import { bundledChallengeJson } from '../challenge/bundled'
import { LEARN_MODULES, LEARN_SUBJECTS, learnModule } from './catalog'
import { torsion } from './modules/torsion'
import { baseShaft, DEMO_SHAFT_SECTIONS, demoMaxTwistRad, demoShaftSection, shaftResponse, shearStressAt, solidSection, TORSION_DEMO_DEFAULTS } from './torsionDemo'
import type { LearnStep } from './types'

// Task 71 (D-61; LRN-02, LRN-04): the Torsion answers agree with the physics the demos use
// (physics/torsion/shaft through learn/torsionDemo), so the content cannot drift from the model.

const step = (id: string): LearnStep => torsion.steps.find((s) => s.id === id)!
const twist = (overrides: Parameters<typeof baseShaft>[0]) => shaftResponse(baseShaft(overrides)).twistRad
const stress = (overrides: Parameters<typeof baseShaft>[0]) => shaftResponse(baseShaft(overrides)).maxShearStressPa

/** The option whose stated factor is closest to the model's ratio. */
function closest(factors: Record<string, number>, ratio: number): string {
  return Object.entries(factors).sort(([, a], [, b]) => Math.abs(Math.log(a / ratio)) - Math.abs(Math.log(b / ratio)))[0]![0]
}

describe('Torsion answers match the model (LRN-04)', () => {
  it('doubling the torque doubles the angle of twist and the shear stress', () => {
    const ratio = twist({ torqueNm: 100 }) / twist({ torqueNm: 50 })
    expect(ratio).toBeCloseTo(2, 12)
    expect(stress({ torqueNm: 100 }) / stress({ torqueNm: 50 })).toBeCloseTo(2, 12)
    expect(closest({ same: 1, double: 2, quadruple: 4, half: 0.5 }, ratio)).toBe(step('torque').question.answerId)
  })

  it('doubling the length doubles the twist and leaves the shear stress unchanged', () => {
    const ratio = twist({ lengthM: 1 }) / twist({ lengthM: 0.5 })
    expect(ratio).toBeCloseTo(2, 12)
    expect(stress({ lengthM: 1 })).toBe(stress({ lengthM: 0.5 }))
    expect(closest({ same: 1, x2: 2, x4: 4, x8: 8 }, ratio)).toBe(step('length').question.answerId)
  })

  it('doubling the diameter from 20 to 40 mm cuts the twist 16 times and the peak stress 8 times', () => {
    const ratio = twist({ section: solidSection(40) }) / twist({ section: solidSection(20) })
    expect(ratio).toBeCloseTo(1 / 16, 12)
    expect(stress({ section: solidSection(40) }) / stress({ section: solidSection(20) })).toBeCloseTo(1 / 8, 12)
    const J = (d: number) => shaftResponse(baseShaft({ section: solidSection(d) })).polarMomentM4
    expect(J(40) / J(20)).toBeCloseTo(16, 10)
    expect(closest({ half: 0.5, quarter: 0.25, eighth: 1 / 8, sixteenth: 1 / 16 }, ratio)).toBe(step('diameter').question.answerId)
  })

  it('the 29/21 mm tube has the same area as the 20 mm bar, about 3.2 times its J and under a third of its twist', () => {
    const bar = shaftResponse(baseShaft({ section: demoShaftSection('solid20').section }))
    const tube = shaftResponse(baseShaft({ section: demoShaftSection('tube29').section }))
    expect(tube.areaM2 / bar.areaM2).toBeCloseTo(1, 12)
    expect((tube.polarMomentM4 / bar.polarMomentM4).toFixed(1)).toBe('3.2')
    expect(step('hollow').question.explanation).toContain('3.2 times')
    expect(tube.twistRad / bar.twistRad).toBeLessThan(1 / 3)
    const answer = tube.twistRad < bar.twistRad ? 'tube' : 'solid'
    expect(answer).toBe(step('hollow').question.answerId)
  })

  it('shear stress is zero at the centre, highest at the outer surface and linear between', () => {
    const input = baseShaft()
    const candidates = { centre: shearStressAt(input, 0), middle: shearStressAt(input, 0.5), surface: shearStressAt(input, 1) }
    const highest = Object.entries(candidates).sort(([, a], [, b]) => b - a)[0]![0]
    expect(highest).toBe(step('stress').question.answerId)
    expect(candidates.centre).toBe(0)
    expect(candidates.surface).toBeCloseTo(shaftResponse(input).maxShearStressPa, 6)
    expect(candidates.middle).toBeCloseTo(candidates.surface / 2, 6)
    expect(shearStressAt(input, 2)).toBe(candidates.surface) // clamped to the surface
  })
})

describe('Torsion content shape (LRN-02)', () => {
  it('has five steps with short concepts, four distinct options with a valid answer, and CSP-safe equations', () => {
    expect(torsion).toMatchObject({ id: 'torsion', art: 'shaft' })
    expect(torsion.steps).toHaveLength(5)
    for (const s of torsion.steps) {
      expect(s.concept.length).toBeGreaterThan(0)
      expect(s.concept.length).toBeLessThanOrEqual(3)
      expect(s.question.options).toHaveLength(4)
      const ids = s.question.options.map((o) => o.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toContain(s.question.answerId)
      expect(s.demo.startsWith('torsion-')).toBe(true)
      expect(s.advanced.length).toBeGreaterThan(0)
      for (const a of s.advanced) expect(a.tex).not.toMatch(/\\fcolorbox|\\boldsymbol|\\color|\\style/) // CSP-safe KaTeX (D-56)
    }
  })

  it('suggests demo settings inside the control ranges', () => {
    const on = (v: number, r: { min: number; max: number; step: number }) => v >= r.min && v <= r.max && Math.abs(((v - r.min) / r.step) % 1) < 1e-9
    const { torque, length, diameter, radius } = TORSION_DEMO_DEFAULTS
    for (const t of [50, 100]) expect(on(t, torque)).toBe(true)
    for (const l of [0.5, 1]) expect(on(l, length)).toBe(true)
    for (const d of [20, 40]) expect(on(d, diameter)).toBe(true)
    expect([radius.min, radius.max]).toEqual([0, TORSION_DEMO_DEFAULTS.diameterMm / 2])
  })

  it('compares sections of exactly the same area', () => {
    const areas = DEMO_SHAFT_SECTIONS.map((s) => shaftResponse(baseShaft({ section: s.section })).areaM2)
    for (const a of areas) expect(a).toBeCloseTo(areas[0]!, 12)
  })

  it('scales each demo drawing to the largest twist its controls can reach', () => {
    expect(demoMaxTwistRad('torsion-torque')).toBe(twist({ torqueNm: 150 }))
    expect(demoMaxTwistRad('torsion-length')).toBe(twist({ lengthM: 2 }))
    expect(demoMaxTwistRad('torsion-diameter')).toBe(twist({ section: solidSection(20) }))
    expect(demoMaxTwistRad('torsion-hollow')).toBe(twist({ section: demoShaftSection('solid20').section }))
    expect(demoMaxTwistRad('torsion-stress')).toBe(twist({}))
  })

  it('uses generic teaching values, not the challenge constants', () => {
    const ch = bundledChallengeJson('torsion-shaft-1') as { torqueNm: number; lengthM: number }
    expect(TORSION_DEMO_DEFAULTS.torqueNm).not.toBe(ch.torqueNm)
    expect(TORSION_DEMO_DEFAULTS.lengthM).not.toBe(ch.lengthM)
  })
})

describe('Torsion in the Learn catalog (LRN-01, LRN-06)', () => {
  it('is listed under Solid mechanics → Mechanics of materials and opens Torsion Shaft I', () => {
    const topic = LEARN_SUBJECTS[0]!.topics.find((t) => t.id === 'mechanics-of-materials')!
    expect(topic.modules).toContainEqual({ status: 'available', module: torsion })
    expect(LEARN_MODULES).toContain(torsion)
    expect(learnModule('torsion')).toBe(torsion)
    const entry = catalog.find((e) => e.available && e.challengeId === torsion.apply.challengeId)
    expect(entry?.title).toBe(torsion.apply.title)
  })
})
