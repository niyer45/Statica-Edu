import fc from 'fast-check'
import { deepStrictEqual } from 'node:assert/strict'
import { expect, it } from 'vitest'
import { deserializeSession, serializeSession } from '../../src/state/persistence'
import { bundledChallenge } from '../arbitraries'
import { assertProperty } from '../pbt'
import { reachableSession } from './model'
import { sequenceHarness } from './sequence'
const ch = bundledChallenge()

// Feature: engineering-intuition-mvp, Property 35: Persistence round-trip
it('round-trips reachable sessions including explicit undefined fields and frozen result history', () => {
  assertProperty(fc.property(reachableSession(ch), ({ state }) => {
    const restored = deserializeSession(serializeSession(state), ch)
    expect(restored.ok).toBe(true)
    if (!restored.ok) throw new Error(restored.error)
    deepStrictEqual(restored.value, state)
    expect(restored.value.history.every((r) => Object.isFrozen(r) && Object.isFrozen(r.analysis))).toBe(true)
  }))
  const state = sequenceHarness(() => {}).real.state
  const restored = deserializeSession(serializeSession(state), ch)
  expect(restored.ok).toBe(true)
  if (restored.ok) deepStrictEqual(restored.value, state)
}, 30_000)
it('corrupted strings never throw or alter the existing session', () => {
  assertProperty(fc.property(fc.string(), (raw) => {
    const result = deserializeSession(raw, ch)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0)
  }))
})
