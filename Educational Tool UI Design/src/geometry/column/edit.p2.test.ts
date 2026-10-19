// Feature: column-buckling-1, Property 2: Column edits keep the draft valid
// **Validates: task 68, CBK-05, MM-09**
//
// For any valid design and any edit: a successful edit returns a design that passes the validator
// and differs from the input only in its section; a failed edit returns errors; clamp edits of a
// known parameter with a finite value always succeed and land inside the configured range; inputs
// are never mutated.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbColumnDesign, columnChallenge } from '../../../test/fixtures/column'
import { assertProperty } from '../../../test/pbt'
import type { ColumnEdit } from './edit'
import { applyColumnEdit } from './edit'
import { validateColumnDesign } from './validate'

const ch = columnChallenge()

const arbEdit: fc.Arbitrary<ColumnEdit> = fc.oneof(
  fc.constantFrom('solid', 'tube').map((kind) => ({ type: 'setSection', kind }) as ColumnEdit),
  fc
    .tuple(fc.constantFrom('diameterM', 'outerDiameterM', 'wallThicknessM', 'other'), fc.double({ min: -0.1, max: 0.2, noNaN: true }), fc.constantFrom('clamp', 'strict'))
    .map(([param, valueM, mode]) => ({ type: 'setParam', param, valueM, mode }) as ColumnEdit),
)

describe('Property 2: column edits', () => {
  it('keep the draft valid or report errors', () => {
    assertProperty(
      fc.property(arbColumnDesign(ch), arbEdit, (d, edit) => {
        const before = JSON.stringify(d)
        const r = applyColumnEdit(d, edit, ch)
        expect(JSON.stringify(d)).toBe(before)
        if (r.ok) {
          expect(validateColumnDesign(r.value, ch)).toEqual([])
          expect({ ...r.value, section: null }).toEqual({ ...d, section: null })
        } else {
          expect(r.error.length).toBeGreaterThan(0)
        }
        const knownClamp = edit.type === 'setParam' && edit.mode === 'clamp' && (d.section as unknown as Record<string, unknown>)[edit.param] !== undefined
        if (knownClamp) expect(r.ok).toBe(true)
      }),
    )
  })
})
