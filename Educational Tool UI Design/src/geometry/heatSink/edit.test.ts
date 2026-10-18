import { describe, expect, it } from 'vitest'
import { heatSink, heatSinkChallenge } from '../../../test/fixtures/heatSink'
import type { HeatSinkDesignLimits } from '../../challenge/heatSink/types'
import {
  applyHeatSinkEdit,
  clampHeatSinkParam,
  HEAT_SINK_DESIGN_PARAMS,
  heatSinkPermissibleRange,
  isHeatSinkParam,
  quantizeM,
  trySetHeatSinkParam,
} from './edit'
import { validateHeatSinkDesign } from './validate'

// Heat sink edit operations (task 48.2; HSK-04, HSK-14, MM-09).

const ch = heatSinkChallenge()
const L = ch.designLimits
const W = ch.base.widthM
const base = heatSink('d', 4, 0.003, 0.015)

describe('heatSinkPermissibleRange', () => {
  it('lists the three adjustable parameters', () => {
    expect(HEAT_SINK_DESIGN_PARAMS).toEqual(['finCount', 'finThicknessM', 'finHeightM'])
    expect(isHeatSinkParam('finCount')).toBe(true)
    expect(isHeatSinkParam('materialId')).toBe(false)
  })

  it('caps the fin count where the gap would fall below 1 mm', () => {
    expect(heatSinkPermissibleRange(base, 'finCount', L, W)).toEqual({ min: 2, max: 15 })
    // t = 1 mm fits all 20 fins (s = 2.1 mm); t = 2.5 mm stops at 17 (s = 1.09 mm, 18 gives 0.88 mm).
    expect(heatSinkPermissibleRange(heatSink('d', 4, 0.001, 0.015), 'finCount', L, W)).toEqual({ min: 2, max: 20 })
    expect(heatSinkPermissibleRange(heatSink('d', 4, 0.0025, 0.015), 'finCount', L, W)).toEqual({ min: 2, max: 17 })
  })

  it('caps the thickness at the largest on-step value whose gap stays at least 1 mm', () => {
    expect(heatSinkPermissibleRange(base, 'finThicknessM', L, W)).toEqual({ min: 0.001, max: 0.005 })
    // N = 20: t ≤ (60 − 19)/20 = 2.05 mm → 2 mm.
    expect(heatSinkPermissibleRange(heatSink('d', 20, 0.001, 0.015), 'finThicknessM', L, W)).toEqual({ min: 0.001, max: 0.002 })
    // N = 12: t ≤ (60 − 11)/12 = 4.083 mm → 4 mm.
    expect(heatSinkPermissibleRange(heatSink('d', 12, 0.001, 0.015), 'finThicknessM', L, W)).toEqual({ min: 0.001, max: 0.004 })
  })

  it('uses the configured height range and rejects unknown params', () => {
    expect(heatSinkPermissibleRange(base, 'finHeightM', L, W)).toEqual({ min: 0.005, max: 0.045 })
    expect(heatSinkPermissibleRange(base, 'materialId', L, W)).toBeNull()
  })

  it('collapses degenerate ranges to the current value', () => {
    const bad: HeatSinkDesignLimits = { ...L, finHeightM: { minM: 0.04, maxM: 0.02, stepM: 0.001 } }
    expect(heatSinkPermissibleRange(base, 'finHeightM', bad, W)).toEqual({ min: 0.015, max: 0.015 })
    // A base too narrow for even the thinnest fins leaves no feasible thickness or count.
    expect(heatSinkPermissibleRange(base, 'finThicknessM', L, 0.005)).toEqual({ min: 0.003, max: 0.003 })
    expect(heatSinkPermissibleRange(base, 'finCount', L, 0.005)).toEqual({ min: 4, max: 4 })
  })
})

describe('clampHeatSinkParam', () => {
  it('rounds the fin count and clamps it to the gap-limited range', () => {
    expect(clampHeatSinkParam(base, 'finCount', 9.6, L, W)).toEqual({ ...base, finCount: 10 })
    expect(clampHeatSinkParam(base, 'finCount', 40, L, W)).toEqual({ ...base, finCount: 15 })
    expect(clampHeatSinkParam(base, 'finCount', 1, L, W)).toEqual({ ...base, finCount: 2 })
    expect(clampHeatSinkParam(base, 'finCount', -0.2, L, W)).toEqual({ ...base, finCount: 2 })
  })

  it('snaps lengths to the step grid as exact decimal values and clamps them', () => {
    expect(clampHeatSinkParam(base, 'finThicknessM', 0.00149, L, W)).toEqual({ ...base, finThicknessM: 0.0015 })
    expect(clampHeatSinkParam(base, 'finThicknessM', 0.0016, L, W).finThicknessM).toBe(0.0015)
    expect(clampHeatSinkParam(base, 'finThicknessM', 1, L, W).finThicknessM).toBe(0.005)
    expect(clampHeatSinkParam(base, 'finHeightM', 0.0354, L, W).finHeightM).toBe(0.035)
    expect(clampHeatSinkParam(base, 'finHeightM', 0, L, W).finHeightM).toBe(0.005)
    expect(clampHeatSinkParam(heatSink('d', 20, 0.001, 0.015), 'finThicknessM', 0.004, L, W).finThicknessM).toBe(0.002)
  })

  it('returns the same design for non-finite values or unknown params', () => {
    expect(clampHeatSinkParam(base, 'finCount', Number.NaN, L, W)).toBe(base)
    expect(clampHeatSinkParam(base, 'finHeightM', Number.POSITIVE_INFINITY, L, W)).toBe(base)
    expect(clampHeatSinkParam(base, 'materialId', 1, L, W)).toBe(base)
  })

  it('quantizes to whole nanometres and normalizes −0', () => {
    expect(quantizeM(0.001 + 0.0005)).toBe(0.0015)
    expect(Object.is(quantizeM(-0), 0)).toBe(true)
    expect(Object.is(quantizeM(-1e-12), 0)).toBe(true)
  })
})

describe('trySetHeatSinkParam', () => {
  it('replaces only the parameter and validates the candidate', () => {
    expect(trySetHeatSinkParam(base, 'finCount', 10, L, W)).toEqual({ ok: true, value: { ...base, finCount: 10 } })
    const off = trySetHeatSinkParam(base, 'finThicknessM', 0.0032, L, W)
    expect(!off.ok && off.error.map((e) => e.code)).toEqual(['OFF_STEP'])
    const merged = trySetHeatSinkParam(base, 'finCount', 20, L, W)
    expect(!merged.ok && merged.error.map((e) => e.code)).toEqual(['GAP_TOO_SMALL'])
  })

  it('rejects unknown params with UNKNOWN_PARAM naming them', () => {
    const r = trySetHeatSinkParam(base, 'baseWidthM', 0.07, L, W)
    expect(r).toEqual({
      ok: false,
      error: [{ code: 'UNKNOWN_PARAM', param: 'baseWidthM', message: '"baseWidthM" is not an adjustable heat sink parameter (fin count, fin thickness, fin height).' }],
    })
  })
})

describe('applyHeatSinkEdit', () => {
  const draft = ch.initialDesign

  it('applies strict and clamp edits as new valid designs', () => {
    const strict = applyHeatSinkEdit(draft, { type: 'setParam', param: 'finCount', value: 10, mode: 'strict' }, ch)
    expect(strict.ok && strict.value).toEqual({ ...draft, finCount: 10 })
    expect(strict.ok && strict.value).not.toBe(draft)
    const clamp = applyHeatSinkEdit(draft, { type: 'setParam', param: 'finHeightM', value: 0.1, mode: 'clamp' }, ch)
    expect(clamp.ok && clamp.value.finHeightM).toBe(0.045)
  })

  it('keeps the draft on a rejected strict edit and reports every error', () => {
    const r = applyHeatSinkEdit(draft, { type: 'setParam', param: 'finCount', value: 1, mode: 'strict' }, ch)
    expect(!r.ok && r.error.map((e) => `${e.param} ${e.code}`)).toEqual(['finCount BELOW_MIN'])
    expect(draft.finCount).toBe(3)
  })

  it('a non-finite clamp value returns an equal, fresh design', () => {
    const r = applyHeatSinkEdit(draft, { type: 'setParam', param: 'finCount', value: Number.NaN, mode: 'clamp' }, ch)
    expect(r.ok && r.value).toEqual(draft)
    expect(r.ok && r.value).not.toBe(draft)
  })

  it('rejects unknown params, including the locked material', () => {
    for (const mode of ['clamp', 'strict'] as const) {
      const r = applyHeatSinkEdit(draft, { type: 'setParam', param: 'materialId', value: 1, mode }, ch)
      expect(!r.ok && r.error.map((e) => e.code)).toEqual(['UNKNOWN_PARAM'])
    }
  })

  it('reports a locked-field change on a draft that already broke it', () => {
    const r = applyHeatSinkEdit({ ...draft, materialId: 'copper' }, { type: 'setParam', param: 'finCount', value: 5, mode: 'clamp' }, ch)
    expect(!r.ok && r.error.map((e) => e.code)).toEqual(['LOCKED_FIELD_CHANGED'])
  })

  it('reaches the reference design from the baseline through clamp edits', () => {
    let d = draft
    for (const [param, value] of [['finThicknessM', 0.0015], ['finCount', 10], ['finHeightM', 0.035]] as const) {
      const r = applyHeatSinkEdit(d, { type: 'setParam', param, value, mode: 'clamp' }, ch)
      if (!r.ok) throw new Error(JSON.stringify(r.error))
      d = r.value
    }
    expect(d).toEqual({ ...ch.referenceDesign, id: draft.id })
    expect(validateHeatSinkDesign(d, ch)).toEqual([])
  })
})
