import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../challenge/content'
import type { Challenge } from '../challenge/types'
import type { BeamDesign } from '../geometry/sections'
import { MAX_IMPORT_BYTES, exportDesign, importDesign } from './importExport'

// Unit tests for design import/export (task 11.6; Req 22.1–22.4, 23.1–23.4).

if (!bundledChallengeResult.ok) throw new Error('bundled challenge failed to load')
const ch: Challenge = bundledChallengeResult.value
const baseline = ch.initialDesign
const reference = ch.referenceDesign!

/** Parsed export as a mutable plain object, for building hostile variants. */
type Loose = Record<string, unknown>
type Envelope = Loose & { design: Loose & { section: Loose } }
const envelope = (d: BeamDesign = reference): Envelope => JSON.parse(exportDesign(d, ch)) as Envelope

const reasonsOf = (input: unknown): string[] => {
  const r = importDesign(input, ch)
  return r.ok ? [] : r.error
}

describe('exportDesign (Req 22.1)', () => {
  it('produces JSON with exactly format, schemaVersion, challengeId, design', () => {
    const parsed = envelope(reference)
    expect(Object.keys(parsed)).toEqual(['format', 'schemaVersion', 'challengeId', 'design'])
    expect(parsed.format).toBe('ei-design')
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.challengeId).toBe(ch.id)
    expect(parsed.design).toEqual(reference)
  })

  it('writes only the given design (no referenceDesign or challenge data)', () => {
    // A circle design: 'iSection' could then only come from the (I-section) reference.
    const text = exportDesign({ ...baseline, section: { kind: 'circle', diameterM: 0.03 }, orientationDeg: 0 }, ch)
    expect(text).not.toContain('referenceDesign')
    expect(text).not.toContain('iSection')
    expect(text).not.toContain('constraints')
  })
})

describe('round-trip (Req 22.3)', () => {
  it.each([
    ['baseline', baseline],
    ['reference', reference],
  ])('%s design round-trips from text and from a parsed value, including id', (_, d) => {
    const text = exportDesign(d, ch)
    expect(importDesign(text, ch)).toEqual({ ok: true, value: d })
    expect(importDesign(JSON.parse(text), ch)).toEqual({ ok: true, value: d })
  })

  it('accepts a solid tube (inner diameter 0)', () => {
    const tube: BeamDesign = { ...baseline, id: 'x', section: { kind: 'tube', outerDiameterM: 0.04, innerDiameterM: 0 } }
    expect(importDesign(exportDesign(tube, ch), ch)).toEqual({ ok: true, value: tube })
  })
})

describe('envelope checks (Req 22.4)', () => {
  it('wrong format, schemaVersion, and challengeId give one reason each', () => {
    const e = { ...envelope(), format: 'other', schemaVersion: 2, challengeId: 'nope' }
    const reasons = reasonsOf(JSON.stringify(e))
    expect(reasons).toHaveLength(3)
    expect(reasons[0]).toMatch(/format/)
    expect(reasons[1]).toMatch(/schemaVersion/)
    expect(reasons[2]).toMatch(/different challenge/)
  })

  it('a missing design gives one reason', () => {
    const { design: _d, ...rest } = envelope()
    void _d
    expect(reasonsOf(rest)).toEqual([expect.stringMatching(/no design/)])
  })
})

describe('locked fields (Req 22.4)', () => {
  it('changing lengthM and materialId gives one reason per field', () => {
    const e = envelope()
    e.design.lengthM = 1
    e.design.materialId = 'steel'
    const reasons = reasonsOf(JSON.stringify(e))
    expect(reasons).toHaveLength(2)
    expect(reasons[0]).toMatch(/Beam length/)
    expect(reasons[1]).toMatch(/Material/)
  })

  it('load and support keys in the design are rejected as unknown keys', () => {
    const e = envelope()
    e.design.forceN = 500
    e.design.support = 'pinned'
    const reasons = reasonsOf(JSON.stringify(e))
    expect(reasons).toHaveLength(2)
    expect(reasons[0]).toMatch(/design\.forceN/)
    expect(reasons[1]).toMatch(/design\.support/)
  })
})

describe('geometry (Req 22.4)', () => {
  it('each geometry error becomes a reason', () => {
    const e = envelope()
    e.design.section = { kind: 'tube', outerDiameterM: 0.03, innerDiameterM: 0.04 }
    e.design.orientationDeg = 45
    const reasons = reasonsOf(JSON.stringify(e))
    expect(reasons).toHaveLength(2)
    expect(reasons[0]).toMatch(/Inner diameter must be smaller/)
    expect(reasons[1]).toMatch(/Orientation/)
  })
})

describe('security (Req 23.1–23.4)', () => {
  it.each(['__proto__', 'constructor', 'prototype'])('rejects a "%s" key at depth and leaves Object.prototype unchanged', (key) => {
    const protoKeysBefore = Object.getOwnPropertyNames(Object.prototype)
    const text = exportDesign(reference, ch).replace('"kind"', `"${key}": {"polluted": true}, "kind"`)
    const reasons = reasonsOf(text)
    expect(reasons).toEqual([expect.stringContaining(`"${key}" at design.section`)])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(protoKeysBefore)
  })

  it('rejects a top-level __proto__ key', () => {
    const text = `{"__proto__": {"polluted": true}, ${exportDesign(reference, ch).slice(1)}`
    expect(reasonsOf(text)).toEqual([expect.stringContaining('"__proto__" at (top level)')])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('names unknown keys at the top level and inside the design', () => {
    const e = envelope()
    e.extra = 1
    e.design.section.zz = 2
    const reasons = reasonsOf(JSON.stringify(e))
    expect(reasons).toEqual([
      expect.stringContaining('"extra"'),
      expect.stringContaining('"design.section.zz"'),
    ])
  })

  it(`accepts exactly ${MAX_IMPORT_BYTES} bytes for parsing and rejects ${MAX_IMPORT_BYTES + 1}`, () => {
    const text = exportDesign(reference, ch)
    const pad = (n: number) => text + ' '.repeat(n - new TextEncoder().encode(text).length)
    expect(importDesign(pad(MAX_IMPORT_BYTES), ch)).toEqual({ ok: true, value: reference })
    expect(reasonsOf(pad(MAX_IMPORT_BYTES + 1))).toEqual([expect.stringMatching(/too large/)])
  })

  it('measures UTF-8 bytes, not characters', () => {
    // 'é' is 2 UTF-8 bytes: 51,201 characters = 102,402 bytes.
    expect(reasonsOf('é'.repeat(51201))).toEqual([expect.stringMatching(/too large/)])
    expect(reasonsOf('é'.repeat(51200))).toEqual(['The file is not valid JSON.'])
  })

  it('malformed text gives a "not valid JSON" reason', () => {
    for (const t of ['', '{', "{'a':1}", 'undefined', 'alert(1)']) {
      expect(reasonsOf(t)).toEqual(['The file is not valid JSON.'])
    }
  })
})

describe('totality (Req 22.2)', () => {
  it.each([null, undefined, 0, 42, NaN, true, [], [1, 2], 'null', '[]', '"x"', '{}', () => 1])(
    'returns reasons without throwing for %p',
    (input) => {
      const r = importDesign(input, ch)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.length).toBeGreaterThan(0)
    },
  )

  it('does not throw for cyclic or getter-bearing pre-parsed values', () => {
    const cyclic: Record<string, unknown> = { ...envelope() }
    cyclic.self = cyclic
    expect(reasonsOf(cyclic).length).toBeGreaterThan(0)
    const trap = Object.defineProperty({ ...envelope() }, 'design', {
      enumerable: true,
      get() {
        throw new Error('boom')
      },
    })
    expect(reasonsOf(trap).length).toBeGreaterThan(0)
  })
})
