import { describe, expect, it } from 'vitest'
import { shaft, solid, torsionChallenge, tube } from '../../../test/fixtures/torsion'
import type { TorsionSectionLimits } from '../../challenge/torsion/types'
import type { TorsionDesign, TorsionSection } from './design'
import {
  applyTorsionEdit,
  clampTorsionParam,
  convertTorsionSection,
  TORSION_SECTION_PARAMS,
  torsionPermissibleRange,
  trySetTorsionParam,
} from './edit'

// Torsion edit operations (task 47.2; TSH-04, MM-09).

const ch = torsionChallenge()
const L = ch.sectionLimits
const D = ch.sectionDefaults

describe('torsionPermissibleRange', () => {
  it('uses the circle range, the derived tube D floor and the bore range', () => {
    expect(TORSION_SECTION_PARAMS).toEqual({ circle: ['diameterM'], tube: ['outerDiameterM', 'innerDiameterM'] })
    expect(torsionPermissibleRange(solid(0.03), 'diameterM', L)).toEqual({ minM: 0.01, maxM: 0.06 })
    expect(torsionPermissibleRange(tube(0.05, 0.044), 'outerDiameterM', L)).toEqual({ minM: 0.015, maxM: 0.06 })
    expect(torsionPermissibleRange(tube(0.05, 0.044), 'innerDiameterM', L)).toEqual({ minM: 0, maxM: 0.05 - 0.004 })
    expect(torsionPermissibleRange(solid(0.03), 'outerDiameterM', L)).toBeNull()
  })

  it('collapses degenerate ranges to the current value', () => {
    const bad: TorsionSectionLimits = { ...L, circle: { diameterM: { minM: 0.05, maxM: 0.02, stepM: 0.0005 } } }
    expect(torsionPermissibleRange(solid(0.03), 'diameterM', bad)).toEqual({ minM: 0.03, maxM: 0.03 })
  })
})

describe('clampTorsionParam', () => {
  it('clamps into range', () => {
    expect(clampTorsionParam(solid(0.03), 'diameterM', 0.1, L)).toEqual(solid(0.06))
    expect(clampTorsionParam(solid(0.03), 'diameterM', 0.001, L)).toEqual(solid(0.01))
    expect(clampTorsionParam(tube(0.05, 0.044), 'innerDiameterM', 0.049, L)).toEqual(tube(0.05, 0.05 - 0.004))
    expect(clampTorsionParam(tube(0.05, 0.044), 'innerDiameterM', -1, L)).toEqual(tube(0.05, 0))
  })

  it('keeps the bore when the new D still fits it, otherwise shrinks it', () => {
    expect(clampTorsionParam(tube(0.05, 0.044), 'outerDiameterM', 0.06, L)).toEqual(tube(0.06, 0.044))
    expect(clampTorsionParam(tube(0.05, 0.044), 'outerDiameterM', 0.046, L)).toEqual(tube(0.046, 0.046 - 0.004))
    expect(clampTorsionParam(tube(0.05, 0.044), 'outerDiameterM', 0.0, L)).toEqual(tube(0.015, 0.015 - 0.004))
  })

  it('returns the same section for non-finite values or unknown params', () => {
    const s = solid(0.03)
    expect(clampTorsionParam(s, 'diameterM', Number.NaN, L)).toBe(s)
    expect(clampTorsionParam(s, 'widthM', 0.02, L)).toBe(s)
  })

  it('normalizes −0', () => {
    const r = clampTorsionParam(tube(0.05, 0.03), 'innerDiameterM', -0, L)
    expect(Object.is((r as Extract<TorsionSection, { kind: 'tube' }>).innerDiameterM, 0)).toBe(true)
  })
})

describe('trySetTorsionParam', () => {
  it('sets only the parameter when the candidate validates', () => {
    expect(trySetTorsionParam(tube(0.05, 0.044), 'innerDiameterM', 0.04, L)).toEqual({ ok: true, value: tube(0.05, 0.04) })
  })

  it('fails with every validator error, without coupling', () => {
    const r = trySetTorsionParam(tube(0.05, 0.044), 'outerDiameterM', 0.046, L)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.map((e) => e.code)).toEqual(['WALL_TOO_THIN'])
    const nan = trySetTorsionParam(solid(0.03), 'diameterM', Number.NaN, L)
    expect(!nan.ok && nan.error.map((e) => e.code)).toEqual(['NON_FINITE'])
  })

  it('rejects an unknown parameter', () => {
    const r = trySetTorsionParam(solid(0.03), 'innerDiameterM', 0.01, L)
    expect(!r.ok && r.error).toEqual([
      { code: 'SECTION_NOT_ALLOWED', param: 'innerDiameterM', message: '"innerDiameterM" is not a dimension of a circle shaft section.' },
    ])
  })
})

describe('convertTorsionSection', () => {
  it('keeps the outer diameter and uses the 4 mm default wall (TSH-04)', () => {
    expect(convertTorsionSection(solid(0.03), 'tube', L, D)).toEqual(tube(0.03, 0.03 - 0.008))
    expect(convertTorsionSection(tube(0.05, 0.044), 'circle', L, D)).toEqual(solid(0.05))
  })

  it('clamps to the target range and falls back to a full wall when the default does not fit', () => {
    expect(convertTorsionSection(solid(0.01), 'tube', L, D)).toEqual(tube(0.015, 0.015 - 0.008))
    expect(convertTorsionSection(solid(0.01), 'tube', L, { tubeWallM: 0.01 })).toEqual(tube(0.015, 0))
  })

  it('returns the same object for the same kind', () => {
    const s = solid(0.03)
    expect(convertTorsionSection(s, 'circle', L, D)).toBe(s)
  })
})

describe('applyTorsionEdit', () => {
  const draft = ch.initialDesign

  it('switches sections and keeps the id and locked fields', () => {
    const r = applyTorsionEdit(draft, { type: 'setSection', kind: 'tube' }, ch)
    expect(r).toEqual({ ok: true, value: { ...draft, section: tube(0.0265, 0.0265 - 0.008) } })
  })

  it('rejects a disallowed kind without changing the draft', () => {
    const circleOnly = { ...ch, allowedSections: ['circle' as const] }
    const r = applyTorsionEdit(draft, { type: 'setSection', kind: 'tube' }, circleOnly)
    expect(!r.ok && r.error.map((e) => e.code)).toEqual(['SECTION_NOT_ALLOWED'])
    expect(draft.section).toEqual(solid(0.0265))
  })

  it('applies clamp and strict parameter edits', () => {
    expect(applyTorsionEdit(draft, { type: 'setParam', param: 'diameterM', valueM: 1, mode: 'clamp' }, ch)).toEqual({
      ok: true,
      value: { ...draft, section: solid(0.06) },
    })
    const strict = applyTorsionEdit(draft, { type: 'setParam', param: 'diameterM', valueM: 1, mode: 'strict' }, ch)
    expect(!strict.ok && strict.error.map((e) => e.code)).toEqual(['ABOVE_MAX'])
    expect(applyTorsionEdit(draft, { type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' }, ch)).toEqual({
      ok: true,
      value: { ...draft, section: solid(0.04) },
    })
  })

  it('rejects unknown parameters in both modes', () => {
    for (const mode of ['clamp', 'strict'] as const) {
      const r = applyTorsionEdit(draft, { type: 'setParam', param: 'widthM', valueM: 0.02, mode }, ch)
      expect(!r.ok && r.error.map((e) => e.code)).toEqual(['SECTION_NOT_ALLOWED'])
    }
  })

  it('never changes locked fields: an invalid draft stays rejected', () => {
    const tampered: TorsionDesign = { ...shaft('t', solid(0.03)), lengthM: 1 }
    const r = applyTorsionEdit(tampered, { type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'clamp' }, ch)
    expect(!r.ok && r.error.map((e) => e.code)).toEqual(['LOCKED_FIELD_CHANGED'])
  })

  it('does not mutate the draft', () => {
    const frozen = Object.freeze({ ...draft, section: Object.freeze(tube(0.05, 0.044)) })
    expect(() => applyTorsionEdit(frozen, { type: 'setParam', param: 'outerDiameterM', valueM: 0.04, mode: 'clamp' }, ch)).not.toThrow()
  })
})
