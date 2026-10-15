// Feature: engineering-intuition-mvp, Property 26: Constraints immutable
//
// Loader/freeze half of Property 26 (task 4.4). The reducer-sequence half lives in task 19.13.
// **Validates: Requirements 3.4, 4.6, 4.7**
//
// Random mutation attempts (assign, add, delete, array mutators, defineProperty,
// setPrototypeOf, Object.assign, Reflect.*) at random nesting paths of a loaded challenge
// must leave it deep-equal to a clone captured before the attempt, and every reachable
// object must stay frozen with its original prototype.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { assertProperty } from '../../test/pbt'
import { bundledChallenge } from '../../test/arbitraries'
import { cantileverBeam1Json } from './content'
import { loadChallenge } from './loader'
import type { Challenge } from './types'

type Container = Record<PropertyKey, unknown>

const isContainer = (v: unknown): v is Container => typeof v === 'object' && v !== null

/** Fresh deep-frozen challenge from the bundled JSON via the loader. */
function freshChallenge(): Challenge {
  const r = loadChallenge(cantileverBeam1Json)
  if (!r.ok) throw new Error(`bundled challenge failed to load: ${JSON.stringify(r.error)}`)
  return r.value
}

/**
 * Walks the actual object: at each level picks an own key by `choice % keys.length` and
 * descends while the child is an object/array. Returns the deepest container reached and
 * the path to it (the path is only for failure messages).
 */
function walk(root: Container, choices: readonly number[]): { target: Container; path: string[] } {
  let target = root
  const path: string[] = []
  for (const choice of choices) {
    const keys = Object.keys(target)
    if (keys.length === 0) break
    const key = keys[choice % keys.length]
    const child = target[key]
    if (!isContainer(child)) break
    target = child
    path.push(key)
  }
  return { target, path }
}

/** Asserts every reachable object/array is frozen and keeps its plain prototype. */
function assertDeepFrozen(value: unknown, path = '<root>'): void {
  if (!isContainer(value)) return
  expect(Object.isFrozen(value), `not frozen at ${path}`).toBe(true)
  const proto: unknown = Object.getPrototypeOf(value)
  const expected = Array.isArray(value) ? Array.prototype : Object.prototype
  expect(proto === expected, `prototype changed at ${path}`).toBe(true)
  for (const key of Object.keys(value)) assertDeepFrozen(value[key], `${path}.${key}`)
}

const arbValue: fc.Arbitrary<unknown> = fc.oneof(
  fc.integer(),
  fc.double(),
  fc.string({ maxLength: 8 }),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.object({ maxDepth: 1, maxKeys: 3 }),
  fc.array(fc.integer(), { maxLength: 3 }),
)

/** Key to target: an existing own key (picked by index), a new key, or a hostile key. */
const arbKeySpec = fc.oneof(
  fc.record({ existing: fc.constant(true as const), index: fc.nat() }),
  fc.record({
    existing: fc.constant(false as const),
    key: fc.oneof(
      fc.string({ minLength: 1, maxLength: 8 }),
      fc.constantFrom('__proto__', 'constructor', 'prototype', 'length', '0', '999'),
    ),
  }),
)

type KeySpec = { existing: true; index: number } | { existing: false; key: string }

const OPS = [
  'assign',
  'delete',
  'defineProperty',
  'setPrototypeOf',
  'objectAssign',
  'reflectSet',
  'reflectDelete',
  'reflectDefine',
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
] as const
type Op = (typeof OPS)[number]

const arbMutation = fc.record({
  choices: fc.array(fc.nat(), { maxLength: 6 }),
  op: fc.constantFrom(...OPS),
  key: arbKeySpec,
  value: arbValue,
})

type Mutation = { choices: number[]; op: Op; key: KeySpec; value: unknown }

function resolveKey(target: Container, spec: KeySpec): string {
  if (!spec.existing) return spec.key
  const keys = Object.keys(target)
  return keys.length === 0 ? 'x' : keys[spec.index % keys.length]
}

/** Performs one mutation attempt. Throws whatever the engine throws (TypeError in strict mode). */
function attempt(target: Container, op: Op, key: string, value: unknown): void {
  // Array methods are applied via Array.prototype so they also hit plain objects (array-likes).
  const arr = target as unknown as unknown[]
  const A = Array.prototype
  switch (op) {
    case 'assign':
      target[key] = value
      return
    case 'delete':
      delete target[key]
      return
    case 'defineProperty':
      Object.defineProperty(target, key, { value, writable: true, configurable: true, enumerable: true })
      return
    case 'setPrototypeOf':
      Object.setPrototypeOf(target, isContainer(value) ? value : { polluted: value })
      return
    case 'objectAssign':
      Object.assign(target, { [key]: value })
      return
    // Reflect.* report failure via `false` instead of throwing; the state check still applies.
    case 'reflectSet':
      Reflect.set(target, key, value)
      return
    case 'reflectDelete':
      Reflect.deleteProperty(target, key)
      return
    case 'reflectDefine':
      Reflect.defineProperty(target, key, { value, writable: true, configurable: true })
      return
    case 'push':
      A.push.call(arr, value)
      return
    case 'pop':
      A.pop.call(arr)
      return
    case 'shift':
      A.shift.call(arr)
      return
    case 'unshift':
      A.unshift.call(arr, value)
      return
    case 'splice':
      A.splice.call(arr, 0, 1, value)
      return
    case 'sort':
      A.sort.call(arr, () => -1)
      return
    case 'reverse':
      A.reverse.call(arr)
      return
    case 'fill':
      A.fill.call(arr, value)
      return
    case 'copyWithin':
      A.copyWithin.call(arr, 0, 1)
      return
  }
}

function checkMutations(challenge: Challenge, mutations: readonly Mutation[]): void {
  const before = structuredClone(challenge)
  const root = challenge as unknown as Container
  for (const m of mutations) {
    const { target, path } = walk(root, m.choices)
    const key = resolveKey(target, m.key)
    try {
      attempt(target, m.op, key, m.value)
    } catch (e) {
      // Strict-mode writes to frozen objects throw TypeError. Defining an invalid array
      // `length` throws RangeError (ArraySetLength validates before the frozen check).
      // Anything else is unexpected; the state checks below are the real assertion.
      const where = `${m.op} at ${[...path, key].join('.')}`
      expect(e instanceof TypeError || e instanceof RangeError, `unexpected error for ${where}: ${String(e)}`).toBe(true)
    }
  }
  expect(challenge).toStrictEqual(before)
  assertDeepFrozen(challenge)
}

describe('Property 26: Constraints immutable (loader/freeze)', () => {
  it('random mutation attempts on a freshly loaded challenge leave it unchanged and frozen', () => {
    assertProperty(
      fc.property(fc.array(arbMutation, { minLength: 1, maxLength: 8 }), (mutations) => {
        checkMutations(freshChallenge(), mutations as Mutation[])
      }),
    )
  })

  it('random mutation attempts on the shared bundled challenge never change it', () => {
    const shared = bundledChallenge()
    // Captured once: any mutation that slipped through in an earlier run would also show here.
    const original = structuredClone(shared)
    assertProperty(
      fc.property(fc.array(arbMutation, { minLength: 1, maxLength: 8 }), (mutations) => {
        checkMutations(shared, mutations as Mutation[])
        expect(shared).toStrictEqual(original)
      }),
    )
  })

  it('direct writes to constraints throw TypeError in strict mode', () => {
    const ch = freshChallenge() as unknown as Container
    const constraints = ch.constraints
    expect(isContainer(constraints)).toBe(true)
    expect(() => {
      ch.constraints = {}
    }).toThrow(TypeError)
    expect(() => {
      ;(constraints as Container).injected = 1
    }).toThrow(TypeError)
  })
})
