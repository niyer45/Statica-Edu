import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createHarness } from '../../../test/state/model'
import { bundledChallenge } from '../../../test/arbitraries'
import StoreProvider from '../state/StoreProvider'
import { useStore, type Store } from '../state/store'
import { useAnnouncements } from './useAnnouncements'
afterEach(cleanup)
it('announces section, recorded test and restore once per event without moving focus', () => {
  const announce = vi.fn()
  let store: Store
  function Probe() { store = useStore(); useAnnouncements(announce); return <button>Focused</button> }
  const view = render(<StoreProvider challenge={bundledChallenge()} initialSession={createHarness(bundledChallenge()).real.state}><Probe /></StoreProvider>)
  const button = view.getByRole('button'); button.focus()
  act(() => store!.dispatch({ type: 'applySection', kind: 'iSection' }))
  expect(announce).toHaveBeenLastCalledWith('Section applied: I-section.')
  act(() => { store!.dispatch({ type: 'setPrediction', direction: 'decrease', now: 't' }); store!.runTest() })
  expect(announce.mock.lastCall![0]).toMatch(/Test 1: .*; \d+ failed constraints/)
  expect(document.activeElement).toBe(button)
  act(() => store!.dispatch({ type: 'restore', testResultId: 'model:baseline' }))
  expect(announce).toHaveBeenLastCalledWith('Restored Baseline.')
  expect(announce).toHaveBeenCalledTimes(3)
})
