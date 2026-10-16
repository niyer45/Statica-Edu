import { useState } from 'react'
import PlatformShell from './shell/PlatformShell'
import { bundledChallengeResult } from '../challenge/content'
import type { Challenge, Result, SchemaIssue } from '../challenge/types'
import { bootstrap, randomIdFactory, systemClock, type BootFailure, type Clock, type IdFactory } from './state/bootstrap'
import StoreProvider from './state/StoreProvider'
import type { SessionStorage } from '../state/persistence'

// Lazy browser access keeps storage exceptions inside the persistence controller.
const browserStorage: SessionStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
}

// App bootstrap (task 13.2; Req 3.3, 3.7, 35.1).
// Loads the bundled challenge, builds the session, and either shows a full-page error that
// lists every issue (no challenge content, controls, or simulation) or mounts the store and
// the platform shell (ui/shell/PlatformShell, task 13.5).

export interface AppProps {
  /** Loader result to boot from; defaults to the bundled challenge. */
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

export default function App({ loaded = bundledChallengeResult, clock = systemClock, newId = randomIdFactory }: AppProps) {
  // Boot once per mount; the session id and timestamp come from the injected sources.
  const [boot] = useState(() => bootstrap(loaded, clock, newId))
  if (!boot.ok) return <BootErrorPage failure={boot.error} />
  return (
    <StoreProvider challenge={boot.value.challenge} initialSession={boot.value.session} storage={browserStorage} clock={clock} newId={newId}>
      <PlatformShell />
    </StoreProvider>
  )
}
