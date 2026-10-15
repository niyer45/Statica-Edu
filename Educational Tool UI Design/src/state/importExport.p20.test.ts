// Feature: engineering-intuition-mvp, Property 20: Import round-trip
//
// **Validates: Requirements 22.2, 22.3, 23.3**
//
// Round-trip: for every valid design d, importing exportDesign(d) (as text, and as the parsed
// value) returns ok with a design deep-equal to d, id included.
// Totality: for arbitrary input (any JSON / JS values, arbitrary strings, arbitrary JSON texts,
// and near-miss envelopes made by mutating a valid export), importDesign never throws and returns
// either a design that validateDesign accepts, or a non-empty list of non-empty reasons.
// Object.prototype must be unchanged after every run.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbAnyJson, arbDesign, arbHostileNumber, bundledChallenge, POLLUTION_KEYS } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { validateDesign } from '../geometry/validate'
import { exportDesign, importDesign } from './importExport'

const ch = bundledChallenge()

type Json = Record<string, unknown>

/** Snapshot of Object.prototype: own keys, their descriptors, and its own prototype. */
function prototypeSnapshot(): { keys: string[]; descriptors: PropertyDescriptor[]; proto: unknown } {
  const keys = Reflect.ownKeys(Object.prototype).map(String)
  const descriptors = Reflect.ownKeys(Object.prototype).map(
    (k) => Object.getOwnPropertyDescriptor(Object.prototype, k)!,
  )
  return { keys, descriptors, proto: Object.getPrototypeOf(Object.prototype) }
}

const baseline = prototypeSnapshot()

function expectPrototypeUnchanged(): void {
  expect(prototypeSnapshot()).toEqual(baseline)
  expect(({} as Json).polluted).toBeUndefined()
}

/** Calls importDesign and checks the totality contract. */
function expectTotal(input: unknown): void {
  let result: ReturnType<typeof importDesign> | undefined
  expect(() => {
    result = importDesign(input, ch)
  }).not.toThrow()
  const r = result!
  if (r.ok) {
    expect(validateDesign(r.value, ch)).toEqual([])
  } else {
    expect(Array.isArray(r.error)).toBe(true)
    expect(r.error.length).toBeGreaterThan(0)
    for (const reason of r.error) {
      expect(typeof reason).toBe('string')
      expect(reason.length).toBeGreaterThan(0)
    }
  }
  expectPrototypeUnchanged()
}

// ---------------------------------------------------------------------------
// Near-miss envelopes: mutate a valid export
// ---------------------------------------------------------------------------

type Target = 'root' | 'design' | 'section'

type Mutation =
  | { op: 'drop'; target: Target; pick: number }
  | { op: 'rename'; target: Target; pick: number; to: string }
  | { op: 'add'; target: Target; key: string; value: unknown }
  | { op: 'retype'; target: Target; pick: number; value: unknown }
  | { op: 'hostile'; target: Target; pick: number; value: number }

const arbTarget = fc.constantFrom<Target>('root', 'design', 'section')
const arbKey = fc.oneof(
  fc.string(),
  fc.constantFrom(...POLLUTION_KEYS),
  fc.constantFrom('forceN', 'load', 'support', 'id', 'kind', 'lengthM', 'materialId', 'diameterM'),
)
const arbPick = fc.nat({ max: 100 })

const arbMutation: fc.Arbitrary<Mutation> = fc.oneof(
  fc.record({ op: fc.constant('drop' as const), target: arbTarget, pick: arbPick }),
  fc.record({ op: fc.constant('rename' as const), target: arbTarget, pick: arbPick, to: arbKey }),
  fc.record({ op: fc.constant('add' as const), target: arbTarget, key: arbKey, value: arbAnyJson }),
  fc.record({ op: fc.constant('retype' as const), target: arbTarget, pick: arbPick, value: arbAnyJson }),
  fc.record({ op: fc.constant('hostile' as const), target: arbTarget, pick: arbPick, value: arbHostileNumber }),
)

function containerOf(root: Json, target: Target): Json | undefined {
  const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
  if (target === 'root') return root
  const design = isObj(root.design) ? root.design : undefined
  if (target === 'design') return design
  return design && isObj(design.section) ? design.section : undefined
}

/** Own-key define (never triggers the __proto__ setter, matching what JSON.parse produces). */
function setOwn(obj: Json, key: string, value: unknown): void {
  Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true })
}

function applyMutation(root: Json, m: Mutation): void {
  const c = containerOf(root, m.target)
  if (!c) return
  const keys = Object.keys(c)
  if (m.op === 'add') {
    setOwn(c, m.key, m.value)
    return
  }
  if (keys.length === 0) return
  const key = keys[m.pick % keys.length]!
  switch (m.op) {
    case 'drop':
      delete c[key]
      break
    case 'rename': {
      const v = c[key]
      delete c[key]
      setOwn(c, m.to, v)
      break
    }
    case 'retype':
    case 'hostile':
      c[key] = m.value
      break
  }
}

const arbNearMiss: fc.Arbitrary<Json> = fc
  .tuple(arbDesign(ch), fc.array(arbMutation, { minLength: 1, maxLength: 4 }))
  .map(([d, mutations]) => {
    const root = JSON.parse(exportDesign(d, ch)) as Json
    for (const m of mutations) applyMutation(root, m)
    return root
  })

/** JSON text for a value, or undefined when it cannot be serialized (bigint, cycles, ...). */
function tryStringify(v: unknown): string | undefined {
  try {
    return JSON.stringify(v)
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('Property 20: Import round-trip', () => {
  it('importing exported text returns the same design, id included', () => {
    assertProperty(
      fc.property(arbDesign(ch), (d) => {
        const r = importDesign(exportDesign(d, ch), ch)
        expect(r).toEqual({ ok: true, value: d })
        expectPrototypeUnchanged()
      }),
    )
  })

  it('importing the parsed export returns the same design, id included', () => {
    assertProperty(
      fc.property(arbDesign(ch), (d) => {
        const r = importDesign(JSON.parse(exportDesign(d, ch)) as unknown, ch)
        expect(r).toEqual({ ok: true, value: d })
        expectPrototypeUnchanged()
      }),
    )
  })

  it('is total over arbitrary values (arbAnyJson)', () => {
    assertProperty(fc.property(arbAnyJson, (j) => expectTotal(j)))
  })

  it('is total over arbitrary strings and arbitrary JSON texts', () => {
    const arbText = fc.oneof(
      fc.string(),
      fc.string({ unit: 'binary' }),
      fc.json({ maxDepth: 3 }),
      arbAnyJson.map(tryStringify).filter((s): s is string => s !== undefined),
    )
    assertProperty(fc.property(arbText, (s) => expectTotal(s)))
  })

  it('is total over near-miss envelopes (parsed and as text)', () => {
    assertProperty(
      fc.property(arbNearMiss, (env) => {
        expectTotal(env)
        const text = tryStringify(env)
        if (text !== undefined) expectTotal(text)
      }),
    )
  })
})
