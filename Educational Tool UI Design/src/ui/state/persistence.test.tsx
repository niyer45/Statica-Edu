import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { bundledChallenge } from '../../../test/arbitraries'
import { createHarness } from '../../../test/state/model'
import { deserializeSession, sessionKey, STORAGE_FAILURE, type SessionStorage } from '../../state/persistence'
import StoreProvider from './StoreProvider'
import { useStore, type Store } from './store'
const ch = bundledChallenge()
const clock = () => '2026-10-15T00:00:00.000Z'
afterEach(cleanup)
function mount(storage: SessionStorage) {
  const ref: { current?: Store } = {}
  function Probe() { ref.current = useStore(); return null }
  let n = 0
  const view = render(<StoreProvider challenge={ch} initialSession={{ ...createHarness(ch).real.state, mode: 'parametric' }} storage={storage} clock={clock} newId={() => `test-${++n}`}><Probe /></StoreProvider>)
  return { ...view, store: () => ref.current! }
}
it('loads before children render and persists every action synchronously, including batched actions', () => {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: (key) => { values.delete(key) } }
  const app = mount(storage)
  act(() => {
    app.store().dispatch({ type: 'setPrediction', direction: 'same', now: clock() })
    app.store().runTest()
    const saved = deserializeSession(values.get(sessionKey(ch))!, ch)
    expect(saved.ok && saved.value.history.length).toBe(2)
    app.store().dispatch({ type: 'setReflection', text: 'preserved' })
    app.store().submit('test-1')
  })
  const expected = app.store().state
  app.unmount()
  const restored = mount(storage)
  expect(restored.store().state).toEqual(expected)
  expect(restored.store().state.submission?.reflection).toBe('preserved')
})
it('falls back to memory with one visible notice on throwing storage', () => {
  const fail = () => { throw new Error('blocked') }
  const app = mount({ getItem: fail, setItem: fail, removeItem: fail })
  expect(app.store().state.ui.notice?.message).toBe(STORAGE_FAILURE)
  act(() => app.store().dispatch({ type: 'applySection', kind: 'rectangle' }))
  expect(app.store().state.draft.section.kind).toBe('rectangle')
})
