import { useMemo, useState } from 'react'
import type { CatalogEntry } from '../../challenge/catalog'
import type { Challenge, InteractionMode } from '../../challenge/types'
import { peekSession, type SessionStorage } from '../../state/persistence'
import { selectWorkspaceStarted } from '../../state/selectors'
import type { SessionState } from '../../state/session'
import type { Clock, IdFactory } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import PlatformShell, { type OtherChallenge } from './PlatformShell'

// Challenge host (task 34.1 step 2; multi-model-architecture MM-16, MM-23).
//
// One StoreProvider (store + persistence controller) exists for the active challenge only,
// keyed by challenge id, so switching unmounts the previous store after it has already saved
// synchronously, and mounts the next one from its own storage key. Draft, history, deletion,
// predictions, reflection, submission and mode therefore never cross challenges. Other runnable
// challenges are summarized read-only from storage (peekSession never writes or removes).
// Library-saved cards and notebook text are lifted here so a switch does not discard them.
// Without injected storage the host keeps an in-memory store so switching still preserves work
// for the page session.

export interface RunnableChallenge {
  challenge: Challenge
  /** Fresh session from bootstrap; persisted work replaces it on load. */
  session: SessionState
}

export interface CatalogHostProps {
  /** Non-empty; the first entry is active initially. */
  runnable: readonly RunnableChallenge[]
  entries?: readonly CatalogEntry[]
  storage?: SessionStorage | null
  clock: Clock
  newId: IdFactory
}

function memoryStorage(): SessionStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

export default function CatalogHost({ runnable, entries, storage = null, clock, newId }: CatalogHostProps) {
  const first = runnable[0]
  if (first === undefined) throw new Error('CatalogHost needs at least one runnable challenge.')
  const [store] = useState(() => storage ?? memoryStorage())
  const [active, setActive] = useState<{ id: string; mode?: InteractionMode }>({ id: first.challenge.id })
  const [saved, setSaved] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  const current = runnable.find((r) => r.challenge.id === active.id) ?? first
  // Summaries are re-read whenever the active challenge changes; the active store owns its own key.
  const others = useMemo<OtherChallenge[]>(
    () =>
      runnable
        .filter((r) => r.challenge.id !== current.challenge.id)
        .map((r) => {
          const s = peekSession(r.challenge, store)
          return {
            challengeId: r.challenge.id,
            title: r.challenge.title,
            allowedModes: r.challenge.allowedModes,
            ...(s ? { saved: { mode: s.mode, started: selectWorkspaceStarted(s) } } : {}),
          }
        }),
    [runnable, current, store],
  )

  return (
    <StoreProvider
      key={current.challenge.id}
      challenge={current.challenge}
      initialSession={current.session}
      storage={store}
      clock={clock}
      newId={newId}
    >
      <PlatformShell
        entries={entries}
        others={others}
        onOpenOther={(id, mode) => setActive({ id, mode })}
        enterOnMount={active.mode}
        saved={saved}
        onSavedChange={setSaved}
        notes={notes}
        onNotesChange={setNotes}
      />
    </StoreProvider>
  )
}
