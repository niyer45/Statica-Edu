import { describe, expect, it } from 'vitest'
import { column, columnChallenge, solid, tube } from '../../../test/fixtures/column'
import type { ColumnChallenge } from '../../challenge/column/types'
import { PhysicsInvariantError } from '../analyze'
import { analyzeColumn, COLUMN_MODEL_ID, COLUMN_MODEL_VERSION, ColumnInvariantError } from './analyze'
import { COLUMN_ASSUMPTIONS, COLUMN_UNSUPPORTED_EFFECTS, EFFECTIVE_LENGTH_FACTORS } from './constants'

// Column analysis entry point (task 68, `eulerColumnBuckling` v1; MM-03, MM-10).

const ch = columnChallenge()

describe('analyzeColumn', () => {
  it('names eulerColumnBuckling v1 and lists assumptions and unsupported effects', () => {
    const a = analyzeColumn(ch.initialDesign, ch)
    expect(COLUMN_MODEL_ID).toBe('eulerColumnBuckling')
    expect(COLUMN_MODEL_VERSION).toBe(1)
    expect(a.modelId).toBe('eulerColumnBuckling')
    expect(a.modelVersion).toBe(1)
    expect(a.assumptions).toBe(COLUMN_ASSUMPTIONS)
    expect(a.unsupportedEffects).toBe(COLUMN_UNSUPPORTED_EFFECTS)
  })

  it('uses the pinned–pinned effective length K L = L', () => {
    expect(EFFECTIVE_LENGTH_FACTORS.pinnedPinned).toBe(1)
    expect(analyzeColumn(ch.initialDesign, ch).effectiveLengthM).toBe(2)
  })

  it('is deterministic, deep-frozen and does not mutate its inputs', () => {
    const d = Object.freeze(column('t', Object.freeze(tube(0.05, 0.002))))
    const a = analyzeColumn(d, ch)
    expect(analyzeColumn(d, ch)).toEqual(a)
    expect(Object.isFrozen(a)).toBe(true)
    expect(Object.isFrozen(a.warnings)).toBe(true)
  })

  it('applicable is independent of warnings', () => {
    const warned = analyzeColumn(column('w', tube(0.07, 0.002)), ch)
    expect(warned.warnings.map((w) => w.code)).toEqual(['EULER_RANGE'])
    expect(warned.applicable).toBe(true)
    const na = analyzeColumn(column('n', tube(0.08, 0.002)), ch)
    expect(na.applicable).toBe(false)
    expect(na.notApplicableReasons.map((w) => w.code)).toEqual(['EULER_RANGE'])
    expect(na.notApplicableReasons[0]!.message).toMatch(/too stocky for the Euler formula/)
  })

  it('throws a typed invariant error (a PhysicsInvariantError) for a non-positive result', () => {
    const broken = { ...ch, load: { ...ch.load, forceN: 0 } } as ColumnChallenge
    let caught: unknown
    try {
      analyzeColumn(column('s', solid(0.03)), broken)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ColumnInvariantError)
    expect(caught).toBeInstanceOf(PhysicsInvariantError)
    expect((caught as ColumnInvariantError).field).toBe('bucklingSafetyFactor')
  })
})
