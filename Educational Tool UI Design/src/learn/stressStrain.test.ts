import { describe, expect, it } from 'vitest'
import { catalog } from '../challenge/catalog'
import { AXIAL_DEMO_DEFAULTS, AXIAL_DEMO_MATERIALS, baseRod, demoMaterial, demoMaxElongationM, rodResponse, strainOf, stressForStrain, yieldStrain } from './axialDemo'
import { LEARN_MODULES, LEARN_SUBJECTS, learnModule } from './catalog'
import { stressStrain } from './modules/stressStrain'
import type { LearnStep } from './types'

// Task 72 (SSL-02, SSL-03, LRN-04): the Stress and strain answers agree with the physics the demos
// use (physics/axial through learn/axialDemo), so the content cannot drift from the model.

const step = (id: string): LearnStep => stressStrain.steps.find((s) => s.id === id)!
const response = (overrides: Parameters<typeof baseRod>[0]) => rodResponse(baseRod(overrides))

/** The option whose stated factor is closest to the model's ratio. */
function closest(factors: Record<string, number>, ratio: number): string {
  return Object.entries(factors).sort(([, a], [, b]) => Math.abs(Math.log(a / ratio)) - Math.abs(Math.log(b / ratio)))[0]![0]
}

describe('Stress and strain answers match the model (LRN-04)', () => {
  it('doubling the diameter quarters the stress', () => {
    const ratio = response({ diameterM: 0.02 }).stressPa / response({ diameterM: 0.01 }).stressPa
    expect(ratio).toBeCloseTo(0.25, 12)
    expect(closest({ half: 0.5, quarter: 0.25, same: 1, double: 2 }, ratio)).toBe(step('area').question.answerId)
  })

  it('the same 1 mm stretch is twice the strain on a 1 m rod as on a 2 m rod', () => {
    const short = strainOf(0.001, 1)
    const long = strainOf(0.001, 2)
    expect(short / long).toBeCloseTo(2, 12)
    const larger = short > long ? 'short' : long > short ? 'long' : 'same'
    expect(larger).toBe(step('strain').question.answerId)
    // The strain needs a stress; the explanation's "twice the stress" follows Hooke's law.
    const steel = demoMaterial('steel')
    expect(stressForStrain(short, steel).stressPa / stressForStrain(long, steel).stressPa).toBeCloseTo(2, 12)
  })

  it('aluminium stretches about 2.9 times as much as steel, at the same stress', () => {
    const steel = response({ material: demoMaterial('steel') })
    const al = response({ material: demoMaterial('aluminium') })
    expect(al.stressPa).toBe(steel.stressPa)
    const ratio = al.elongationM / steel.elongationM
    expect(ratio.toFixed(1)).toBe('2.9')
    expect(step('hooke').question.explanation).toContain('2.9 times')
    expect(closest({ same: 1, 'x1.5': 1.5, x3: 3, x10: 10 }, ratio)).toBe(step('hooke').question.answerId)
  })

  it('steel is about three times stiffer, yet 6061-T6 yields at a slightly higher stress', () => {
    const steel = demoMaterial('steel')
    const al = demoMaterial('aluminium')
    expect((steel.elasticModulusPa / al.elasticModulusPa).toFixed(1)).toBe('2.9')
    const strengthRatio = al.yieldStressPa / steel.yieldStressPa
    expect(strengthRatio).toBeGreaterThan(1)
    expect(strengthRatio).toBeLessThan(1.25)
    // Options state the aluminium/steel yield-strength ratio.
    expect(closest({ steel3: 1 / 3, steelBit: 0.8, similar: 1.1, aluminium3: 3 }, strengthRatio)).toBe(step('yield').question.answerId)
    expect(step('yield').question.explanation).toContain(`${steel.yieldStressPa / 1e6} MPa`)
    expect(step('yield').question.explanation).toContain(`${al.yieldStressPa / 1e6} MPa`)
  })

  it('raising the load takes steel past yield first, then aluminium; titanium stays elastic in the demo range', () => {
    const { min, max, step: by } = AXIAL_DEMO_DEFAULTS.forceKn
    const firstYield = (id: 'steel' | 'aluminium' | 'titanium') => {
      for (let kn = min; kn <= max; kn += by) if (response({ forceN: kn * 1000, material: demoMaterial(id) }).beyondYield) return kn
      return undefined
    }
    expect(firstYield('steel')).toBe(20)
    expect(firstYield('aluminium')).toBe(22)
    expect(firstYield('titanium')).toBeUndefined()
    expect(firstYield('steel')!).toBeLessThan(firstYield('aluminium')!)
    // At yield the strain is σ_y / E, and below it the response is linear.
    for (const m of AXIAL_DEMO_MATERIALS) expect(stressForStrain(yieldStrain(m), m).stressPa).toBeCloseTo(m.yieldStressPa, 3)
  })

  it('twice the length gives twice the elongation, with the same stress and strain', () => {
    const a = response({ lengthM: 2 })
    const b = response({ lengthM: 4 })
    expect(b.elongationM / a.elongationM).toBeCloseTo(2, 12)
    expect(b.stressPa).toBe(a.stressPa)
    expect(b.strain).toBe(a.strain)
    expect(closest({ same: 1, double: 2, x4: 4, half: 0.5 }, b.elongationM / a.elongationM)).toBe(step('length').question.answerId)
  })

  it('flags a small diameter beyond yield in the area demo (not modeled)', () => {
    expect(response({ diameterM: AXIAL_DEMO_DEFAULTS.diameterMm.min / 1000 }).beyondYield).toBe(true)
    expect(response({}).beyondYield).toBe(false)
    expect(stressForStrain(strainOf(0.002, 1), demoMaterial('steel')).beyondYield).toBe(true)
  })
})

describe('Stress and strain content shape (LRN-02, SSL-02)', () => {
  it('has five steps with short concepts, four distinct options with a valid answer, and CSP-safe equations', () => {
    expect(stressStrain.steps.map((s) => s.id)).toEqual(['area', 'strain', 'hooke', 'yield', 'length'])
    expect(stressStrain.steps.map((s) => s.demo)).toEqual(['axial-area', 'axial-strain', 'axial-hooke', 'axial-yield', 'axial-length'])
    for (const s of stressStrain.steps) {
      expect(s.concept.length).toBeGreaterThan(0)
      expect(s.concept.length).toBeLessThanOrEqual(3)
      const ids = s.question.options.map((o) => o.id)
      expect(ids).toHaveLength(4)
      expect(new Set(ids).size).toBe(4)
      expect(ids).toContain(s.question.answerId)
      expect(s.advanced.length).toBeGreaterThan(0)
      for (const a of s.advanced) {
        expect(a.tex).not.toMatch(/\\fcolorbox|\\boldsymbol|\\colorbox|\\style|\\htmlStyle/) // CSP-safe KaTeX (D-56)
        expect(a.tex).toMatch(/\\dfrac/) // fractions, not slashes (D-56)
      }
    }
  })

  it('suggests demo settings inside the control ranges', () => {
    const inRange = (v: number, r: { min: number; max: number; step: number }) => v >= r.min && v <= r.max && Math.abs(((v - r.min) / r.step) % 1) < 1e-9
    const D = AXIAL_DEMO_DEFAULTS
    for (const mm of [10, 20]) expect(inRange(mm, D.diameterMm)).toBe(true)
    for (const m of [2, 4]) expect(inRange(m, D.lengthRange)).toBe(true)
    expect(inRange(1, D.elongationMm)).toBe(true)
    expect(D.strainLengths).toEqual([1, 2])
    for (const kn of [20, 22]) expect(inRange(kn, D.forceKn)).toBe(true)
  })

  it('scales each demo drawing to the largest elongation its controls can reach', () => {
    const D = AXIAL_DEMO_DEFAULTS
    expect(demoMaxElongationM('axial-area')).toBe(response({ diameterM: 0.005 }).elongationM)
    expect(demoMaxElongationM('axial-strain')).toBe(D.elongationMm.max / 1000)
    expect(demoMaxElongationM('axial-hooke')).toBe(response({ material: demoMaterial('aluminium') }).elongationM)
    expect(demoMaxElongationM('axial-yield')).toBe(response({ material: demoMaterial('aluminium'), forceN: 30000 }).elongationM)
    expect(demoMaxElongationM('axial-length')).toBe(response({ lengthM: 4 }).elongationM)
  })
})

describe('Learn catalog with Stress and strain (SSL-01, SSL-05)', () => {
  it('replaces the Planned entry in place and opens a runnable Introductory challenge', () => {
    const topic = LEARN_SUBJECTS[0]!.topics[0]!
    const ids = topic.modules.map((m) => (m.status === 'available' ? m.module.id : m.id))
    expect(ids.indexOf('stress-strain')).toBe(2)
    expect(topic.modules[2]).toEqual({ status: 'available', module: stressStrain })
    expect(LEARN_MODULES).toContain(stressStrain)
    expect(learnModule('stress-strain')).toBe(stressStrain)
    expect(stressStrain.art).toBe('rod')
    const entry = catalog.find((e) => e.available && e.challengeId === stressStrain.apply.challengeId)
    expect(entry).toMatchObject({ title: stressStrain.apply.title, difficulty: 'introductory' })
  })
})
