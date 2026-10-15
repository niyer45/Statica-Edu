import { deepFreeze } from '../../challenge/deepFreeze'
import type { SessionState } from '../../state/session'

// `window.__EI_STATE__` test hook (Req 23.10, 23.11).
// Dev and test builds expose a deep-frozen copy of the session through a getter with no
// setter. Production builds fold `SNAPSHOT_ENABLED` to false, so the hook is dead code and
// `window.__EI_STATE__` stays undefined.

declare global {
  interface Window {
    readonly __EI_STATE__?: Readonly<SessionState>
  }
}

export const SNAPSHOT_ENABLED: boolean = import.meta.env.DEV || import.meta.env.MODE === 'test'

const KEY = '__EI_STATE__'

function frozenCopy(s: SessionState): Readonly<SessionState> {
  return deepFreeze(structuredClone(s))
}

/** Publishes a read-only snapshot of `s`. No-op in production builds. */
export function publishSnapshot(s: SessionState): void {
  if (!SNAPSHOT_ENABLED || typeof window === 'undefined') return
  const snapshot = frozenCopy(s)
  Object.defineProperty(window, KEY, {
    configurable: true,
    enumerable: false,
    get: () => snapshot,
  })
}

/** Removes the snapshot (provider unmount). No-op in production builds. */
export function clearSnapshot(): void {
  if (!SNAPSHOT_ENABLED || typeof window === 'undefined') return
  Reflect.deleteProperty(window, KEY)
}
