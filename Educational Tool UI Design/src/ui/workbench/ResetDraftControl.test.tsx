import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BUNDLED_CHALLENGE_JSON } from '../../challenge/bundled'
import { isFreshSession, requireModel } from '../../state/models'
import { runtimeForJson, type AnyRuntime, type LoopChallenge, type ModelRuntime } from '../../state/runtimes'
import type { SessionStorage } from '../../state/persistence'
import { RESET_DRAFT_ANNOUNCEMENT, useAnnouncements } from '../a11y/useAnnouncements'
import StoreProvider from '../state/StoreProvider'
import { useModelStore, type Store } from '../state/store'
import ResetDraftControl, { RESET_DRAFT_LABEL } from './ResetDraftControl'

// Task 60 (owner amendment): the shared Reset to baseline control for every model starts the
// challenge over (design, test history, reflection, submission). The edit imports the challenge's
// own reference design, so no model parameters are hard-coded here.

const clock = () => '2026-10-18T09:00:00.000Z'
let n = 0
const newId = () => `id-${++n}`

type Ch = LoopChallenge & { initialDesign: unknown; referenceDesign: unknown }
type S = Parameters<typeof isFreshSession>[1] & { draftStatus: string; mode: string; history: ReadonlyArray<{ id: string }> }

function memory(): SessionStorage & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return { values, getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
}

function renderControl(id: string, storage: SessionStorage | null = null) {
  const json = BUNDLED_CHALLENGE_JSON[id]
  const runtime = runtimeForJson(json) as AnyRuntime
  const loaded = runtime.load(json)
  if (!loaded.ok) throw new Error('bundled challenge did not load')
  const ch = loaded.value as Ch
  const init = runtime.init(ch, clock(), 'baseline')
  if (!init.ok) throw new Error(init.error.message)
  const announce = vi.fn()
  const ref: { store?: Store<S, { type: string; [k: string]: unknown }, Ch> } = {}
  function Probe() {
    ref.store = useModelStore<S, { type: string; [k: string]: unknown }, Ch>()
    useAnnouncements(announce)
    return null
  }
  render(
    <StoreProvider challenge={ch as never} initialSession={init.value} runtime={runtime as unknown as ModelRuntime} storage={storage} clock={clock} newId={newId}>
      <Probe />
      <ResetDraftControl />
    </StoreProvider>,
  )
  const exported = (requireModel(ch) as unknown as { exportDesign(d: unknown, c: unknown): string }).exportDesign(ch.referenceDesign, ch)
  const edit = () => act(() => ref.store!.dispatch({ type: 'importDesign', json: exported }))
  const test = () => act(() => { ref.store!.dispatch({ type: 'setPrediction', direction: 'decrease', now: clock() }); ref.store!.runTest() })
  return { ch, runtime, announce, edit, test, store: () => ref.store! }
}

const button = () => screen.getByRole('button', { name: RESET_DRAFT_LABEL })

afterEach(cleanup)

describe.each(Object.keys(BUNDLED_CHALLENGE_JSON))('Reset to baseline in %s', (id) => {
  it('is unavailable on a fresh start, confirms in a dialog, and starts the challenge over', () => {
    const { ch, announce, edit, test, store } = renderControl(id)
    expect(button().getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Nothing to reset yet.')).toBeTruthy()
    fireEvent.click(button())
    expect(screen.queryByRole('dialog')).toBeNull()

    edit()
    test()
    edit()
    expect(store().state.history).toHaveLength(2)
    expect(isFreshSession(ch, store().state)).toBe(false)
    expect(button().getAttribute('aria-disabled')).toBe('false')
    const before = store().state

    // Cancel keeps everything.
    fireEvent.click(button())
    const dialog = screen.getByRole('dialog', { name: 'Reset this challenge?' })
    expect(dialog.textContent).toContain('clears your design, your test history, your reflection and any submission')
    expect(dialog.textContent).toContain('This cannot be undone.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(store().state).toBe(before)

    // Confirm starts over in the same mode and announces it once.
    fireEvent.click(button())
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Reset this challenge?' })).getByRole('button', { name: 'Reset challenge' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(isFreshSession(ch, store().state)).toBe(true)
    expect(store().state.history).toHaveLength(1)
    expect(store().state.mode).toBe(before.mode)
    expect(store().state.draftStatus).toBe('tested')
    expect(announce).toHaveBeenLastCalledWith(RESET_DRAFT_ANNOUNCEMENT)
    expect(announce.mock.calls.filter(([m]) => m === RESET_DRAFT_ANNOUNCEMENT)).toHaveLength(1)
    expect(button().getAttribute('aria-disabled')).toBe('true')
  })

  it('saves the reset session like any other action', () => {
    const storage = memory()
    const { ch, runtime, edit, test } = renderControl(id, storage)
    edit()
    test()
    fireEvent.click(button())
    fireEvent.click(screen.getByRole('button', { name: 'Reset challenge' }))
    const raw = storage.values.get(runtime.key(ch))
    expect(raw).toBeDefined()
    const restored = runtime.deserialize(raw!, ch)
    expect(restored.ok && isFreshSession(ch, restored.value as unknown as S)).toBe(true)
  })
})
