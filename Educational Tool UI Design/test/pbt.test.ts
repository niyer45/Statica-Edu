import { afterEach, describe, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import { FIXED_SEED, assertProperty, pbtParams } from './pbt'

describe('pbt helper', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to 200 runs with the fixed seed', () => {
    vi.stubEnv('PBT_RUNS', undefined)
    expect(pbtParams()).toEqual({ numRuns: 200, seed: FIXED_SEED })
  })

  it('reads the run count from PBT_RUNS', () => {
    vi.stubEnv('PBT_RUNS', '2000')
    expect(pbtParams().numRuns).toBe(2000)
  })

  it('passes a true property', () => {
    expect(() => assertProperty(fc.property(fc.integer(), (n) => n + 0 === n))).not.toThrow()
  })

  it('reports seed and shrunk counterexample on failure', () => {
    const failing = fc.property(fc.integer({ min: 0, max: 1000 }), (n) => n < 10)
    expect(() => assertProperty(failing)).toThrow(
      new RegExp(`seed: ${FIXED_SEED}[\\s\\S]*Counterexample: \\[10\\]`),
    )
  })
})
