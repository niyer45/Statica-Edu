import { describe, expect, it } from 'vitest'
import { fatigueChallenge, gridValues, spindle } from '../../../test/fixtures/fatigue'
import type { FatigueChallenge } from '../../challenge/fatigue/types'
import { analyzeFatigue, FatigueInvariantError } from './analyze'
import { FATIGUE_ASSUMPTIONS, FATIGUE_UNSUPPORTED_EFFECTS, SURFACE_FINISHES } from './constants'
import { basquinConstants, cyclesAtStress, fatigueStrengthAt, goodmanSafetyFactor, sizeFactor, shoulderFilletKt } from './formulas'

const ch = fatigueChallenge()

describe('analyzeFatigue', () => {
  it('lists the assumptions and unsupported effects on every analysis, including corrosion and temperature', () => {
    const a = analyzeFatigue(ch.initialDesign, ch)
    expect(a.assumptions).toBe(FATIGUE_ASSUMPTIONS)
    expect(a.unsupportedEffects).toBe(FATIGUE_UNSUPPORTED_EFFECTS)
    expect(a.unsupportedEffects.join(' ')).toMatch(/corrosion/)
    expect(a.unsupportedEffects.join(' ')).toMatch(/temperature/)
  })

  it('throws a typed invariant error for a fillet larger than the step (validation bypassed)', () => {
    const bad = spindle('bad', 0.03, 0.034, 0.003, 'machined')
    expect(() => analyzeFatigue(bad, ch)).toThrow(FatigueInvariantError)
    try {
      analyzeFatigue(bad, ch)
    } catch (e) {
      expect((e as FatigueInvariantError).name).toBe('FatigueInvariantError')
      expect((e as Error).message).toContain('shoulderFaceM')
    }
  })

  it('reports a low-cycle regime without life fields when the mean stress reaches the ultimate strength', () => {
    const heavy: FatigueChallenge = { ...ch, load: { ...ch.load, meanForceN: 1e5 } }
    const a = analyzeFatigue(ch.initialDesign, heavy)
    expect(a.lifeRegime).toBe('lowCycle')
    expect('equivalentReversedStressPa' in a).toBe(false)
    expect('predictedLifeCycles' in a).toBe(false)
    expect(a.applicable).toBe(false)
  })

  it('LOW_CYCLE fires on its own for a high-yield variant under nearly reversed load (defense in depth)', () => {
    const d = spindle('lc', 0.02, 0.03, 0.0005, 'machined')
    let found = false
    for (let f = 3000; f <= 6000 && !found; f += 25) {
      const variant: FatigueChallenge = { ...ch, material: { ...ch.material, yieldStrengthPa: 625e6 }, load: { meanForceN: 1, alternatingForceN: f, armM: 0.05 } }
      const a = analyzeFatigue(d, variant)
      const codes = a.notApplicableReasons.map((i) => i.code)
      if (codes.includes('LOW_CYCLE') && !codes.includes('LOCAL_YIELD')) {
        found = true
        expect(a.lifeRegime).toBe('lowCycle')
        expect('predictedLifeCycles' in a).toBe(false)
        expect(a.notApplicableReasons[0]!.message).toMatch(/low-cycle/)
      }
    }
    expect(found).toBe(true)
  })

  it('with the bundled material, LOCAL_YIELD always fires before LOW_CYCLE', () => {
    for (const d of gridValues(ch.designLimits.neckDiameterM).filter((_, i) => i % 4 === 0)) {
      const a = analyzeFatigue(spindle('g', d, Math.min(0.06, 3 * d), 0.0005, 'asForged'), ch)
      const codes = a.notApplicableReasons.map((i) => i.code)
      if (codes.includes('LOW_CYCLE')) expect(codes).toContain('LOCAL_YIELD')
    }
  })
})

describe('trends on the configured grid', () => {
  const r = gridValues(ch.designLimits.filletRadiusM)
  it('Kt falls and q rises as the fillet grows', () => {
    const series = r.filter((x) => x < 0.0105 - 1e-9).map((x) => analyzeFatigue(spindle('t', 0.022, 0.045, x, 'machined'), ch))
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!.stressConcentrationKt).toBeLessThan(series[i - 1]!.stressConcentrationKt)
      expect(series[i]!.notchSensitivityQ).toBeGreaterThan(series[i - 1]!.notchSensitivityQ)
      expect(series[i]!.fatigueSafetyFactor).toBeGreaterThan(series[i - 1]!.fatigueSafetyFactor)
    }
  })

  it('ground > machined > as-forged for the surface factor and the fatigue safety factor', () => {
    const [g, m, f] = (['ground', 'machined', 'asForged'] as const).map((s) => analyzeFatigue(spindle('s', 0.0245, 0.034, 0.002, s), ch))
    expect(g!.surfaceFactorKa).toBeGreaterThan(m!.surfaceFactorKa)
    expect(m!.surfaceFactorKa).toBeGreaterThan(f!.surfaceFactorKa)
    expect(g!.fatigueSafetyFactor).toBeGreaterThan(m!.fatigueSafetyFactor)
    expect(m!.fatigueSafetyFactor).toBeGreaterThan(f!.fatigueSafetyFactor)
    expect(Object.keys(SURFACE_FINISHES)).toEqual(['ground', 'machined', 'asForged'])
  })

  it('a thicker neck lowers the stresses and raises the mass at a fixed collar and fillet', () => {
    const series = gridValues(ch.designLimits.neckDiameterM).filter((d) => d <= 0.04 && (0.06 - d) / 2 > 0.002).map((d) => analyzeFatigue(spindle('n', d, 0.06, 0.002, 'machined'), ch))
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!.nominalAlternatingStressPa).toBeLessThan(series[i - 1]!.nominalAlternatingStressPa)
      expect(series[i]!.massKg).toBeGreaterThan(series[i - 1]!.massKg)
      expect(series[i]!.sizeFactorKb).toBeLessThan(series[i - 1]!.sizeFactorKb)
    }
  })
})

describe('formulas', () => {
  it('Kt switches coefficient sets at h/r = 2 with a small jump inside the configured shoulders', () => {
    let worst = 0
    for (let i = 1; i <= 667; i++) {
      const x = i / 1000
      const h = x / 2
      const lo = shoulderFilletKt(1, 1 - 2 * h, h / 2)
      const hi = shoulderFilletKt(1, 1 - 2 * h, h / (2 * (1 + 1e-12)))
      worst = Math.max(worst, Math.abs(hi - lo) / lo)
    }
    // Script: 0.0118568886605593 at 2h/D = 0.667.
    expect(worst).toBeGreaterThan(0.0118)
    expect(worst).toBeLessThan(0.0119)
  })

  it('the Basquin line passes through (10³, f Sut) and (10⁶, Se) and inverts exactly', () => {
    const { coefficientPa: a, exponent: b } = basquinConstants(540e6, 200e6)
    expect(fatigueStrengthAt(a, b, 1e3) / 540e6).toBeCloseTo(1, 12)
    expect(fatigueStrengthAt(a, b, 1e6) / 200e6).toBeCloseTo(1, 12)
    expect(cyclesAtStress(a, b, fatigueStrengthAt(a, b, 31_623)) / 31_623).toBeCloseTo(1, 10)
  })

  it('the Goodman factor with the strength at the predicted life is one', () => {
    const a = analyzeFatigue(ch.initialDesign, ch)
    const sAtLife = fatigueStrengthAt(a.basquinCoefficientPa, a.basquinExponent, a.predictedLifeCycles!)
    expect(sAtLife / a.equivalentReversedStressPa!).toBeCloseTo(1, 10)
    expect(goodmanSafetyFactor(a.alternatingStressPa, a.meanStressPa, sAtLife, ch.material.ultimateStrengthPa)).toBeCloseTo(1, 10)
  })

  it('the size factor switches formula above a 51 mm equivalent diameter', () => {
    expect(sizeFactor(0.051)).toBeCloseTo(1.24 * 51 ** -0.107, 12)
    expect(sizeFactor(0.06)).toBeCloseTo(1.51 * 60 ** -0.157, 12)
  })
})
