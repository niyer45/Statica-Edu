import { describe, expect, it } from 'vitest'
import { evaluateVessel } from '../../src/evaluation/vessel/evaluate'
import { analyzeVessel } from '../../src/physics/vessel/analyze'
import { vesselApplicabilityMetrics } from '../../src/physics/vessel/applicability'
import { relClose, vessel, vesselChallenge, vesselFixture, VESSEL_DERIVED, VESSEL_WORKSHEET } from './vessel'

// Pressure Vessel I worksheet benchmarks (task 69; PVS-13). Every row of the independent
// worksheet (.kiro/specs/pressure-vessel-1/worksheet.py, design.md) at 1e-9 relative, its status,
// failures and screens, plus the alternative-method and limiting checks of design.md, which are
// computed here by routes independent of the model's closed forms.

const ch = vesselChallenge()

describe('Pressure Vessel I worksheet rows', () => {
  it.each(VESSEL_WORKSHEET.map((f) => [f.name, f] as const))('%s matches the standalone worksheet', (_name, f) => {
    const a = analyzeVessel(f.design, ch)
    const e = evaluateVessel(f.design, a, ch)
    const x = f.expected
    const close: [string, number, number][] = [
      ['hoopStressPa', a.hoopStressPa, x.hoopStressPa],
      ['longitudinalStressPa', a.longitudinalStressPa, x.longitudinalStressPa],
      ['headStressPa', a.headStressPa, x.headStressPa],
      ['volumeM3', a.volumeM3, x.volumeM3],
      ['overallLengthM', a.overallLengthM, x.overallLengthM],
      ['shellMassKg', a.shellMassKg, x.shellMassKg],
      ['headsMassKg', a.headsMassKg, x.headsMassKg],
      ['massKg', a.massKg, x.massKg],
    ]
    for (const [k, actual, expected] of close) expect(relClose(actual, expected), `${k}: ${actual} vs ${expected}`).toBe(true)
    const m = vesselApplicabilityMetrics(f.design, a, ch)
    expect(relClose(m.PLASTICITY, x.plasticityRatio)).toBe(true)
    expect(relClose(m.THIN_WALL_SHELL, x.shellWallRatio)).toBe(true)
    expect(relClose(m.THIN_WALL_HEAD, x.headWallRatio)).toBe(true)
    expect(e.status).toBe(x.status)
    expect(e.failures).toEqual(x.failures)
    expect(a.warnings.map((w) => w.code)).toEqual(x.warningCodes)
    expect(a.notApplicableReasons.map((w) => w.code)).toEqual(x.notApplicableCodes)
  })

  it('the bundled baseline and reference are the worksheet rows', () => {
    const { id: _b, ...baseline } = ch.initialDesign
    const { id: _r, ...reference } = ch.referenceDesign!
    void _b
    void _r
    const { id: _fb, ...fb } = vesselFixture('baseline').design
    const { id: _fr, ...fr } = vesselFixture('reference').design
    void _fb
    void _fr
    expect(baseline).toEqual(fb)
    expect(reference).toEqual(fr)
  })

  it('prediction fixture: baseline → reference hoop stress ratio', () => {
    const b = analyzeVessel(ch.initialDesign, ch)
    const r = analyzeVessel(ch.referenceDesign!, ch)
    expect(relClose(r.hoopStressPa / b.hoopStressPa, VESSEL_DERIVED.baselineToReferenceHoopRatio)).toBe(true)
  })
})

/** Composite Simpson integration of f over [a, b] with n (even) panels (test code only). */
function simpson(f: (x: number) => number, a: number, b: number, n = 2000): number {
  const h = (b - a) / n
  let s = f(a) + f(b)
  for (let i = 1; i < n; i++) s += (i % 2 === 1 ? 4 : 2) * f(a + i * h)
  return (s * h) / 3
}

describe('alternative methods and limiting cases (design.md)', () => {
  it('volume and wall material by numerical integration of the solid of revolution agree with the closed forms', () => {
    for (const f of VESSEL_WORKSHEET) {
      const { innerDiameterM: D, shellLengthM: L, shellThicknessM: ts, headThicknessM: th } = f.design
      const r = D / 2
      // Disk method along the axis: a cylinder of radius r, plus two hemispheres of radius r.
      const capArea = (x: number) => Math.PI * Math.max(0, r * r - x * x)
      const volume = Math.PI * r * r * L + 2 * simpson(capArea, 0, r)
      // Wall material: shells of revolution (outer minus inner) along the axis.
      const shell = simpson(() => Math.PI * ((r + ts) ** 2 - r * r), 0, L)
      const heads = 2 * (simpson((x) => Math.PI * Math.max(0, (r + th) ** 2 - x * x), 0, r + th) - simpson(capArea, 0, r))
      const a = analyzeVessel(f.design, ch)
      expect(relClose(a.volumeM3, volume, 1e-12)).toBe(true)
      expect(relClose(a.shellMassKg, ch.material.densityKgM3 * shell, 1e-12)).toBe(true)
      expect(relClose(a.headsMassKg, ch.material.densityKgM3 * heads, 1e-9)).toBe(true)
    }
  })

  it('the thin-wall hoop stress stays within the screens of the thick-wall (Lamé) cylinder', () => {
    for (const { k, ratio } of VESSEL_DERIVED.lameCylinder) {
      const r = 0.2
      const t = k * r
      const d = vessel('lame', 2 * r, 0.5, t, 0.004)
      const ro = r + t
      const lame = (ch.pressurePa * (ro * ro + r * r)) / (ro * ro - r * r)
      expect(relClose(lame / analyzeVessel(d, ch).hoopStressPa, ratio, 1e-12)).toBe(true)
    }
    // About t/(2r): 2.6 % at the warning level, 5.2 % at the not-applicable level.
    expect(VESSEL_DERIVED.lameCylinder[2]!.ratio - 1).toBeLessThan(0.026)
    expect(VESSEL_DERIVED.lameCylinder[3]!.ratio - 1).toBeLessThan(0.053)
  })

  it('the thin-wall head stress is closer still to the thick-wall (Lamé) sphere', () => {
    for (const { k, ratio } of VESSEL_DERIVED.lameSphere) {
      const r = 0.2
      const t = k * r
      const d = vessel('lame', 2 * r, 0.5, 0.008, t)
      const ro = r + t
      const lame = (ch.pressurePa * (ro ** 3 + 2 * r ** 3)) / (2 * (ro ** 3 - r ** 3))
      expect(relClose(lame / analyzeVessel(d, ch).headStressPa, ratio, 1e-12)).toBe(true)
    }
  })

  it('exact axial equilibrium on the annulus is below the thin-wall longitudinal stress by 1 + t/(2r)', () => {
    for (const { name, exactPa, thinOverExact } of VESSEL_DERIVED.exactAxial) {
      const d = vesselFixture(name).design
      const r = d.innerDiameterM / 2
      const exact = (ch.pressurePa * r * r) / ((r + d.shellThicknessM) ** 2 - r * r)
      expect(relClose(exact, exactPa)).toBe(true)
      const a = analyzeVessel(d, ch)
      expect(relClose(a.longitudinalStressPa / exact, thinOverExact)).toBe(true)
      expect(relClose(thinOverExact, 1 + d.shellThicknessM / (2 * r), 1e-12)).toBe(true)
    }
  })

  it('identities: hoop is twice longitudinal; equal walls give head = longitudinal; half walls give head = hoop', () => {
    for (const f of VESSEL_WORKSHEET) {
      const a = analyzeVessel(f.design, ch)
      expect(relClose(a.hoopStressPa, 2 * a.longitudinalStressPa, 1e-15)).toBe(true)
    }
    const equal = analyzeVessel(vessel('e', 0.4, 0.5, 0.006, 0.006), ch)
    expect(relClose(equal.headStressPa, equal.longitudinalStressPa, 1e-15)).toBe(true)
    const half = analyzeVessel(vessel('h', 0.4, 0.5, 0.006, 0.003), ch)
    expect(relClose(half.headStressPa, half.hoopStressPa, 1e-15)).toBe(true)
  })

  it('a check exactly at its limit passes and one step beyond fails (configured limits)', () => {
    const d = vesselFixture('reference').design
    const a = analyzeVessel(d, ch)
    const at = { ...ch, constraints: { minVolumeM3: a.volumeM3, maxOverallLengthM: a.overallLengthM, maxMassKg: a.massKg } }
    expect(evaluateVessel(d, a, at).status).toBe('accepted')
    const beyond = { ...ch, constraints: { minVolumeM3: a.volumeM3 * (1 + 1e-6), maxOverallLengthM: a.overallLengthM * (1 - 1e-6), maxMassKg: a.massKg * (1 - 1e-6) } }
    expect(evaluateVessel(d, a, beyond).failures).toEqual(['volume', 'overallLength', 'mass'])
    const stress = { ...ch, material: { ...ch.material, yieldStressPa: a.hoopStressPa * ch.designFactor * (1 - 1e-6) } }
    expect(evaluateVessel(d, analyzeVessel(d, stress), stress).failures).toEqual(['hoopStress'])
  })
})
