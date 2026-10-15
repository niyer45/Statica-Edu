import { afterEach, describe, expect, it, vi } from 'vitest'
import { bundledChallengeResult } from '../challenge/content'
import type { Challenge } from '../challenge/types'
import type { BeamDesign } from '../geometry/sections'
import { MAX_IMPORT_BYTES, exportDesign, importDesign } from './importExport'

// Import security unit tests (task 11.8; Req 22.4, 23.1, 23.2, 23.4). Complements
// importExport.test.ts: covers parse-avoidance for oversize input, multibyte boundaries on
// valid files, prototype-pollution payloads at several depths, symbol keys, per-field
// reasons, and the absence of eval / Function use.

if (!bundledChallengeResult.ok) throw new Error('bundled challenge failed to load')
const ch: Challenge = bundledChallengeResult.value
const reference = ch.referenceDesign!

type Loose = Record<string, unknown>
type Envelope = Loose & { design: Loose & { section: Loose } }
const envelope = (d: BeamDesign = reference): Envelope => JSON.parse(exportDesign(d, ch)) as Envelope
const bytes = (s: string) => new TextEncoder().encode(s).length
const padTo = (text: string, n: number) => text + ' '.repeat(n - bytes(text))

const reasonsOf = (input: unknown): string[] => {
  const r = importDesign(input, ch)
  return r.ok ? [] : r.error
}

const protoKeysBefore = Reflect.ownKeys(Object.prototype)
function expectPrototypeIntact(): void {
  expect(({} as Loose).polluted).toBeUndefined()
  expect(Reflect.ownKeys(Object.prototype)).toEqual(protoKeysBefore)
  expect(Object.getPrototypeOf({})).toBe(Object.prototype)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('size limit (Req 23.1, 23.2)', () => {
  it(`accepts a valid ${MAX_IMPORT_BYTES}-byte file and rejects ${MAX_IMPORT_BYTES + 1} bytes without parsing`, () => {
    const text = exportDesign(reference, ch)
    const parse = vi.spyOn(JSON, 'parse')

    expect(importDesign(padTo(text, MAX_IMPORT_BYTES), ch)).toEqual({ ok: true, value: reference })
    expect(parse).toHaveBeenCalledTimes(1)

    parse.mockClear()
    expect(reasonsOf(padTo(text, MAX_IMPORT_BYTES + 1))).toEqual([expect.stringMatching(/too large/)])
    expect(parse).not.toHaveBeenCalled()
  })

  it('counts UTF-8 bytes of a valid file whose character length is under the limit', () => {
    // 'é' is 2 bytes; a long multibyte id keeps the character length well below the byte length.
    const d: BeamDesign = { ...reference, id: 'é'.repeat(40000) }
    const text = exportDesign(d, ch)
    const atLimit = padTo(text, MAX_IMPORT_BYTES)
    const over = padTo(text, MAX_IMPORT_BYTES + 1)
    expect(over.length).toBeLessThan(MAX_IMPORT_BYTES)

    expect(importDesign(atLimit, ch)).toEqual({ ok: true, value: d })
    const parse = vi.spyOn(JSON, 'parse')
    expect(reasonsOf(over)).toEqual([expect.stringMatching(/too large/)])
    expect(parse).not.toHaveBeenCalled()
  })

  it('counts a 4-byte character (surrogate pair) as 4 bytes', () => {
    const d: BeamDesign = { ...reference, id: '😀'.repeat(20000) } // 80,000 bytes, 40,000 code units
    const text = exportDesign(d, ch)
    expect(importDesign(padTo(text, MAX_IMPORT_BYTES), ch)).toEqual({ ok: true, value: d })
    expect(reasonsOf(padTo(text, MAX_IMPORT_BYTES + 1))).toEqual([expect.stringMatching(/too large/)])
  })
})

describe('prototype pollution (Req 23.4)', () => {
  const exported = exportDesign(reference, ch)
  const inject = (anchor: string, payload: string) => exported.replace(anchor, `${payload}, ${anchor}`)

  it.each([
    ['top level', inject('"format"', '"__proto__": {"polluted": true}'), '(top level)'],
    ['design', inject('"id"', '"__proto__": {"polluted": true}'), 'design'],
    ['design.section', inject('"kind"', '"__proto__": {"polluted": true}'), 'design.section'],
    ['deeply nested extra', inject('"format"', '"x": {"a": {"b": {"__proto__": {"polluted": true}}}}'), 'x.a.b'],
    ['inside an array', inject('"format"', '"x": [1, {"ok": 1}, {"__proto__": {"polluted": true}}]'), 'x.2'],
    ['nested arrays', inject('"format"', '"x": [[{"y": [{"__proto__": {"polluted": true}}]}]]'), 'x.0.0.y.0'],
  ])('rejects __proto__ at %s, naming the key and path', (_, text, path) => {
    const reasons = reasonsOf(text)
    expect(reasons).toEqual([`Unexpected key "__proto__" at ${path} is not allowed in a design file.`])
    expectPrototypeIntact()
  })

  it('rejects a constructor.prototype payload with one reason naming "constructor"', () => {
    const text = inject('"format"', '"constructor": {"prototype": {"polluted": true}}')
    expect(reasonsOf(text)).toEqual([expect.stringContaining('"constructor" at (top level)')])
    expectPrototypeIntact()
  })

  it('reports every forbidden key, one reason each', () => {
    const text = inject('"kind"', '"prototype": 1').replace(
      '"format"',
      '"__proto__": {"polluted": true}, "constructor": {}, "format"',
    )
    const reasons = reasonsOf(text)
    expect(reasons).toHaveLength(3)
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      expect(reasons.filter((r) => r.includes(`"${key}"`))).toHaveLength(1)
    }
    expectPrototypeIntact()
  })

  it('rejects pre-parsed objects that carry an own __proto__ key (created by JSON.parse)', () => {
    const top = JSON.parse(inject('"format"', '"__proto__": {"polluted": true}')) as unknown
    const nested = JSON.parse(inject('"kind"', '"__proto__": {"polluted": true}')) as unknown
    expect(Object.prototype.hasOwnProperty.call(top, '__proto__')).toBe(true)
    expect(reasonsOf(top)).toEqual([expect.stringContaining('"__proto__" at (top level)')])
    expect(reasonsOf(nested)).toEqual([expect.stringContaining('"__proto__" at design.section')])
    expectPrototypeIntact()
  })

  it('a rejected import never returns a design and a later valid import is unaffected', () => {
    const r = importDesign(inject('"id"', '"__proto__": {"lengthM": 99}'), ch)
    expect(r.ok).toBe(false)
    expect(importDesign(exported, ch)).toEqual({ ok: true, value: reference })
    expectPrototypeIntact()
  })

  it('symbol keys on pre-parsed input produce a reason instead of throwing', () => {
    const e: Loose = { ...envelope(), [Symbol('evil')]: 1 }
    const reasons = reasonsOf(e)
    expect(reasons).toEqual([expect.stringContaining('Symbol(evil)')])
  })
})

describe('envelope checks, one reason per failure (Req 22.4)', () => {
  it.each([
    ['format', { format: 'ei-designx' }, /format must be "ei-design"/],
    ['format (wrong type)', { format: 1 }, /format must be "ei-design"/],
    ['schemaVersion', { schemaVersion: 2 }, /schemaVersion must be 1/],
    ['schemaVersion (string "1")', { schemaVersion: '1' }, /schemaVersion must be 1/],
    ['challengeId', { challengeId: 'other-challenge' }, /different challenge/],
    ['challengeId (missing)', { challengeId: undefined }, /different challenge.*missing/],
  ])('wrong %s alone gives exactly one reason', (_, patch, pattern) => {
    const e = { ...envelope(), ...patch }
    expect(reasonsOf(JSON.stringify(e))).toEqual([expect.stringMatching(pattern)])
  })
})

describe('locked fields, one reason per field (Req 22.4)', () => {
  it.each([
    ['lengthM', { lengthM: 2 }, [/Beam length is fixed/]],
    ['materialId', { materialId: 'steel' }, [/Material is fixed/]],
    ['both', { lengthM: 2, materialId: 'steel' }, [/Beam length is fixed/, /Material is fixed/]],
  ])('changing %s', (_, patch, patterns) => {
    const e = envelope()
    Object.assign(e.design, patch)
    expect(reasonsOf(JSON.stringify(e))).toEqual(patterns.map((p) => expect.stringMatching(p)))
  })

  it('load and support keys at the top level each give one "fixed by the challenge" reason', () => {
    const e = { ...envelope(), forceN: 1, load: {}, support: 'pinned' }
    const reasons = reasonsOf(JSON.stringify(e))
    expect(reasons).toHaveLength(3)
    expect(reasons[0]).toMatch(/"forceN".*fixed by the challenge/)
    expect(reasons[1]).toMatch(/"load".*fixed by the challenge/)
    expect(reasons[2]).toMatch(/"support".*fixed by the challenge/)
  })

  it('locked fields plus a wrong format yield one reason each', () => {
    const e = { ...envelope(), format: 'nope' }
    e.design.lengthM = 2
    e.design.materialId = 'steel'
    const reasons = reasonsOf(JSON.stringify(e))
    expect(reasons).toHaveLength(3)
    expect(reasons[0]).toMatch(/format/)
    expect(reasons[1]).toMatch(/Beam length/)
    expect(reasons[2]).toMatch(/Material/)
  })
})

describe('parser (Req 23.2)', () => {
  it('never calls eval or the Function constructor', () => {
    const evalSpy = vi.spyOn(globalThis, 'eval')
    const fnSpy = vi.spyOn(globalThis, 'Function')
    const inputs = [
      exportDesign(reference, ch),
      'alert(1)',
      '{"format": "ei-design", "design": "(function(){throw 1})()"}',
      exportDesign(reference, ch).replace('"kind"', '"__proto__": {}, "kind"'),
    ]
    for (const t of inputs) importDesign(t, ch)
    expect(evalSpy).not.toHaveBeenCalled()
    expect(fnSpy).not.toHaveBeenCalled()
  })
})
