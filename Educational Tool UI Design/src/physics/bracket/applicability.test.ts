import { describe, expect, it } from 'vitest'
import { bracket, bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import type { BracketChallenge } from '../../challenge/bracket/types'
import { REL_TOL } from '../tolerance'
import { analyzeBracket } from './analyze'
import { bracketApplicabilityMetrics, checkBracketApplicability } from './applicability'
import { BRACKET_APPLICABILITY_CODES, BRACKET_THRESHOLDS } from './constants'

// Bracket applicability screens (task 46.2; MBR-14, MBR-17 boundaries). Inclusive safe side: a
// metric equal to a threshold (within REL_TOL) produces no issue; one double past the tolerance
// edge does. Screens with no warning band can only be not applicable.

const ch = bracketChallenge()
type Ctx = Pick<BracketChallenge, 'material' | 'lengthM' | 'thicknessM'>
/** Unit context: σ_y = 1 Pa, so σ_peak/σ_y equals the peak passed in; huge L and b keep other ratios tiny. */
const unit = (over: Partial<Ctx> = {}): Ctx => ({ material: { ...ch.material, yieldStressPa: 1 }, lengthM: 1e9, thicknessM: 1e9, ...over })

const codes = (r: ReturnType<typeof checkBracketApplicability>) => ({
  warnings: r.warnings.map((i) => i.code),
  notApplicable: r.notApplicable.map((i) => i.code),
})
const none = { warnings: [], notApplicable: [] }
const uniformBar = bracket('u', 1, 1, 1, 1)

describe('global screens (uniform bar, no peak: step screens and PLASTICITY skipped)', () => {
  it('DEPTH_SPAN (D/L) warns above 0.1 and is not applicable above 0.2, inclusively', () => {
    const at = (v: number) => codes(checkBracketApplicability(bracket('u', v, v, 1, 1), { tipDeflectionM: 0 }, unit({ lengthM: 1 })))
    expect(at(0.1)).toEqual(none)
    expect(at(toleranceEdge(0.1, REL_TOL))).toEqual(none)
    expect(at(nextUp(toleranceEdge(0.1, REL_TOL)))).toEqual({ warnings: ['DEPTH_SPAN'], notApplicable: [] })
    expect(at(toleranceEdge(0.2, REL_TOL))).toEqual({ warnings: ['DEPTH_SPAN'], notApplicable: [] })
    expect(at(nextUp(toleranceEdge(0.2, REL_TOL)))).toEqual({ warnings: [], notApplicable: ['DEPTH_SPAN'] })
  })

  it('RECT_ASPECT (D/b) warns above 8 and is not applicable above 20', () => {
    const at = (v: number) => codes(checkBracketApplicability(bracket('u', v, v, 1, 1), { tipDeflectionM: 0 }, unit({ thicknessM: 1 })))
    expect(at(8)).toEqual(none)
    expect(at(nextUp(toleranceEdge(8, REL_TOL)))).toEqual({ warnings: ['RECT_ASPECT'], notApplicable: [] })
    expect(at(20)).toEqual({ warnings: ['RECT_ASPECT'], notApplicable: [] })
    expect(at(nextUp(toleranceEdge(20, REL_TOL)))).toEqual({ warnings: [], notApplicable: ['RECT_ASPECT'] })
  })

  it('LARGE_DEFLECTION (δ/L) warns above 0.02 and is not applicable above 0.1', () => {
    const at = (v: number) => codes(checkBracketApplicability(uniformBar, { tipDeflectionM: v }, unit({ lengthM: 1 })))
    // D/L = 1 here would trip DEPTH_SPAN, so use a tiny depth.
    const tiny = (v: number) => codes(checkBracketApplicability(bracket('u', 1e-9, 1e-9, 1, 1), { tipDeflectionM: v }, unit({ lengthM: 1 })))
    expect(at(0).notApplicable).toEqual(['DEPTH_SPAN'])
    expect(tiny(0.02)).toEqual(none)
    expect(tiny(nextUp(toleranceEdge(0.02, REL_TOL)))).toEqual({ warnings: ['LARGE_DEFLECTION'], notApplicable: [] })
    expect(tiny(0.1)).toEqual({ warnings: ['LARGE_DEFLECTION'], notApplicable: [] })
    expect(tiny(nextUp(toleranceEdge(0.1, REL_TOL)))).toEqual({ warnings: [], notApplicable: ['LARGE_DEFLECTION'] })
  })
})

describe('PLASTICITY (σ_peak/σ_y, warning 0.8, not applicable 1.0)', () => {
  const at = (peak: number) => codes(checkBracketApplicability(uniformBar, { tipDeflectionM: 0, peakStressPa: peak }, unit()))

  it('is inclusive at 0.8 and 1.0', () => {
    expect(at(0.8)).toEqual(none)
    expect(at(toleranceEdge(0.8, REL_TOL))).toEqual(none)
    expect(at(nextUp(toleranceEdge(0.8, REL_TOL)))).toEqual({ warnings: ['PLASTICITY'], notApplicable: [] })
    expect(at(1)).toEqual({ warnings: ['PLASTICITY'], notApplicable: [] })
    expect(at(toleranceEdge(1, REL_TOL))).toEqual({ warnings: ['PLASTICITY'], notApplicable: [] })
    expect(at(nextUp(toleranceEdge(1, REL_TOL)))).toEqual({ warnings: [], notApplicable: ['PLASTICITY'] })
  })

  it('is skipped when no peak stress exists', () => {
    expect(bracketApplicabilityMetrics(uniformBar, { tipDeflectionM: 0 }, unit()).PLASTICITY).toBeUndefined()
  })

  it('writes student-facing messages naming the effect and threshold', () => {
    const [w] = checkBracketApplicability(uniformBar, { tipDeflectionM: 0, peakStressPa: 0.815309335167492 }, unit()).warnings
    expect(w).toEqual({
      code: 'PLASTICITY',
      message: 'Peak stress divided by yield stress is 0.815, above the caution level of 0.8. The model does not include plasticity, so treat these results with caution.',
      value: 0.815309335167492,
      threshold: 0.8,
    })
  })
})

describe('step screens', () => {
  it('are skipped for a uniform bar', () => {
    const m = bracketApplicabilityMetrics(bracket('u', 0.03, 0.03, 0.15, 0.001), { tipDeflectionM: 0.001 }, ch)
    expect(Object.keys(m)).toEqual(['DEPTH_SPAN', 'RECT_ASPECT', 'LARGE_DEFLECTION'])
  })

  it('KT_STEP_RATIO (D/d) warns above 1.5 and is not applicable above 1.6, inclusively (K-3)', () => {
    // d = 1, r = 0.05 keeps h/r inside the fit; a huge a keeps the shoulder metric tiny.
    const at = (D: number) => codes(checkBracketApplicability(bracket('s', D, 1, 1e6, 0.05), { tipDeflectionM: 0 }, unit()))
    expect(at(1.5)).toEqual(none)
    expect(at(toleranceEdge(1.5, REL_TOL))).toEqual(none)
    expect(at(nextUp(toleranceEdge(1.5, REL_TOL)))).toEqual({ warnings: ['KT_STEP_RATIO'], notApplicable: [] })
    expect(at(1.6)).toEqual({ warnings: ['KT_STEP_RATIO'], notApplicable: [] })
    expect(at(toleranceEdge(1.6, REL_TOL))).toEqual({ warnings: ['KT_STEP_RATIO'], notApplicable: [] })
    expect(at(nextUp(toleranceEdge(1.6, REL_TOL)))).toEqual({ warnings: [], notApplicable: ['KT_STEP_RATIO'] })
  })

  it('KT_SMALL_STEP (1.1/(D/d)) needs D/d ≥ 1.1 inclusively, with no warning band (K-4)', () => {
    const at = (D: number) => codes(checkBracketApplicability(bracket('s', D, 1, 1e6, 0.02), { tipDeflectionM: 0 }, unit()))
    expect(at(1.1)).toEqual(none)
    expect(at(1.1 * (1 - 0.5 * REL_TOL))).toEqual(none)
    expect(at(1.1 * (1 - 4 * REL_TOL))).toEqual({ warnings: [], notApplicable: ['KT_SMALL_STEP'] })
    expect(at(1.05)).toEqual({ warnings: [], notApplicable: ['KT_SMALL_STEP'] })
    const [n] = checkBracketApplicability(bracket('s', 1.05, 1, 1e6, 0.02), { tipDeflectionM: 0 }, unit()).notApplicable
    expect(n.threshold).toBe(1)
    expect(n.message).toBe(
      'Minimum step ratio divided by root depth over arm depth is 1.05, above the model limit of 1. ' +
        'The model does not include reliable stress concentration for steps this small, so its results cannot be trusted for this design.',
    )
  })

  it('KT_FIT_SHARP (h/r) is not applicable only above 20', () => {
    // d = 1, r = 0.01, D = 1 + 2·h.
    const at = (hr: number) => codes(checkBracketApplicability(bracket('s', 1 + 2 * 0.01 * hr, 1, 1e6, 0.01), { tipDeflectionM: 0 }, unit()))
    expect(at(20).notApplicable).not.toContain('KT_FIT_SHARP')
    expect(at(20 * (1 + 4 * REL_TOL)).notApplicable).toContain('KT_FIT_SHARP')
    expect(at(19).warnings).not.toContain('KT_FIT_SHARP')
  })

  it('KT_FIT_SHALLOW (r/h) is not applicable only above 10', () => {
    // d = 1, h = 0.05 (D = 1.1, so KT_SMALL_STEP stays quiet), r = 10·h.
    const at = (rh: number) => codes(checkBracketApplicability(bracket('s', 1.1, 1, 1e6, 0.05 * rh), { tipDeflectionM: 0 }, unit()))
    expect(at(10)).toEqual(none)
    expect(at(10 * (1 + 4 * REL_TOL))).toEqual({ warnings: [], notApplicable: ['KT_FIT_SHALLOW'] })
  })

  it('KT_SHOULDER_LENGTH is not applicable only above 1 (a stands in for the shoulder length, K-2)', () => {
    // r/d = 0.025 makes the required a/D exactly 2; D = 1.5, d = 1.
    const at = (a: number) => codes(checkBracketApplicability(bracket('s', 1.5, 1, a, 0.025), { tipDeflectionM: 0 }, unit()))
    expect(bracketApplicabilityMetrics(bracket('s', 1.5, 1, 3, 0.025), { tipDeflectionM: 0 }, unit()).KT_SHOULDER_LENGTH).toBe(1)
    expect(at(3)).toEqual(none)
    expect(at(3 * (1 - 4 * REL_TOL))).toEqual({ warnings: [], notApplicable: ['KT_SHOULDER_LENGTH'] })
  })
})

describe('through analyzeBracket', () => {
  it('worksheet boundaries: D/d = 1.5 raises nothing, D/d = 1.6 only warns, D/d = 1.1 passes KT_SMALL_STEP', () => {
    expect(analyzeBracket(worksheetFixture('oversize').design, ch).warnings.map((w) => w.code)).toEqual(['DEPTH_SPAN'])
    expect(analyzeBracket(worksheetFixture('ratioWarning').design, ch).warnings.map((w) => w.code)).toEqual(['KT_STEP_RATIO', 'DEPTH_SPAN'])
    expect(analyzeBracket(worksheetFixture('smallStepBoundary').design, ch).notApplicableReasons).toEqual([])
  })

  it('PLASTICITY is inclusive with a configured yield stress', () => {
    const d = worksheetFixture('reference').design
    const peak = analyzeBracket(d, ch).peakStressPa as number
    const run = (y: number) => {
      const a = analyzeBracket(d, { ...ch, material: { ...ch.material, yieldStressPa: y } })
      return { applicable: a.applicable, warnings: a.warnings.map((w) => w.code), notApplicable: a.notApplicableReasons.map((w) => w.code) }
    }
    expect(run(peak / 0.8)).toEqual({ applicable: true, warnings: [], notApplicable: [] })
    expect(run(peak / 0.8 / (1 + 4 * REL_TOL))).toEqual({ applicable: true, warnings: ['PLASTICITY'], notApplicable: [] })
    expect(run(peak)).toEqual({ applicable: true, warnings: ['PLASTICITY'], notApplicable: [] })
    expect(run(peak / (1 + 4 * REL_TOL))).toEqual({ applicable: false, warnings: [], notApplicable: ['PLASTICITY'] })
  })
})

describe('issue ordering', () => {
  it('follows BRACKET_APPLICABILITY_CODES and lists each code at most once', () => {
    // D/d = 1.05 with r/h = 20: sharp-fit, shallow-fit, shoulder, small-step and global screens all fire.
    const r = checkBracketApplicability(bracket('s', 1.05, 1, 0.1, 0.5), { tipDeflectionM: 1, peakStressPa: 2 }, unit({ lengthM: 1, thicknessM: 0.01 }))
    const all = [...r.notApplicable, ...r.warnings].map((i) => i.code)
    expect(new Set(all).size).toBe(all.length)
    expect(r.notApplicable.map((i) => i.code)).toEqual(BRACKET_APPLICABILITY_CODES.filter((c) => r.notApplicable.some((i) => i.code === c)))
    expect(r.notApplicable.map((i) => i.code)).toEqual(['KT_FIT_SHALLOW', 'KT_SHOULDER_LENGTH', 'KT_SMALL_STEP', 'PLASTICITY', 'DEPTH_SPAN', 'RECT_ASPECT', 'LARGE_DEFLECTION'])
    expect(r.notApplicable.map((i) => i.threshold)).toEqual(r.notApplicable.map((i) => BRACKET_THRESHOLDS[i.code].notApplicable))
  })
})
