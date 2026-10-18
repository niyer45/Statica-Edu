import { useState } from 'react'
import CatalogHost, { type RunnableChallenge } from './shell/CatalogHost'
import { bundledChallengeJson } from '../challenge/bundled'
import { catalog, type CatalogEntry } from '../challenge/catalog'
import type { Challenge, Result, SchemaIssue } from '../challenge/types'
import { runtimeForJson } from '../state/runtimes'
import { modelUiFor } from './models/registry'
import { bootstrap, bootstrapWith, randomIdFactory, systemClock, type BootFailure, type Clock, type IdFactory } from './state/bootstrap'
import type { AccountProvider } from '../account/types'
import AccountHost from './account/AccountContext'
import { createBrowserAccountProvider } from './account/browser'
import { replaceRoute } from './shell/routes'

// App bootstrap (task 13.2; Req 3.3, 3.7, 35.1; task 34.1 step 2).
// Loads every bundled challenge an available catalog entry links to (MM-06), builds each
// session, and either shows a full-page error that lists every issue of the first failing
// challenge (no challenge content, controls, or simulation) or mounts the challenge host,
// which owns one store per active challenge (ui/shell/CatalogHost).
// Task 38: an AccountHost wraps the challenge host. Guests keep the original `ei:session:...`
// keys; a signed-in user's host reads and writes the same keys under `ei:user:<id>:` and is
// remounted on every sign-in/sign-out, so no store state crosses accounts.

/** Boots each available entry's bundled challenge, in catalog order. Stops at the first failure. */
export function bootCatalog(entries: readonly CatalogEntry[], clock: Clock, newId: IdFactory): Result<RunnableChallenge[], BootFailure> {
  const runnable: RunnableChallenge[] = []
  for (const entry of entries) {
    if (!entry.available) continue
    const json = bundledChallengeJson(entry.challengeId)
    // The config's declared model selects its loader and runtime; never a substitute (MM-02, MM-07).
    const runtime = runtimeForJson(json)
    if (runtime === undefined) {
      return { ok: false, error: { source: 'challenge', message: 'The challenge uses an analysis model that is not available.', issues: [{ path: 'model', rule: 'MODEL_NOT_REGISTERED', message: `Challenge "${entry.challengeId}" declares an unregistered model.` }] } }
    }
    const boot = bootstrapWith(runtime.load(json), clock, newId, (ref) => modelUiFor(ref) !== undefined)
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
  /** Account provider; defaults to the browser-local provider (localStorage + WebCrypto). */
  accounts?: AccountProvider
}

const landOnHome = () => replaceRoute('Home')

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

export default function App({ loaded, clock = systemClock, newId = randomIdFactory, accounts }: AppProps) {
  const [provider] = useState(() => accounts ?? createBrowserAccountProvider())
  // Boot once per mount; the session id and timestamp come from the injected sources.
  const [boot] = useState((): Result<RunnableChallenge[], BootFailure> => {
    if (loaded === undefined) return bootCatalog(catalog, clock, newId)
    const single = bootstrap(loaded, clock, newId)
    return single.ok ? { ok: true, value: [single.value] } : single
  })
  if (!boot.ok) return <BootErrorPage failure={boot.error} />
  return (
    <AccountHost provider={provider} onSessionChange={landOnHome}>
      {(storage, workspaceKey) => <CatalogHost key={workspaceKey} runnable={boot.value} storage={storage} clock={clock} newId={newId} routed />}
    </AccountHost>
  )
}
