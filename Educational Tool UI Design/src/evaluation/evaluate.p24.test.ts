// Feature: engineering-intuition-mvp, Property 24: Monotonicity
// **Validates: Requirements 11.9, 11.10**
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Challenge } from '../challenge/types'
import { analyze } from '../physics/analyze'
import { arbDesign, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { CONSTRAINT_ORDER } from './constraints'
import { evaluate } from './evaluate'
import { REL_TOL, withinLimit } from './tolerance'

const ch = bundledChallenge()

type NumericId = 'deflection' | 'stress' | 'mass' | 'envelopeWidth' | 'envelopeHeight'
const LIMIT_KEY: Record<NumericId, keyof Challenge['constraints']> = {
  deflection: 'maxDeflectionM',
  stress: 'maxStressPa',
  mass: 'maxMassKg',
  envelopeWidth: 'maxWidthM',
  envelopeHeight: 'maxHeightM',
}
const NUMERIC_IDS = Object.keys(LIMIT_KEY) as NumericId[]

/** Positive finite doubles, mixing the full range with the app's practical range. */
const arbPositive = fc.oneof(
  fc.double({ min: Number.MIN_VALUE, max: 1e300, noNaN: true, noDefaultInfinity: true }),
  fc.double({ min: 1e-6, max: 1e9, noNaN: true, noDefaultInfinity: true }),
)

/** Tightening factor f ∈ (0, 1], biased towards 1 so the boundary is exercised. */
const arbTighten = fc.oneof(
  fc.double({ min: Number.MIN_VALUE, max: 1, noNaN: true }),
  fc.double({ min: 1 - 1e-6, max: 1, noNaN: true }),
  fc.constant(1),
)

/** Loosening factor f ∈ [1, 1e6]; the cap keeps `limit · f` finite for limits ≤ 1e300. */
const arbLoosen = fc.oneof(
  fc.double({ min: 1, max: 1e6, noNaN: true }),
  fc.double({ min: 1, max: 1 + 1e-6, noNaN: true }),
  fc.constant(1),
)

/** Multiplier placing a base limit near the value, so pass/fail transitions are reachable. */
const arbNearOne = fc.oneof(
  fc.double({ min: 0.5, max: 2, noNaN: true }),
  fc.double({ min: 1 - 10 * REL_TOL, max: 1 + 10 * REL_TOL, noNaN: true }),
)

type Scale = { tighten: boolean; f: number }
const arbScale: fc.Arbitrary<Scale> = fc.oneof(
  arbTighten.map((f) => ({ tighten: true, f })),
  arbLoosen.map((f) => ({ tighten: false, f })),
)

describe('Property 24: Monotonicity (Req 11.9, 11.10)', () => {
  it('withinLimit: tightening never turns fail into pass; loosening never turns pass into fail', () => {
    assertProperty(
      fc.property(arbPositive, arbPositive, arbTighten, arbLoosen, (value, limit, ft, fl) => {
        const before = withinLimit(value, limit)
        const tight = limit * ft
        const loose = limit * fl
        expect(Number.isFinite(loose)).toBe(true)
        if (!before) expect(withinLimit(value, tight)).toBe(false)
        if (before) expect(withinLimit(value, loose)).toBe(true)
      }),
    )
  })

  it('evaluate: scaling each numeric limit preserves monotonicity of its passed flag', () => {
    const arbBase = fc.oneof(
      fc.constant<number | null>(null), // keep the bundled challenge limit
      arbNearOne, // limit = value · g
    )
    assertProperty(
      fc.property(
        arbDesign(ch),
        fc.tuple(arbBase, arbBase, arbBase, arbBase, arbBase),
        fc.tuple(arbScale, arbScale, arbScale, arbScale, arbScale),
        (d, bases, scales) => {
          const a = analyze(d, ch)

          // Base challenge: per-constraint limit is either bundled or placed near the value.
          const values = evaluate(d, a, ch).constraints
          const baseCh = structuredClone(ch)
          NUMERIC_IDS.forEach((id, k) => {
            const g = bases[k]
            const v = values[CONSTRAINT_ORDER.indexOf(id)].value
            if (g !== null && Number.isFinite(v) && v > 0) baseCh.constraints[LIMIT_KEY[id]] = v * g
          })

          const scaledCh = structuredClone(baseCh)
          NUMERIC_IDS.forEach((id, k) => {
            scaledCh.constraints[LIMIT_KEY[id]] = baseCh.constraints[LIMIT_KEY[id]] * scales[k].f
          })

          const before = evaluate(d, a, baseCh)
          const after = evaluate(d, a, scaledCh)

          NUMERIC_IDS.forEach((id, k) => {
            const idx = CONSTRAINT_ORDER.indexOf(id)
            const b = before.constraints[idx]
            const c = after.constraints[idx]
            expect(c.id).toBe(id)
            expect(b.limit).toBeGreaterThan(0)
            expect(Number.isFinite(b.limit)).toBe(true)
            expect(c.value).toBe(b.value) // value unchanged by limit scaling
            expect(c.limit).toBe(scaledCh.constraints[LIMIT_KEY[id]])
            if (scales[k].tighten && !b.passed) expect(c.passed).toBe(false)
            if (!scales[k].tighten && b.passed) expect(c.passed).toBe(true)
          })
        },
      ),
    )
  })
})
