import fc from 'fast-check'

/** Fixed seed so property runs are reproducible across machines and CI. */
export const FIXED_SEED = 20240611

export type PbtParams = { numRuns: number; seed: number }

/** Default fast-check parameters. Override run count with PBT_RUNS (e.g. PBT_RUNS=2000). */
export function pbtParams(): PbtParams {
  return { numRuns: Number(process.env.PBT_RUNS ?? 200), seed: FIXED_SEED }
}

/**
 * Runs a synchronous property with pbtParams(). On failure, throws with the seed,
 * path, and shrunk counterexample at the top of the message so the run can be replayed
 * (pass `{ seed, path }` as overrides to reproduce).
 */
export function assertProperty<Ts>(
  property: fc.IProperty<Ts>,
  overrides: Partial<fc.Parameters<Ts>> = {},
): void {
  const params = { ...pbtParams(), ...overrides }
  const details = fc.check(property, params)
  if (!details.failed) return

  const cause = details.errorInstance
  const reason = cause instanceof Error ? cause.message : String(cause)
  throw new Error(
    `Property failed (seed: ${details.seed}, path: "${details.counterexamplePath}", numRuns: ${params.numRuns})\n` +
      `Counterexample: ${fc.stringify(details.counterexample)}\n` +
      `Reason: ${reason}`,
  )
}
