import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { catalog, type CatalogEntry } from '../../challenge/catalog'
import { bundledChallengeResult } from '../../challenge/content'
import { deepFreeze } from '../../challenge/deepFreeze'
import type { Challenge } from '../../challenge/types'
import { serializeSession, sessionKey, type SessionStorage } from '../../state/persistence'
import { sessionReducer } from '../../state/reducer'
import type { SessionState } from '../../state/session'
import { bootstrap } from '../state/bootstrap'
import CatalogHost, { type RunnableChallenge } from './CatalogHost'

// Task 34.1 step 2 (MM-16, MM-23): per-challenge stores and saves. Uses a second beam-model
// challenge registered in this test only; the bundled catalog still links one challenge.

const clock = () => '2026-10-17T00:00:00.000Z'
let ids = 0
const newId = () => `id-${++ids}`

if (!bundledChallengeResult.ok) throw new Error('bundled challenge must load')
const beam1 = bundledChallengeResult.value
const beam2: Challenge = deepFreeze({ ...structuredClone(beam1), id: 'test-beam-2', title: 'Test Beam II' }) as Challenge
const entries: CatalogEntry[] = [
  ...catalog,
  { id: '901', title: 'Test Beam II', description: 'Test-only second runnable challenge.', discipline: 'Mechanics', difficulty: 'introductory', time: '5 min', concepts: ['Bending'], available: true, challengeId: 'test-beam-2', art: 'beam' },
]

function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
  return { values, storage }
}

function boot(ch: Challenge): RunnableChallenge {
  const b = bootstrap({ ok: true, value: ch }, clock, newId)
  if (!b.ok) throw new Error(b.error.message)
  return b.value
}

/** A saved Beam I session with one tested iteration and a reflection. */
function savedBeam1(): string {
  let s: SessionState = boot(beam1).session
  s = sessionReducer(s, { type: 'applySection', kind: 'tube' }, beam1)
  s = sessionReducer(s, { type: 'setPrediction', direction: 'decrease', now: clock() }, beam1)
  s = sessionReducer(s, { type: 'runTest', now: clock(), id: 'beam1-test-1' }, beam1)
  s = sessionReducer(s, { type: 'setReflection', text: 'Beam I notes' }, beam1)
  return serializeSession(s, clock())
}

const snapshot = () => window.__EI_STATE__!
function openFromLibrary(title: string, mode: 'Guided' | 'Parametric') {
  fireEvent.click(screen.getByRole('button', { name: `View ${title}` }))
  const drawer = screen.getByRole('dialog', { name: title })
  fireEvent.click(within(drawer).getByRole('button', { name: new RegExp(mode) }))
  fireEvent.click(within(drawer).getByRole('button', { name: 'Open challenge' }))
}
const navigate = (name: string) => fireEvent.click(within(screen.getByRole('navigation', { name: 'Platform' })).getByRole('button', { name: new RegExp(name) }))

afterEach(cleanup)

describe('CatalogHost multi-challenge isolation', () => {
  it('opens another runnable challenge in its own store and save without leaking work', () => {
    const { values, storage } = memory()
    values.set(sessionKey(beam1), savedBeam1())
    const beam1Saved = values.get(sessionKey(beam1))
    render(<CatalogHost runnable={[boot(beam1), boot(beam2)]} entries={entries} storage={storage} clock={clock} newId={newId} />)

    expect(snapshot().challengeId).toBe('cantilever-beam-1')
    expect(snapshot().history).toHaveLength(2)

    openFromLibrary('Test Beam II', 'Parametric')
    expect(snapshot().challengeId).toBe('test-beam-2')
    expect(snapshot().mode).toBe('parametric')
    expect(snapshot().history).toHaveLength(1)
    expect(snapshot().reflectionAnswer).toBe('')
    expect(screen.getByTestId('workbench-host').hidden).toBe(false)
    // The pre-entry mode choice is persisted under the second challenge's own key only.
    expect(JSON.parse(values.get(sessionKey(beam2))!).session.mode).toBe('parametric')
    expect(values.get(sessionKey(beam1))).toBe(beam1Saved)
  })

  it('switching back restores the first challenge from its own save', () => {
    const { values, storage } = memory()
    values.set(sessionKey(beam1), savedBeam1())
    render(<CatalogHost runnable={[boot(beam2), boot(beam1)]} entries={entries} storage={storage} clock={clock} newId={newId} />)
    expect(snapshot().challengeId).toBe('test-beam-2')
    openFromLibrary('Cantilever Beam I', 'Guided')
    expect(snapshot().challengeId).toBe('cantilever-beam-1')
    expect(snapshot().history.map((r) => r.id)).toContain('beam1-test-1')
    expect(snapshot().reflectionAnswer).toBe('Beam I notes')
    expect(snapshot().mode).toBe('guided')
  })

  it('attributes My designs cards to each started challenge and returns to the right one', () => {
    const { values, storage } = memory()
    values.set(sessionKey(beam1), savedBeam1())
    render(<CatalogHost runnable={[boot(beam1), boot(beam2)]} entries={entries} storage={storage} clock={clock} newId={newId} />)
    openFromLibrary('Test Beam II', 'Guided')
    navigate('My designs')
    expect(screen.getByRole('article', { name: 'Test Beam II workspace' })).toBeTruthy()
    const other = screen.getByRole('article', { name: 'Cantilever Beam I workspace' })
    expect(within(other).getByText('SAVED WORKSPACE')).toBeTruthy()
    fireEvent.click(within(other).getByRole('button', { name: 'Return to Cantilever Beam I' }))
    expect(snapshot().challengeId).toBe('cantilever-beam-1')
    expect(snapshot().reflectionAnswer).toBe('Beam I notes')
  })

  it('keeps notebook text and saved library cards across a challenge switch', () => {
    const { storage } = memory()
    render(<CatalogHost runnable={[boot(beam1), boot(beam2)]} entries={entries} storage={storage} clock={clock} newId={newId} />)
    navigate('Notebook')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'cross-challenge note' } })
    navigate('Challenges')
    openFromLibrary('Test Beam II', 'Guided')
    navigate('Notebook')
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('cross-challenge note')
  })

  it('a corrupt save of one challenge restarts only that challenge, with a notice', () => {
    const { values, storage } = memory()
    values.set(sessionKey(beam1), savedBeam1())
    values.set(sessionKey(beam2), '{"schemaVersion":1,"truncated"')
    const beam1Saved = values.get(sessionKey(beam1))
    render(<CatalogHost runnable={[boot(beam1), boot(beam2)]} entries={entries} storage={storage} clock={clock} newId={newId} />)
    openFromLibrary('Test Beam II', 'Guided')
    expect(snapshot().challengeId).toBe('test-beam-2')
    expect(snapshot().history).toHaveLength(1)
    expect(snapshot().ui.notice?.message).toBe('Saved session could not be restored')
    expect(values.get(sessionKey(beam1))).toBe(beam1Saved)
  })

  it('without injected storage uses its own memory store and never reads other storage', () => {
    const { values, storage } = memory()
    let s: SessionState = boot(beam1).session
    s = sessionReducer(s, { type: 'setReflection', text: 'kept in memory' }, beam1)
    values.set(sessionKey(beam1), serializeSession(s, clock()))
    // The host copies nothing from `storage` here; it starts with its own empty memory store.
    render(<CatalogHost runnable={[boot(beam2), boot(beam1)]} entries={entries} clock={clock} newId={newId} />)
    openFromLibrary('Cantilever Beam I', 'Parametric')
    expect(snapshot().challengeId).toBe('cantilever-beam-1')
    expect(snapshot().reflectionAnswer).toBe('')
    expect(snapshot().mode).toBe('parametric')
    expect(storage.getItem(sessionKey(beam2))).toBeNull()
  })

  it('behaves as the single-challenge shell when only one challenge is runnable', () => {
    render(<CatalogHost runnable={[boot(beam1)]} clock={clock} newId={newId} />)
    for (const c of catalog) expect(screen.getByRole('button', { name: `View ${c.title}` })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'View Mounting Bracket I' }))
    expect(within(screen.getByRole('dialog', { name: 'Mounting Bracket I' })).getByRole('button', { name: /Not available yet/ }).hasAttribute('disabled')).toBe(true)
  })
})
