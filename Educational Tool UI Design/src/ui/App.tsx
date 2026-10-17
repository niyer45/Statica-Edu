import { useState } from 'react'
import CatalogHost, { type RunnableChallenge } from './shell/CatalogHost'
import { bundledChallengeJson } from '../challenge/bundled'
import { catalog, type CatalogEntry } from '../challenge/catalog'
import { loadChallenge } from '../challenge/loader'
import type { Challenge, Result, SchemaIssue } from '../challenge/types'
import { bootstrap, randomIdFactory, systemClock, type BootFailure, type Clock, type IdFactory } from './state/bootstrap'
import type { SessionStorage } from '../state/persistence'

// Lazy browser access keeps storage exceptions inside the persistence controller.
const browserStorage: SessionStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
}

// App bootstrap (task 13.2; Req 3.3, 3.7, 35.1; task 34.1 step 2).
// Loads every bundled challenge an available catalog entry links to (MM-06), builds each
// session, and either shows a full-page error that lists every issue of the first failing
// challenge (no challenge content, controls, or simulation) or mounts the challenge host,
// which owns one store per active challenge (ui/shell/CatalogHost).

/** Boots each available entry's bundled challenge, in catalog order. Stops at the first failure. */
export function bootCatalog(entries: readonly CatalogEntry[], clock: Clock, newId: IdFactory): Result<RunnableChallenge[], BootFailure> {
  const runnable: RunnableChallenge[] = []
  for (const entry of entries) {
    if (!entry.available) continue
    const boot = bootstrap(loadChallenge(bundledChallengeJson(entry.challengeId)), clock, newId)
    if (!boot.ok) return boot
    runnable.push(boot.value)
  }
  if (runnable.length === 0) {
    return { ok: false, error: { source: 'challenge', message: 'No challenge is available.', issues: [] } }
  }
  return { ok: true, value: runnable }
}

export interface AppProps {
  /** Loader result for a single challenge to boot from; defaults to every available bundled challenge. */
  loaded?: Result<Challenge, SchemaIssue[]>
  clock?: Clock
  newId?: IdFactory
}

export function BootErrorPage({ failure }: { failure: BootFailure }) {
  return (
    <main
      className="boot-error mx-auto max-w-3xl p-8 text-[#1f2933]"
      role="alert"
      aria-labelledby="boot-error-title"
    >
      <h1 id="boot-error-title" className="mb-3 text-2xl font-semibold">
        Statica could not load this challenge
      </h1>
      <p className="mb-4">{failure.message}</p>
      <ul aria-label="Challenge problems" className="mb-4 list-disc space-y-1 pl-6">
        {failure.issues.map((issue, i) => (
          <li key={i}>
            {issue.path !== '' && <code>{issue.path}</code>}
            {issue.rule !== '' && <span> ({issue.rule})</span>}
            {(issue.path !== '' || issue.rule !== '') && ': '}
            {issue.message}
          </li>
        ))}
      </ul>
      <p>Ask your instructor to check the challenge file. No simulation is available until it is fixed.</p>
    </main>
  )
}

export default function App({ loaded, clock = systemClock, newId = randomIdFactory }: AppProps) {
  // Boot once per mount; the session id and timestamp come from the injected sources.
  const [boot] = useState((): Result<RunnableChallenge[], BootFailure> => {
    if (loaded === undefined) return bootCatalog(catalog, clock, newId)
    const single = bootstrap(loaded, clock, newId)
    return single.ok ? { ok: true, value: [single.value] } : single
  })
  if (!boot.ok) return <BootErrorPage failure={boot.error} />
  return <CatalogHost runnable={boot.value} storage={browserStorage} clock={clock} newId={newId} />
}
