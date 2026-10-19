import { describe, expect, it } from 'vitest'
import { fatigueChallenge, spindle } from '../../../test/fixtures/fatigue'
import { analyzeFatigue } from './analyze'
import { checkFatigueApplicability, fatigueApplicabilityMetrics } from './applicability'
import { FATIGUE_APPLICABILITY_CODES, FATIGUE_THRESHOLDS } from './constants'

// Task 70 (FAT-12): screens are inclusive at exactly 1 and fire one step beyond, in fixed order,
// with student-facing messages that name the unmodeled effect.

const ch = fatigueChallenge()
const base = analyzeFatigue(ch.initialDesign, ch)

describe('fatigue applicability', () => {
  it('has three not-applicable-only screens', () => {
    expect(FATIGUE_APPLICABILITY_CODES).toEqual(['KT_FIT_RANGE', 'LOCAL_YIELD', 'LOW_CYCLE'])
    for (const code of FATIGUE_APPLICABILITY_CODES) expect(FATIGUE_THRESHOLDS[code].warning).toBe(FATIGUE_THRESHOLDS[code].notApplicable)
  })

  it('h/r exactly 20 is applicable; just beyond is not', () => {
    const at = spindle('at', 0.02, 0.04, 0.0005, 'machined') // h = 10 mm, h/r = 20
    expect(fatigueApplicabilityMetrics(at, analyzeFatigue(at, ch), ch).KT_FIT_RANGE).toBe(1)
    expect(analyzeFatigue(at, ch).notApplicableReasons.map((i) => i.code)).not.toContain('KT_FIT_RANGE')
    const beyond = spindle('beyond', 0.02, 0.0400001, 0.0005, 'machined')
    const a = analyzeFatigue(beyond, ch)
    expect(a.notApplicableReasons.map((i) => i.code)).toContain('KT_FIT_RANGE')
    expect(a.notApplicableReasons[0]!.message).toMatch(/^The largest fillet-geometry ratio over its fit limit \(h\/r from 0\.1 to 20, r\/d up to 0\.3, D\/d up to 3\) is 1, above the model limit of 1\. The model does not include stress concentrations outside the fitted fillet range/)
  })

  it('LOCAL_YIELD is inclusive at a peak local stress equal to the yield strength', () => {
    const peak = base.alternatingStressPa + base.meanStressPa
    const at = { ...ch, material: { ...ch.material, yieldStrengthPa: peak } }
    expect(checkFatigueApplicability(ch.initialDesign, base, at).notApplicable).toEqual([])
    const below = { ...ch, material: { ...ch.material, yieldStrengthPa: peak * (1 - 1e-6) } }
    expect(checkFatigueApplicability(ch.initialDesign, base, below).notApplicable.map((i) => i.code)).toEqual(['LOCAL_YIELD'])
  })

  it('the r/d and D/d parts of KT_FIT_RANGE are evaluated (beyond the configured ranges)', () => {
    const wide = spindle('wide', 0.02, 0.07, 0.008, 'machined')
    const m = fatigueApplicabilityMetrics(wide, { ...base, shoulderHeightM: 0.025 }, ch)
    expect(m.KT_FIT_RANGE).toBeCloseTo(Math.max(0.025 / 0.008 / 20, 0.4 / 0.3, 3.5 / 3), 12)
  })

  it('the Baseline is applicable with no warnings and the screens keep a margin', () => {
    expect(base.applicable).toBe(true)
    expect(base.warnings).toEqual([])
    const m = fatigueApplicabilityMetrics(ch.initialDesign, base, ch)
    expect(Math.max(...Object.values(m))).toBeLessThan(0.95)
  })
})
