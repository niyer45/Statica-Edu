import { describe, expect, it } from 'vitest'
import { catalog } from './catalog'
import {
  bundledChallengeResult,
  CANTILEVER_BEAM_1_ID,
  cantileverBeam1Json,
  toStudentChallenge,
} from './content'
import { validateDesign } from '../geometry/validate'
import { crossFieldIssues, loadChallenge } from './loader'
import type { Challenge } from './types'

function bundled(): Challenge {
  if (!bundledChallengeResult.ok) {
    throw new Error(`bundled challenge invalid: ${JSON.stringify(bundledChallengeResult.error)}`)
  }
  return bundledChallengeResult.value
}

describe('bundled cantilever-beam-1 challenge', () => {
  it('loads with zero issues and equals the JSON values (Req 3.1)', () => {
    const r = loadChallenge(cantileverBeam1Json)
    expect(r.ok ? [] : r.error).toEqual([])
    expect(r.ok && r.value).toEqual(cantileverBeam1Json)
    expect(bundled()).toEqual(cantileverBeam1Json)
  })

  it('defines the Requirement 3.5 / 3.6 values', () => {
    const ch = bundled()
    expect(ch.id).toBe(CANTILEVER_BEAM_1_ID)
    expect(ch.difficulty).toBe('introductory')
    expect(ch.allowedModes).toEqual(['guided', 'parametric'])
    expect(ch.initialDesign.lengthM).toBe(0.6)
    expect(ch.load).toEqual({ forceN: 300, location: 'freeEnd', direction: 'down' })
    expect(ch.material).toMatchObject({
      elasticModulusPa: 69e9,
      densityKgM3: 2700,
      allowableStressPa: 120e6,
      yieldStressPa: 240e6,
    })
    expect(ch.initialDesign.materialId).toBe(ch.material.id)
    // Content version 3 (D-47 amendment): a solid Ø31 mm circle failing deflection and mass.
    expect(ch.initialDesign.section).toEqual({ kind: 'circle', diameterM: 0.031 })
    expect(ch.initialDesign.orientationDeg).toBe(0)
    expect(ch.version).toBe(3)
    expect(ch.constraints).toEqual({
      maxMassKg: 1.2,
      maxDeflectionM: 0.004,
      maxStressPa: 120e6,
      maxWidthM: 0.08,
      maxHeightM: 0.08,
    })
    const lim = ch.sectionLimits
    expect(lim.circle.diameterM).toEqual({ minM: 0.005, maxM: 0.1, stepM: 0.0005 })
    expect(lim.tube.outerDiameterM).toMatchObject({ minM: 0.01, maxM: 0.1 })
    expect(lim.tube.minWallM).toBe(0.002)
    expect(lim.rectangle.widthM).toMatchObject({ minM: 0.003, maxM: 0.1 })
    expect(lim.rectangle.heightM).toMatchObject({ minM: 0.003, maxM: 0.1 })
    expect(lim.iSection.widthM).toMatchObject({ minM: 0.01, maxM: 0.1 })
    expect(lim.iSection.heightM).toMatchObject({ minM: 0.01, maxM: 0.1 })
    expect(ch.sectionDefaults).toEqual({
      tubeWallM: 0.004,
      iSectionFlangeThicknessM: 0.004,
      iSectionWebThicknessM: 0.004,
    })
    expect(ch.predictionPolicy.requiredOnIterations).toEqual([1, 3])
    expect(ch.visualization).toEqual({ exaggerationFactor: 15, maxVisualDeflectionFractionOfL: 0.3 })
    expect(ch.reflectionPrompt.text.trim().length).toBeGreaterThan(0)
  })

  it('is deep-frozen (Req 3.4)', () => {
    const ch = bundled() as Record<string, any>
    expect(Object.isFrozen(ch)).toBe(true)
    expect(Object.isFrozen(ch.sectionLimits.iSection.heightM)).toBe(true)
    expect(Object.isFrozen(ch.referenceDesign.section)).toBe(true)
    expect(() => { ch.constraints.maxMassKg = 99 }).toThrow(TypeError)
    expect(ch.constraints.maxMassKg).toBe(1.2)
  })

  it('passes every section cross-field rule (Req 3.9)', () => {
    expect(crossFieldIssues(bundled())).toEqual([])
  })

  it('has initial and reference designs that pass the geometry validator', () => {
    const ch = bundled()
    expect(validateDesign(ch.initialDesign, ch)).toEqual([])
    expect(ch.referenceDesign).toBeDefined()
    if (ch.referenceDesign) expect(validateDesign(ch.referenceDesign, ch)).toEqual([])
    expect(ch.allowedSections).toContain(ch.initialDesign.section.kind)
  })

  it('rejects the bundled JSON with an unknown nested key or a broken rule (Req 3.8, 3.9)', () => {
    const extra = structuredClone(cantileverBeam1Json) as Record<string, any>
    extra.referenceDesign.section.secret = 1
    const r1 = loadChallenge(extra)
    expect(r1.ok ? [] : r1.error.map((i) => i.path)).toEqual(['referenceDesign.section.secret'])

    const broken = structuredClone(cantileverBeam1Json) as Record<string, any>
    broken.sectionLimits.tube.minWallM = 0.001
    const r2 = loadChallenge(broken)
    expect(r2.ok ? [] : r2.error.map((i) => i.rule)).toEqual(['TUBE_WALL_MIN'])
  })

  it('carries the verified reference I-section with locked length and material', () => {
    const ch = bundled()
    expect(ch.referenceDesign).toEqual({
      id: 'reference',
      section: { kind: 'iSection', widthM: 0.04, heightM: 0.06, flangeThicknessM: 0.004, webThicknessM: 0.003 },
      orientationDeg: 0,
      lengthM: ch.initialDesign.lengthM,
      materialId: ch.material.id,
    })
  })
})

describe('toStudentChallenge (Req 3.7)', () => {
  it('omits the referenceDesign key and keeps every other field', () => {
    const ch = bundled()
    const student = toStudentChallenge(ch)
    expect('referenceDesign' in student).toBe(false)
    expect(JSON.stringify(student)).not.toContain('referenceDesign')
    const { referenceDesign: _r, ...rest } = ch
    void _r
    expect(student).toEqual(rest)
    expect(Object.isFrozen(student)).toBe(true)
    expect('referenceDesign' in ch).toBe(true) // source untouched
  })
})

describe('catalog', () => {
  it('lists the six template challenges and the owner-requested additions (tasks 68–70, 72) with the activated ones available', () => {
    expect(catalog.map((c) => c.id)).toEqual(['001', '002', '003', '004', '005', '006', '007', '008', '009', '010'])
    const available = catalog.filter((c) => c.available)
    expect(available.map((c) => c.challengeId)).toEqual(['cantilever-beam-1', 'mounting-bracket-1', 'torsion-shaft-1', 'heat-sink-1', 'braced-frame-1', 'vibration-isolation-1', 'column-buckling-1', 'pressure-vessel-1', 'fatigue-analysis-1', 'stress-strain-1'])
    expect(available.find((c) => c.id === '003')).toMatchObject({ title: 'Torsion Shaft I', challengeId: 'torsion-shaft-1', difficulty: 'introductory' })
    expect(available[0]).toMatchObject({ title: 'Cantilever Beam I', challengeId: CANTILEVER_BEAM_1_ID })
    expect(available[0].title).toBe(bundled().title)
    expect(available[0].difficulty).toBe(bundled().difficulty)
  })

  it('previews carry no challenge link or physics data', () => {
    const allowedKeys = ['id', 'title', 'description', 'discipline', 'difficulty', 'time', 'concepts', 'available', 'art']
    for (const c of catalog.filter((e) => !e.available)) {
      expect(Object.keys(c).sort()).toEqual([...allowedKeys].sort())
    }
  })
})
