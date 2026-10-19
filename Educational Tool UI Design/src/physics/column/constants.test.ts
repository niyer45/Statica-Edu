import { describe, expect, it } from 'vitest'
import { COLUMN_ASSUMPTIONS, COLUMN_SOURCE_NOTE, COLUMN_THRESHOLDS, COLUMN_UNSUPPORTED_EFFECTS, EFFECTIVE_LENGTH_FACTORS } from './constants'

// Column model constants (task 68, `eulerColumnBuckling` v1; CBK-11–CBK-14).

describe('column constants', () => {
  it('are frozen model constants', () => {
    for (const c of [COLUMN_THRESHOLDS, COLUMN_UNSUPPORTED_EFFECTS, COLUMN_ASSUMPTIONS, EFFECTIVE_LENGTH_FACTORS]) expect(Object.isFrozen(c)).toBe(true)
  })

  it('cite sources by name only, with no invented edition or equation numbers', () => {
    expect(COLUMN_SOURCE_NOTE).toMatch(/Shigley/)
    expect(COLUMN_SOURCE_NOTE).toMatch(/pending engineering review/)
    expect(COLUMN_SOURCE_NOTE).not.toMatch(/\d/)
    expect(COLUMN_ASSUMPTIONS).toContain(COLUMN_SOURCE_NOTE)
  })

  it('list the CBK-14 unsupported effects, including the screened ones', () => {
    const text = COLUMN_UNSUPPORTED_EFFECTS.join(' | ')
    for (const effect of ['crookedness', 'eccentricity', 'residual stresses', 'Johnson', 'local buckling', 'ideal pins', 'self-weight', 'shear deformation', 'post-buckling']) {
      expect(text).toContain(effect)
    }
  })
})
