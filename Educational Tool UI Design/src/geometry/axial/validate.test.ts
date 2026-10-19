import { describe, expect, it } from 'vitest'
import { axialChallenge, rod } from '../../../test/fixtures/axial'
import type { AxialDesign } from './design'
import { AXIAL_ERROR_CODES, validateAxialDesign } from './validate'
import { applyAxialEdit, clampDiameter } from './edit'

// Hanger-rod validation and edits (task 72; SSR-04, SSR-13, MM-09).

const ch = axialChallenge()
const codes = (d: unknown) => validateAxialDesign(d as AxialDesign, ch).map((e) => `${e.code}:${e.param}`)

describe('validateAxialDesign', () => {
  it('accepts the range edges and every listed material', () => {
    for (const m of ch.materials) {
      expect(codes(rod('a', ch.diameterLimits.minM, m.id))).toEqual([])
      expect(codes(rod('b', ch.diameterLimits.maxM, m.id))).toEqual([])
    }
  })

  it('reports exactly one diameter error, in the shared order', () => {
    expect(codes(rod('x', Number.NaN, 'steel'))).toEqual(['NON_FINITE:diameterM'])
    expect(codes({ id: 'x', materialId: 'steel' })).toEqual(['NON_FINITE:diameterM'])
    expect(codes(rod('x', 0, 'steel'))).toEqual(['NON_POSITIVE:diameterM'])
    expect(codes(rod('x', -0.01, 'steel'))).toEqual(['NON_POSITIVE:diameterM'])
    expect(codes(rod('x', 0.0059, 'steel'))).toEqual(['BELOW_MIN:diameterM'])
    expect(codes(rod('x', 0.0301, 'steel'))).toEqual(['ABOVE_MAX:diameterM'])
    expect(validateAxialDesign(rod('x', 0.0301, 'steel'), ch)[0]!.message).toBe('Diameter must be at most 30 mm (got 30.1 mm).')
  })

  it('rejects an unlisted or non-string material', () => {
    expect(codes(rod('x', 0.013, 'cork'))).toEqual(['MATERIAL_NOT_ALLOWED:materialId'])
    expect(codes({ id: 'x', diameterM: 0.013, materialId: 7 })).toEqual(['MATERIAL_NOT_ALLOWED:materialId'])
    expect(codes(rod('x', Number.POSITIVE_INFINITY, 'cork'))).toEqual(['NON_FINITE:diameterM', 'MATERIAL_NOT_ALLOWED:materialId'])
  })

  it('rejects a design object that changes a locked field, and ignores one that repeats it', () => {
    expect(codes({ ...rod('x', 0.013, 'steel'), lengthM: 1, forceN: 1, designFactor: 1, support: 'fixed' })).toEqual([
      'LOCKED_FIELD_CHANGED:lengthM',
      'LOCKED_FIELD_CHANGED:forceN',
      'LOCKED_FIELD_CHANGED:designFactor',
      'LOCKED_FIELD_CHANGED:support',
    ])
    expect(codes({ ...rod('x', 0.013, 'steel'), lengthM: ch.lengthM, support: ch.support })).toEqual([])
  })

  it('is total over non-object input and lists every code it can produce', () => {
    expect(codes(null)).toEqual(['NON_FINITE:diameterM', 'MATERIAL_NOT_ALLOWED:materialId'])
    const seen = new Set(validateAxialDesign({ ...rod('x', 0, 'cork'), lengthM: 3 } as AxialDesign, ch).map((e) => e.code))
    for (const c of seen) expect(AXIAL_ERROR_CODES).toContain(c)
  })
})

describe('applyAxialEdit', () => {
  const base = ch.initialDesign

  it('clamps the diameter into range, keeps the material, and returns a new design', () => {
    const r = applyAxialEdit(base, { type: 'setDiameter', valueM: 1, mode: 'clamp' }, ch)
    expect(r).toEqual({ ok: true, value: { id: 'baseline', diameterM: 0.03, materialId: 'steel' } })
    if (r.ok) expect(r.value).not.toBe(base)
    expect(applyAxialEdit(base, { type: 'setDiameter', valueM: -1, mode: 'clamp' }, ch)).toMatchObject({ ok: true, value: { diameterM: 0.006 } })
    expect(applyAxialEdit(base, { type: 'setDiameter', valueM: Number.NaN, mode: 'clamp' }, ch)).toMatchObject({ ok: true, value: { diameterM: 0.013 } })
    expect(clampDiameter(0.01, -0, { minM: -1, maxM: 1 })).toBe(0)
    expect(Object.is(clampDiameter(0.01, -0, { minM: -1, maxM: 1 }), -0)).toBe(false)
  })

  it('strict mode replaces the diameter only when it validates', () => {
    expect(applyAxialEdit(base, { type: 'setDiameter', valueM: 0.0205, mode: 'strict' }, ch)).toMatchObject({ ok: true, value: { diameterM: 0.0205 } })
    const bad = applyAxialEdit(base, { type: 'setDiameter', valueM: 0.031, mode: 'strict' }, ch)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error.map((e) => e.code)).toEqual(['ABOVE_MAX'])
  })

  it('changes the material to a listed one and refuses an unlisted one', () => {
    expect(applyAxialEdit(base, { type: 'setMaterial', materialId: 'titanium' }, ch)).toEqual({ ok: true, value: { id: 'baseline', diameterM: 0.013, materialId: 'titanium' } })
    const bad = applyAxialEdit(base, { type: 'setMaterial', materialId: 'wood' }, ch)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error.map((e) => e.code)).toEqual(['MATERIAL_NOT_ALLOWED'])
    expect(base).toEqual({ id: 'baseline', diameterM: 0.013, materialId: 'steel' })
  })
})
