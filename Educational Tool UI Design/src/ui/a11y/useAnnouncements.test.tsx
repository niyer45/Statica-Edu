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
  const view = render(<StoreProvider challenge={bundledChallenge()} initialSession={{ ...createHarness(bundledChallenge()).real.state, mode: 'parametric' }}><Probe /></StoreProvider>)
  const button = view.getByRole('button'); button.focus()
  // The baseline is an I-section, so a rectangle is a real change of section.
  act(() => store!.dispatch({ type: 'applySection', kind: 'rectangle' }))
  expect(store!.state.draft.section.kind).toBe('rectangle')
  expect(announce).toHaveBeenLastCalledWith('Section applied: Rectangle.')
  act(() => { store!.dispatch({ type: 'setPrediction', direction: 'decrease', now: 't' }); store!.runTest() })
  expect(announce.mock.lastCall![0]).toMatch(/Test 1: .*; \d+ failed constraints/)
  expect(document.activeElement).toBe(button)
  act(() => store!.dispatch({ type: 'restore', testResultId: 'model:baseline' }))
  expect(announce).toHaveBeenLastCalledWith('Restored Baseline.')
  expect(announce).toHaveBeenCalledTimes(3)
})

it('adds Guided step completion to the test announcement (task 58)', () => {
  const announce = vi.fn()
  let store: Store
  function Probe() { store = useStore(); useAnnouncements(announce); return null }
  render(<StoreProvider challenge={bundledChallenge()} initialSession={{ ...createHarness(bundledChallenge()).real.state, mode: 'guided' }}><Probe /></StoreProvider>)
  act(() => store!.dispatch({ type: 'applySection', kind: 'iSection' }))
  expect(announce).toHaveBeenLastCalledWith('Section shape is locked in this Guided step. Editable now: Depth (diameter or height).')
  act(() => store!.dispatch({ type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' }))
  act(() => { store!.dispatch({ type: 'setPrediction', direction: 'decrease', now: 't' }); store!.runTest() })
  expect(announce.mock.lastCall![0]).toMatch(/^Test 1: .*failed constraints\. Guided step 1 complete: Make it deeper\. Next: Try another shape\.$/)
})
