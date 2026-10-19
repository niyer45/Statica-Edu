import { describe, expect, it } from 'vitest'
import { column, columnChallenge, solid, tube } from '../../../test/fixtures/column'
import { applyColumnEdit, clampColumnParam, columnPermissibleRange, convertColumnSection, trySetColumnParam } from './edit'

// Column edit operations (task 68; CBK-05, MM-09).

const ch = columnChallenge()
const L = ch.sectionLimits

describe('clamp and strict edits', () => {
  it('clamps into the configured range and leaves the other dimension alone', () => {
    expect(clampColumnParam(solid(0.03), 'diameterM', 1, L)).toEqual(solid(0.06))
    expect(clampColumnParam(tube(0.05, 0.002), 'outerDiameterM', 0, L)).toEqual(tube(0.015, 0.002))
    expect(clampColumnParam(tube(0.05, 0.002), 'wallThicknessM', 0.02, L)).toEqual(tube(0.05, 0.006))
  })

  it('returns the same object for a non-finite value or an unknown parameter', () => {
    const s = tube(0.05, 0.002)
    expect(clampColumnParam(s, 'outerDiameterM', Number.NaN, L)).toBe(s)
    expect(clampColumnParam(s, 'diameterM', 0.03, L)).toBe(s)
    expect(columnPermissibleRange(s, 'innerDiameterM', L)).toBeNull()
    expect(columnPermissibleRange(s, 'wallThicknessM', L)).toEqual({ minM: 0.001, maxM: 0.006 })
  })

  it('strict mode succeeds only for a valid candidate and reports every error', () => {
    expect(trySetColumnParam(solid(0.03), 'diameterM', 0.04, L)).toEqual({ ok: true, value: solid(0.04) })
    const bad = trySetColumnParam(solid(0.03), 'diameterM', 0.2, L)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error.map((e) => e.code)).toEqual(['ABOVE_MAX'])
    const unknown = trySetColumnParam(solid(0.03), 'wallThicknessM', 0.002, L)
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.map((e) => e.code)).toEqual(['UNKNOWN_PARAM'])
  })
})

describe('section switching', () => {
  it('keeps the outer diameter (clamped) and uses the default wall for a new tube', () => {
    expect(convertColumnSection(solid(0.0245), 'tube', L, ch.sectionDefaults)).toEqual(tube(0.0245, 0.003))
    expect(convertColumnSection(solid(0.01), 'tube', L, ch.sectionDefaults)).toEqual(tube(0.015, 0.003))
    expect(convertColumnSection(tube(0.07, 0.002), 'solid', L, ch.sectionDefaults)).toEqual(solid(0.06))
    const s = solid(0.03)
    expect(convertColumnSection(s, 'solid', L, ch.sectionDefaults)).toBe(s)
  })

  it('clamps an out-of-range default wall into the wall range', () => {
    expect(convertColumnSection(solid(0.03), 'tube', L, { tubeWallM: 0.02 })).toEqual(tube(0.03, 0.006))
  })
})

describe('applyColumnEdit', () => {
  const draft = column('d', solid(0.0245))

  it('returns a new valid design, never mutating the draft', () => {
    const r = applyColumnEdit(Object.freeze(draft), { type: 'setSection', kind: 'tube' }, ch)
    expect(r).toEqual({ ok: true, value: { ...draft, section: tube(0.0245, 0.003) } })
    const p = applyColumnEdit(draft, { type: 'setParam', param: 'diameterM', valueM: 0.03, mode: 'clamp' }, ch)
    expect(p).toEqual({ ok: true, value: { ...draft, section: solid(0.03) } })
  })

  it('rejects disallowed kinds, unknown parameters and invalid strict values with errors', () => {
    const onlySolid = { ...ch, allowedSections: ['solid' as const] }
    const kind = applyColumnEdit(draft, { type: 'setSection', kind: 'tube' }, onlySolid)
    expect(kind.ok).toBe(false)
    if (!kind.ok) expect(kind.error.map((e) => e.code)).toEqual(['SECTION_NOT_ALLOWED'])
    const unknown = applyColumnEdit(draft, { type: 'setParam', param: 'outerDiameterM', valueM: 0.05, mode: 'clamp' }, ch)
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error[0]).toMatchObject({ code: 'UNKNOWN_PARAM', param: 'outerDiameterM' })
    const strict = applyColumnEdit(draft, { type: 'setParam', param: 'diameterM', valueM: Number.NaN, mode: 'strict' }, ch)
    expect(strict.ok).toBe(false)
  })
})
