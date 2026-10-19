// Feature: stress-strain-1, Property 2: Clamp edits always produce a valid rod and never mutate the draft
// **Validates: SSR-04, MM-09**
//
// From any valid design, a clamp-mode diameter edit with any finite value, or a change to any listed
// material, yields a valid new design that differs from the draft only in that parameter; the
// input draft is never mutated.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbAxialDesign, axialChallenge } from '../../../test/fixtures/axial'
import { assertProperty } from '../../../test/pbt'
import { applyAxialEdit } from './edit'
import { validateAxialDesign } from './validate'

const ch = axialChallenge()

describe('Property 2: rod edits', () => {
  it('clamp diameter edits and material changes stay valid', () => {
    const value = fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true })
    const material = fc.constantFrom(...ch.materials.map((m) => m.id))
    assertProperty(fc.property(arbAxialDesign(ch), value, material, (d, v, m) => {
      const before = JSON.stringify(d)
      const a = applyAxialEdit(d, { type: 'setDiameter', valueM: v, mode: 'clamp' }, ch)
      if (!a.ok) throw new Error('clamp edit failed')
      expect(validateAxialDesign(a.value, ch)).toEqual([])
      expect(a.value.materialId).toBe(d.materialId)
      expect(a.value.diameterM).toBe(Math.min(ch.diameterLimits.maxM, Math.max(ch.diameterLimits.minM, v)) + 0)
      const b = applyAxialEdit(d, { type: 'setMaterial', materialId: m }, ch)
      if (!b.ok) throw new Error('material edit failed')
      expect(b.value).toEqual({ ...d, materialId: m })
      expect(JSON.stringify(d)).toBe(before)
    }))
  })
})
