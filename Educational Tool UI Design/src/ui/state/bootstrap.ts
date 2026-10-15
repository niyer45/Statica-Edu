import type { Challenge, InteractionMode, Result, SchemaIssue } from '../../challenge/types'
import { initSession, type SessionState } from '../../state/session'

// App bootstrap (task 13.2; Req 3.3, 15.3, 35.1, 35.4).
// Turns the loader result for the bundled challenge into either a ready session or a
// full-page error that lists every problem. The clock and id factory are injected so the
// reducer stays pure and tests stay deterministic.

/** ISO-8601 timestamp source, called outside the reducer. */
export type Clock = () => string
/** Unique id source for Test_Results, called outside the reducer. */
export type IdFactory = () => string

export const systemClock: Clock = () => new Date().toISOString()

let fallbackCounter = 0
export const randomIdFactory: IdFactory = () => {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  fallbackCounter += 1
  return `tr-${Date.now().toString(36)}-${fallbackCounter}`
}

/** One line of the full-page error. `path`/`rule` are empty when not applicable. */
export interface BootIssue {
  path: string
  rule: string
  message: string
}

export interface BootFailure {
  source: 'challenge' | 'initialDesign'
  message: string
  /** Every issue, never truncated (Req 3.3). */
  issues: BootIssue[]
}

export interface BootSuccess {
  challenge: Challenge
  session: SessionState
}

/** True when `mode` is one of the challenge's allowed modes (Req 35.4). */
export function isModeAllowed(ch: Pick<Challenge, 'allowedModes'>, mode: InteractionMode): boolean {
  return ch.allowedModes.includes(mode)
}

/**
 * Builds the initial session for a loaded challenge. A requested mode outside
 * `allowedModes` falls back to the first allowed mode. Never throws.
 */
export function bootstrap(
  loaded: Result<Challenge, SchemaIssue[]>,
  clock: Clock,
  newId: IdFactory,
  mode?: InteractionMode,
): Result<BootSuccess, BootFailure> {
  if (!loaded.ok) {
    const n = loaded.error.length
    return {
      ok: false,
      error: {
        source: 'challenge',
        message: `The challenge content failed validation (${n} issue${n === 1 ? '' : 's'}).`,
        issues: loaded.error.map((i) => ({ path: i.path, rule: i.rule, message: i.message })),
      },
    }
  }
  const ch = loaded.value
  const start = mode !== undefined && isModeAllowed(ch, mode) ? mode : undefined
  const r = initSession(ch, clock(), newId(), start)
  if (!r.ok) {
    return {
      ok: false,
      error: {
        source: r.error.source,
        message: r.error.message,
        issues: r.error.details.map((message) => ({ path: 'initialDesign', rule: '', message })),
      },
    }
  }
  return { ok: true, value: { challenge: ch, session: r.value } }
}
