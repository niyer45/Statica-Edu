import { describe, expect, it } from 'vitest'
import { heatSink, heatSinkChallenge } from '../../../test/fixtures/heatSink'
import { finGap, heatSinkDesignSchema, type FinArray, type HeatSinkDesign } from './design'
import { HEAT_SINK_GEOMETRY_ERROR_CODES, onStep, validateFinArray, validateHeatSinkDesign } from './validate'

// Heat sink geometry validation (task 48.2; HSK-04, HSK-13 invalid-input rejection, MM-09).

const ch = heatSinkChallenge()
const limits = ch.designLimits
const W = ch.base.widthM
const fins = (finCount: unknown, finThicknessM: unknown, finHeightM: unknown) => ({ finCount, finThicknessM, finHeightM }) as unknown as FinArray
const codes = (f: unknown) => validateFinArray(f as FinArray, limits, W).map((e) => `${e.param} ${e.code}`)
const designCodes = (d: unknown) => validateHeatSinkDesign(d as HeatSinkDesign, ch).map((e) => `${e.param} ${e.code}`)

describe('finGap', () => {
  it('is (W − N t)/(N − 1)', () => {
    expect(finGap(0.06, 10, 0.0015)).toBeCloseTo(0.005, 15)
    expect(finGap(0.06, 4, 0.003)).toBeCloseTo(0.016, 15)
    expect(finGap(0.06, 20, 0.003)).toBe(0)
    expect(finGap(0.06, 1, 0.003)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('validateFinArray', () => {
  it('accepts the baseline, reference and range edges', () => {
    for (const f of [fins(4, 0.003, 0.015), fins(10, 0.0015, 0.035), fins(2, 0.005, 0.045), fins(2, 0.001, 0.005), fins(20, 0.002, 0.045)]) {
      expect(codes(f)).toEqual([])
    }
  })

  it('rejects N = 1 (gap undefined) and other fin counts outside 2–20 without dividing by zero', () => {
    expect(codes(fins(1, 0.003, 0.015))).toEqual(['finCount BELOW_MIN'])
    expect(codes(fins(0, 0.003, 0.015))).toEqual(['finCount BELOW_MIN'])
    expect(codes(fins(-3, 0.003, 0.015))).toEqual(['finCount BELOW_MIN'])
    expect(codes(fins(21, 0.001, 0.015))).toEqual(['finCount ABOVE_MAX'])
    // Even if a configuration allowed one fin, N = 1 stays invalid.
    expect(validateFinArray(fins(1, 0.003, 0.015), { ...limits, finCount: { min: 1, max: 20, step: 1 } }, W).map((e) => e.code)).toEqual(['BELOW_MIN'])
  })

  it('rejects non-integer fin counts exactly', () => {
    expect(codes(fins(4.5, 0.003, 0.015))).toEqual(['finCount NOT_INTEGER'])
    expect(codes(fins(4 + 1e-12, 0.003, 0.015))).toEqual(['finCount NOT_INTEGER'])
  })

  it('rejects zero and negative gaps and gaps below 1 mm (HSK-04)', () => {
    // N = 20, t = 3 mm: s = 0 (fins merge).
    expect(codes(fins(20, 0.003, 0.015))).toEqual(['finGapM GAP_TOO_SMALL'])
    // N = 20, t = 2.5 mm: s = 0.526 mm.
    expect(codes(fins(20, 0.0025, 0.015))).toEqual(['finGapM GAP_TOO_SMALL'])
    // N = 15, t = 5 mm: negative gap.
    expect(codes(fins(15, 0.005, 0.015))).toEqual(['finGapM GAP_TOO_SMALL'])
    // N = 20, t = 2 mm: s = 1.05 mm is valid.
    expect(codes(fins(20, 0.002, 0.015))).toEqual([])
  })

  it('accepts a gap exactly at the 1 mm floor within GEOM_TOL', () => {
    // N = 2: s = W − 2t, so t = (W − floor)/2 puts the gap on the floor; widen the range to allow it.
    const wide = { ...limits, finThicknessM: { minM: 0.0295, maxM: 0.0295, stepM: 0.0005 } }
    expect(validateFinArray(fins(2, 0.0295, 0.015), wide, W)).toEqual([])
    expect(validateFinArray(fins(2, 0.0295, 0.015), { ...wide, minGeometricGapM: 0.0010001 }, W).map((e) => e.code)).toEqual(['GAP_TOO_SMALL'])
  })

  it('rejects out-of-range and off-step lengths within GEOM_TOL bounds', () => {
    expect(codes(fins(4, 0.0009, 0.015))).toEqual(['finThicknessM BELOW_MIN'])
    expect(codes(fins(4, 0.0055, 0.015))).toEqual(['finThicknessM ABOVE_MAX'])
    expect(codes(fins(4, 0.003, 0.004))).toEqual(['finHeightM BELOW_MIN'])
    expect(codes(fins(4, 0.003, 0.046))).toEqual(['finHeightM ABOVE_MAX'])
    expect(codes(fins(4, 0.0032, 0.015))).toEqual(['finThicknessM OFF_STEP'])
    expect(codes(fins(4, 0.003, 0.0155))).toEqual(['finHeightM OFF_STEP'])
    expect(codes(fins(4, 0.003 + 5e-10, 0.015 - 5e-10))).toEqual([])
    expect(codes(fins(4, 0.001 - 5e-10, 0.045 + 5e-10))).toEqual([])
  })

  it('still applies the gap rule to out-of-range or off-step finite values', () => {
    expect(codes(fins(21, 0.003, 0.015))).toEqual(['finCount ABOVE_MAX', 'finGapM GAP_TOO_SMALL'])
    expect(codes(fins(20, 0.0032, 0.015))).toEqual(['finThicknessM OFF_STEP', 'finGapM GAP_TOO_SMALL'])
  })

  it('reports exactly one error for non-finite or non-positive values and skips the gap rule', () => {
    expect(codes(fins(Number.NaN, 0.003, 0.015))).toEqual(['finCount NON_FINITE'])
    expect(codes(fins(Number.POSITIVE_INFINITY, 0.003, 0.015))).toEqual(['finCount NON_FINITE'])
    expect(codes(fins(4, Number.NaN, 0.015))).toEqual(['finThicknessM NON_FINITE'])
    expect(codes(fins(4, 0, 0.015))).toEqual(['finThicknessM NON_POSITIVE'])
    expect(codes(fins(4, -0.003, 0.015))).toEqual(['finThicknessM NON_POSITIVE'])
    expect(codes(fins(4, 0.003, Number.NEGATIVE_INFINITY))).toEqual(['finHeightM NON_FINITE'])
    expect(codes(fins(4, 0.003, 0))).toEqual(['finHeightM NON_POSITIVE'])
    expect(codes({ finThicknessM: 0.003, finHeightM: 0.015 })).toEqual(['finCount NON_FINITE'])
    expect(codes(fins('4', 0.003, 0.015))).toEqual(['finCount NON_FINITE'])
    expect(codes(null)).toEqual(['finCount NON_FINITE', 'finThicknessM NON_FINITE', 'finHeightM NON_FINITE'])
  })

  it('writes messages in millimetres and plain counts and names unusual values', () => {
    const msg = (f: FinArray) => validateFinArray(f, limits, W)[0].message
    expect(msg(fins(4, 0.0009, 0.015))).toBe('Fin thickness must be at least 1 mm (got 0.9 mm).')
    expect(msg(fins(1, 0.003, 0.015))).toBe('Fin count must be at least 2 (got 1).')
    expect(msg(fins(21, 0.001, 0.015))).toBe('Fin count must be at most 20 (got 21).')
    expect(msg(fins(4.5, 0.003, 0.015))).toBe('Fin count must be a whole number (got 4.5).')
    expect(msg(fins(4, 0.0032, 0.015))).toBe('Fin thickness must be a multiple of 0.5 mm from 1 mm (got 3.2 mm).')
    expect(msg(fins(4, 0.003, 0.046))).toBe('Fin height must be at most 45 mm (got 46 mm).')
    expect(msg(fins(4, -0, 0.015))).toBe('Fin thickness must be greater than zero (got 0 mm).')
    expect(msg(fins(20, 0.0025, 0.015))).toBe('Fins are too close together: the gap 0.5263 mm must be at least 1 mm. Use fewer or thinner fins.')
    expect(msg(fins(20, 0.003, 0.015))).toBe('Fins overlap: 20 fins of 3 mm do not fit across the 60 mm base. Use fewer or thinner fins.')
    expect(msg(fins(undefined, 0.003, 0.015))).toContain('got missing')
    expect(msg(fins(4, Number.NaN, 0.015))).toContain('got NaN')
    expect(msg(fins(Number.NaN, 0.003, 0.015))).toContain('got NaN')
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(msg(fins(cyclic, 0.003, 0.015))).toContain('got object')
    expect(msg(fins({ n: 4 }, 0.003, 0.015))).toContain('got {"n":4}')
  })

  it('does not mutate its input', () => {
    const f = Object.freeze(fins(20, 0.0025, 0.015))
    expect(() => validateFinArray(f, limits, W)).not.toThrow()
  })
})

describe('onStep', () => {
  it('accepts grid values within GEOM_TOL and rejects others', () => {
    const r = limits.finThicknessM
    expect(onStep(0.0015, r)).toBe(true)
    expect(onStep(0.001 + 3 * 0.0005, r)).toBe(true)
    expect(onStep(0.0015 + 2e-9, r)).toBe(false)
    expect(onStep(0.00175, r)).toBe(false)
  })
})

describe('validateHeatSinkDesign', () => {
  it('accepts the configured initial and reference designs', () => {
    expect(validateHeatSinkDesign(ch.initialDesign, ch)).toEqual([])
    expect(validateHeatSinkDesign(ch.referenceDesign as HeatSinkDesign, ch)).toEqual([])
  })

  it('rejects locked material changes with strict equality', () => {
    const d = heatSink('x', 4, 0.003, 0.015)
    expect(designCodes({ ...d, materialId: 'copper' })).toEqual(['materialId LOCKED_FIELD_CHANGED'])
    expect(validateHeatSinkDesign({ ...d, materialId: 'copper' }, ch)[0].message).toBe(
      'Material is fixed by the challenge and cannot be changed (expected "aluminum-educational", got "copper").',
    )
  })

  it('orders fin errors before locked-field errors', () => {
    expect(designCodes({ ...heatSink('x', 20, 0.003, 0.015), materialId: 'copper' })).toEqual([
      'finGapM GAP_TOO_SMALL',
      'materialId LOCKED_FIELD_CHANGED',
    ])
  })

  it('is total over untrusted values', () => {
    for (const v of [null, undefined, 1, 'design', [], {}]) {
      const errs = validateHeatSinkDesign(v as unknown as HeatSinkDesign, ch)
      expect(errs.map((e) => e.code)).toEqual(['NON_FINITE', 'NON_FINITE', 'NON_FINITE', 'LOCKED_FIELD_CHANGED'])
    }
  })

  it('rejects each HSK-13 invalid-input class before analysis', () => {
    const d = heatSink('x', 4, 0.003, 0.015)
    const invalid: [string, unknown][] = [
      ['N non-integer', { ...d, finCount: 4.5 }],
      ['N = 1', { ...d, finCount: 1 }],
      ['N > 20', { ...d, finCount: 21, finThicknessM: 0.001 }],
      ['t off range', { ...d, finThicknessM: 0.0055 }],
      ['t off step', { ...d, finThicknessM: 0.0031 }],
      ['H off range', { ...d, finHeightM: 0.05 }],
      ['H off step', { ...d, finHeightM: 0.0151 }],
      ['non-finite', { ...d, finHeightM: Number.NaN }],
      ['s = 0', { ...d, finCount: 20, finThicknessM: 0.003 }],
      ['s < 1 mm', { ...d, finCount: 20, finThicknessM: 0.0025 }],
      ['locked material', { ...d, materialId: 'other' }],
    ]
    for (const [name, x] of invalid) expect(designCodes(x).length, name).toBeGreaterThan(0)
  })

  it('every reported code is in the persistence vocabulary', () => {
    const all = [fins(1.5, 0, Number.NaN), fins(21, 0.0032, 0.004), fins(20, 0.003, 0.046)].flatMap((f) => validateFinArray(f, limits, W))
    for (const e of all) expect(HEAT_SINK_GEOMETRY_ERROR_CODES).toContain(e.code)
  })
})

describe('heat sink design schema', () => {
  it('parses valid designs and rejects unknown keys, non-positive lengths and orientation', () => {
    expect(heatSinkDesignSchema.safeParse(ch.initialDesign).success).toBe(true)
    // Integrality is the validator's job, not the structural schema's.
    expect(heatSinkDesignSchema.safeParse({ ...ch.initialDesign, finCount: 4.5 }).success).toBe(true)
    expect(heatSinkDesignSchema.safeParse({ ...ch.initialDesign, finThicknessM: 0 }).success).toBe(false)
    expect(heatSinkDesignSchema.safeParse({ ...ch.initialDesign, orientationDeg: 0 }).success).toBe(false)
    expect(heatSinkDesignSchema.safeParse({ ...ch.initialDesign, finCount: Number.NaN }).success).toBe(false)
  })
})
