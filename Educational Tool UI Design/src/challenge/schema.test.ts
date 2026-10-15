import { describe, expect, it } from 'vitest'
import { challengeSchema } from './schema'

const range = (minM: number, maxM: number) => ({ minM, maxM, stepM: 0.001 })

const valid = {
  id: 'cantilever-beam-1',
  version: 1,
  title: 'Cantilever Beam I: Reduce Deflection',
  difficulty: 'introductory',
  allowedModes: ['guided', 'parametric'],
  statement: 'Reduce the tip deflection.',
  material: {
    id: 'al-6061-t6',
    name: 'Aluminium 6061-T6',
    elasticModulusPa: 69e9,
    densityKgM3: 2700,
    allowableStressPa: 120e6,
    yieldStressPa: 276e6,
  },
  initialDesign: {
    id: 'base',
    section: { kind: 'rectangle', widthM: 0.03, heightM: 0.02 },
    orientationDeg: 0,
    lengthM: 1,
    materialId: 'al-6061-t6',
  },
  lockedFields: ['lengthM', 'materialId', 'forceN', 'support'],
  support: 'fixedRoot',
  load: { forceN: 500, location: 'freeEnd', direction: 'down' },
  constraints: {
    maxMassKg: 1.5,
    maxDeflectionM: 0.005,
    maxStressPa: 120e6,
    maxWidthM: 0.06,
    maxHeightM: 0.08,
  },
  sectionLimits: {
    circle: { diameterM: range(0.01, 0.06) },
    tube: { outerDiameterM: range(0.01, 0.06), minWallM: 0.002 },
    rectangle: { widthM: range(0.01, 0.06), heightM: range(0.01, 0.08) },
    iSection: {
      widthM: range(0.02, 0.06),
      heightM: range(0.02, 0.08),
      minFlangeThicknessM: 0.003,
      minWebThicknessM: 0.003,
      minClearWebHeightM: 0.003,
    },
  },
  sectionDefaults: { tubeWallM: 0.004, iSectionFlangeThicknessM: 0.004, iSectionWebThicknessM: 0.004 },
  allowedSections: ['circle', 'tube', 'rectangle', 'iSection'],
  predictionPolicy: { requiredOnIterations: [1, 3] },
  reflectionPrompt: { id: 'r1', text: 'Why did your change work?' },
  visualization: { exaggerationFactor: 15, maxVisualDeflectionFractionOfL: 0.3 },
  content: { conceptNotes: { inertia: 'Second moment of area.' }, collegeDetails: false },
}

const clone = (): Record<string, any> => structuredClone(valid)

describe('challengeSchema', () => {
  it('accepts a structurally valid challenge unchanged', () => {
    const r = challengeSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toEqual(valid)
  })

  it('rejects unknown keys at the root and at nested levels, naming the path', () => {
    const c = clone()
    c.extra = 1
    c.material.extra = 1
    c.initialDesign.section.extra = 1
    c.sectionLimits.tube.outerDiameterM.extra = 1
    const r = challengeSchema.safeParse(c)
    expect(r.success).toBe(false)
    const unknown = r.error!.issues.filter((i) => i.code === 'unrecognized_keys')
    expect(unknown.map((i) => i.path.join('.')).sort()).toEqual([
      '',
      'initialDesign.section',
      'material',
      'sectionLimits.tube.outerDiameterM',
    ])
  })

  it('requires a non-empty allowedModes independent of difficulty', () => {
    const empty = clone()
    empty.allowedModes = []
    expect(challengeSchema.safeParse(empty).success).toBe(false)

    for (const difficulty of ['introductory', 'intermediate', 'advanced']) {
      for (const allowedModes of [['freeform'], ['guided'], ['guided', 'parametric']]) {
        const c = clone()
        c.difficulty = difficulty
        c.allowedModes = allowedModes
        expect(challengeSchema.safeParse(c).success).toBe(true)
      }
    }
  })

  it('accepts an optional referenceDesign and rejects a bad orientation', () => {
    const c = clone()
    c.referenceDesign = { ...valid.initialDesign, id: 'ref' }
    expect(challengeSchema.safeParse(c).success).toBe(true)
    c.referenceDesign.orientationDeg = 45
    expect(challengeSchema.safeParse(c).success).toBe(false)
  })
})
