import { createLocalAccountProvider } from '../../account/localProvider'
import type { CryptoLike } from '../../account/password'
import type { AccountProvider, KeyValueStorage } from '../../account/types'
import { randomIdFactory, systemClock } from '../state/bootstrap'

// Browser adapters for the local account provider (task 38). Storage access is lazy, so a
// browser that blocks localStorage throws inside the provider/persistence controllers, which
// already turn storage exceptions into notices.

export const browserStorage: KeyValueStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
  keys: () => {
    const out: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key !== null) out.push(key)
    }
    return out
  },
}

/** WebCrypto is only exposed on secure origins (https, localhost); otherwise accounts report unavailable. */
function browserCrypto(): CryptoLike | undefined {
  const c = typeof window !== 'undefined' ? window.crypto : undefined
  return c?.subtle && typeof c.getRandomValues === 'function' ? (c as CryptoLike) : undefined
}

export function createBrowserAccountProvider(): AccountProvider {
  return createLocalAccountProvider({ storage: browserStorage, crypto: browserCrypto(), clock: systemClock, newId: randomIdFactory })
}
