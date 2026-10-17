import { describe, expect, it } from 'vitest'
import { isolator, vibrationChallenge, worksheetFixture } from '../../../test/fixtures/vibration'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import type { VibrationChallenge } from '../../challenge/vibration/types'
import { REL_TOL, withinLimit } from '../tolerance'
import { analyzeIsolator } from './analyze'
import { checkVibrationApplicability, vibrationApplicabilityMetrics } from './applicability'
import { VIBRATION_APPLICABILITY_CODES, VIBRATION_THRESHOLDS } from './constants'

// Vibration applicability screens (task 50.2; VIB-10, VIB-13 boundaries). Inclusive safe side: a
// metric equal to a threshold (within REL_TOL) produces no issue; the first double past the
// tolerance edge does.

const ch = vibrationChallenge()
const codes = (r: ReturnType<typeof checkVibrationApplicability>) => ({
  warnings: r.warnings.map((i) => i.code),
  notApplicable: r.notApplicable.map((i) => i.code),
})
const none = { warnings: [], notApplicable: [] }

describe('SPRING_STROKE ((δ_st + Z_peak)/stroke, warning 0.8, not applicable 1.0)', () => {
  const at = (strokeRatio: number) => codes(checkVibrationApplicability({ strokeRatio, dampingRatio: 0.1 }))

  it('raises nothing at or below 0.8, including the tolerance edge', () => {
    expect(at(0.34)).toEqual(none)
    expect(at(0.8)).toEqual(none)
    const edge = toleranceEdge(0.8, REL_TOL)
    expect(withinLimit(edge, 0.8)).toBe(true)
    expect(at(edge)).toEqual(none)
    expect(at(nextUp(edge))).toEqual({ warnings: ['SPRING_STROKE'], notApplicable: [] })
  })

  it('warns up to and including 1.0, then is not applicable', () => {
    expect(at(1.0)).toEqual({ warnings: ['SPRING_STROKE'], notApplicable: [] })
    expect(at(toleranceEdge(1.0, REL_TOL))).toEqual({ warnings: ['SPRING_STROKE'], notApplicable: [] })
    expect(at(nextUp(toleranceEdge(1.0, REL_TOL)))).toEqual({ warnings: [], notApplicable: ['SPRING_STROKE'] })
  })

  it('is inclusive through analyzeIsolator with a configured stroke', () => {
    const d = worksheetFixture('reference').design
    const ratio = analyzeIsolator(d, ch).strokeRatio
    const stroke = ch.mount.linearStrokeM
    const withStroke = (s: number): VibrationChallenge => ({ ...ch, mount: { linearStrokeM: s } })
    const run = (s: number) => {
      const a = analyzeIsolator(d, withStroke(s))
      return { applicable: a.applicable, ...codes({ warnings: [...a.warnings], notApplicable: [...a.notApplicableReasons] }) }
    }
    // A stroke that puts the ratio exactly on 0.8 / 1.0 raises nothing / only the warning.
    expect(run((stroke * ratio) / 0.8)).toEqual({ applicable: true, warnings: [], notApplicable: [] })
    expect(run((stroke * ratio) / 0.8 / (1 + 4 * REL_TOL))).toEqual({ applicable: true, warnings: ['SPRING_STROKE'], notApplicable: [] })
    expect(run(stroke * ratio)).toEqual({ applicable: true, warnings: ['SPRING_STROKE'], notApplicable: [] })
    expect(run((stroke * ratio) / (1 + 4 * REL_TOL))).toEqual({ applicable: false, warnings: [], notApplicable: ['SPRING_STROKE'] })
  })

  it('writes student-facing messages naming the effect and threshold', () => {
    const [w] = checkVibrationApplicability({ strokeRatio: 0.92584564076296, dampingRatio: 0.1 }).warnings
    expect(w).toEqual({
      code: 'SPRING_STROKE',
      message:
        'Static sag plus peak vibration travel, divided by the mount stroke, is 0.926, above the caution level of 0.8. ' +
        'The model does not include mount bottoming and nonlinear spring behavior beyond the linear stroke, so treat these results with caution.',
      value: 0.92584564076296,
      threshold: 0.8,
    })
    const [n] = checkVibrationApplicability({ strokeRatio: 1.475881265005, dampingRatio: 0.02 }).notApplicable
    expect(n.message).toBe(
      'Static sag plus peak vibration travel, divided by the mount stroke, is 1.48, above the model limit of 1. ' +
        'The model does not include mount bottoming and nonlinear spring behavior beyond the linear stroke, so its results cannot be trusted for this design.',
    )
  })

  it('within the configured range, warns or refuses only designs that already fail the sag limit', () => {
    for (const name of ['softWarning', 'tooSoftLight', 'tooSoftHeavy']) {
      const a = analyzeIsolator(worksheetFixture(name).design, ch)
      expect(a.staticDeflectionM).toBeGreaterThan(ch.constraints.maxStaticDeflectionM)
    }
  })
})

describe('DAMPING_RATIO (ζ, warning 0.35, not applicable 0.5)', () => {
  const at = (dampingRatio: number) => codes(checkVibrationApplicability({ strokeRatio: 0.3, dampingRatio }))

  it('is inclusive at 0.35 and 0.5 and triggers one double past the tolerance edge', () => {
    expect(at(0.3)).toEqual(none)
    expect(at(0.35)).toEqual(none)
    expect(at(toleranceEdge(0.35, REL_TOL))).toEqual(none)
    expect(at(nextUp(toleranceEdge(0.35, REL_TOL)))).toEqual({ warnings: ['DAMPING_RATIO'], notApplicable: [] })
    expect(at(0.5)).toEqual({ warnings: ['DAMPING_RATIO'], notApplicable: [] })
    expect(at(toleranceEdge(0.5, REL_TOL))).toEqual({ warnings: ['DAMPING_RATIO'], notApplicable: [] })
    expect(at(nextUp(toleranceEdge(0.5, REL_TOL)))).toEqual({ warnings: [], notApplicable: ['DAMPING_RATIO'] })
  })

  it('never fires for the configured materials (defense in depth)', () => {
    for (const m of ch.materials) {
      const a = analyzeIsolator({ id: 'm', stiffnessNPerM: 85000, materialId: m.id }, ch)
      expect(a.warnings.concat(a.notApplicableReasons).map((i) => i.code)).not.toContain('DAMPING_RATIO')
    }
  })

  it('names the hysteretic damping of real elastomers', () => {
    const [w] = checkVibrationApplicability({ strokeRatio: 0.3, dampingRatio: 0.4 }).warnings
    expect(w.message).toBe(
      'The damping ratio is 0.4, above the caution level of 0.35. ' +
        'The model does not include the hysteretic damping of real elastomers, so treat these results with caution.',
    )
  })
})

describe('issue ordering', () => {
  it('follows VIBRATION_APPLICABILITY_CODES and lists each code at most once', () => {
    const r = checkVibrationApplicability({ strokeRatio: 2, dampingRatio: 0.9 })
    expect(r.notApplicable.map((i) => i.code)).toEqual([...VIBRATION_APPLICABILITY_CODES])
    expect(r.warnings).toEqual([])
    expect(r.notApplicable.map((i) => i.threshold)).toEqual(VIBRATION_APPLICABILITY_CODES.map((c) => VIBRATION_THRESHOLDS[c].notApplicable))
    expect(vibrationApplicabilityMetrics({ strokeRatio: 0.5, dampingRatio: 0.1 })).toEqual({ SPRING_STROKE: 0.5, DAMPING_RATIO: 0.1 })
  })

  it('a warned design stays applicable', () => {
    const a = analyzeIsolator(isolator('w', 28000, 0.1), ch)
    expect(a.warnings.map((i) => i.code)).toEqual(['SPRING_STROKE'])
    expect(a.applicable).toBe(true)
  })
})
