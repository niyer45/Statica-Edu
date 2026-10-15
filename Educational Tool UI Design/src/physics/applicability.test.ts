import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../challenge/content'
import { deepFreeze } from '../challenge/deepFreeze'
import type { Challenge } from '../challenge/types'
import type { BeamDesign, Orientation, Section } from '../geometry/sections'
import { checkApplicability } from './applicability'
import { maxMoment, nominalStress, tipDeflection } from './beam'
import { THRESHOLDS } from './constants'
import { bendingProperties, sectionProperties } from './sectionProperties'
import type { ApplicabilityInput } from './types'

if (!bundledChallengeResult.ok) throw new Error('bundled challenge failed to load')
const ch: Challenge = bundledChallengeResult.value
const F = ch.load.forceN
const L = ch.initialDesign.lengthM
const E = ch.material.elasticModulusPa

const design = (section: Section, orientationDeg: Orientation = 0): BeamDesign => ({
  id: 'd',
  section,
  orientationDeg,
  lengthM: L,
  materialId: ch.material.id,
})

/** δ and σ from beam.ts with the bundled challenge F, L, E. */
const base = (d: BeamDesign): ApplicabilityInput => {
  const { I, c } = bendingProperties(sectionProperties(d.section), d.orientationDeg)
  return {
    tipDeflectionM: tipDeflection(F, L, E, I),
    nominalMaxStressPa: nominalStress(maxMoment(F, L), c, I),
  }
}

const check = (d: BeamDesign) => checkApplicability(d, base(d), ch)
const codes = (issues: { code: string }[]) => issues.map((i) => i.code)

const iSection = (widthM: number): Section => ({
  kind: 'iSection',
  widthM,
  heightM: 0.06,
  flangeThicknessM: 0.004,
  webThicknessM: 0.003,
})

describe('checkApplicability', () => {
  it('reference I-section: depth/span exactly 0.10 gives no issue', () => {
    const r = check(design(iSection(0.04)))
    expect(r).toEqual({ warnings: [], notApplicable: [] })
  })

  it('rectFlat 15×45 at 90°: LARGE_DEFLECTION warning, RECT_ASPECT not evaluated', () => {
    const d = design({ kind: 'rectangle', widthM: 0.015, heightM: 0.045 }, 90)
    const r = check(d)
    expect(r.notApplicable).toEqual([])
    expect(codes(r.warnings)).toEqual(['LARGE_DEFLECTION'])
    const w = r.warnings[0]
    expect(w.value).toBeCloseTo(0.0412, 3)
    expect(w.threshold).toBe(THRESHOLDS.LARGE_DEFLECTION.warning)
    expect(w.message).toContain('large deflection')
  })

  it('rectTall 20×60 at 0°: aspect 3 and depth/span 0.10 give no issue', () => {
    expect(check(design({ kind: 'rectangle', widthM: 0.02, heightM: 0.06 }))).toEqual({
      warnings: [],
      notApplicable: [],
    })
  })

  it('RECT_ASPECT is evaluated only when the long side is vertical', () => {
    const thin: Section = { kind: 'rectangle', widthM: 0.003, heightM: 0.03 }
    const upright = check(design(thin, 0))
    const aspect = upright.warnings.find((i) => i.code === 'RECT_ASPECT')
    expect(aspect?.value).toBeCloseTo(10, 9)
    expect(aspect?.threshold).toBe(THRESHOLDS.RECT_ASPECT.warning)
    expect(aspect?.message).toContain('lateral-torsional buckling')

    const flat = check(design(thin, 90))
    expect(codes([...flat.warnings, ...flat.notApplicable])).not.toContain('RECT_ASPECT')
  })

  it('wideI b = 0.090: FLANGE_OUTSTAND warning of 10.875', () => {
    const r = check(design(iSection(0.09)))
    expect(r.notApplicable).toEqual([])
    expect(codes(r.warnings)).toEqual(['FLANGE_OUTSTAND'])
    expect(r.warnings[0].value).toBeCloseTo(10.875, 9)
    expect(r.warnings[0].threshold).toBe(10)
    expect(r.warnings[0].message).toContain('flange local buckling')
  })

  it('tinyCircle Ø0.005: LARGE_DEFLECTION and PLASTICITY not applicable, not also warnings', () => {
    const r = check(design({ kind: 'circle', diameterM: 0.005 }))
    expect(codes(r.notApplicable)).toEqual(['LARGE_DEFLECTION', 'PLASTICITY'])
    expect(r.warnings).toEqual([])
    expect(r.notApplicable[0].threshold).toBe(THRESHOLDS.LARGE_DEFLECTION.notApplicable)
    expect(r.notApplicable[1].threshold).toBe(THRESHOLDS.PLASTICITY.notApplicable)
    expect(r.notApplicable[1].message).toContain('plasticity')
    expect(r.notApplicable[1].message).toContain('cannot be trusted')
  })

  it('thin tube D 0.100 / d 0.096: TUBE_SLENDERNESS 50 and DEPTH_SPAN warnings, in code order', () => {
    const r = check(design({ kind: 'tube', outerDiameterM: 0.1, innerDiameterM: 0.096 }))
    expect(r.notApplicable).toEqual([])
    expect(codes(r.warnings)).toEqual(['DEPTH_SPAN', 'TUBE_SLENDERNESS'])
    expect(r.warnings[1].value).toBeCloseTo(50, 9)
    expect(r.warnings[1].threshold).toBe(40)
    expect(r.warnings[1].message).toContain('local shell buckling')
  })

  it('section-specific metrics are only evaluated for their section kind', () => {
    // Circle with the same thin-walled-looking size never reports tube/I/rect metrics.
    const r = check(design({ kind: 'circle', diameterM: 0.1 }))
    const all = codes([...r.warnings, ...r.notApplicable])
    for (const c of ['TUBE_SLENDERNESS', 'FLANGE_OUTSTAND', 'WEB_SLENDERNESS', 'RECT_ASPECT']) {
      expect(all).not.toContain(c)
    }
  })

  it('does not mutate its inputs', () => {
    const d = deepFreeze(design(iSection(0.09)))
    const a = deepFreeze(base(d))
    const snapshot = structuredClone(d)
    expect(() => checkApplicability(d, a, ch)).not.toThrow()
    expect(d).toEqual(snapshot)
  })
})
