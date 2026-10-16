import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { sequenceHarness } from '../../../test/state/sequence'
import { bundledChallenge } from '../../../test/arbitraries'
import StoreProvider from '../state/StoreProvider'
import { useStore, type Store } from '../state/store'
import HistoryCompare from './HistoryCompare'
afterEach(cleanup)
it('blocks the fourth comparison, computes deltas, restores a draft and supports keyboard tabs', () => {
  const initial = sequenceHarness(() => {}).real.state
  let store: Store
  function Probe() { store = useStore(); return null }
  render(<StoreProvider challenge={bundledChallenge()} initialSession={initial}><Probe /><HistoryCompare /></StoreProvider>)
  for (let i = 1; i <= 3; i++) fireEvent.click(screen.getByLabelText(`Compare Iteration ${i}`))
  fireEvent.click(screen.getByLabelText('Compare Iteration 4'))
  expect(store!.state.compareSelection).toHaveLength(3)
  expect(screen.getByText(/At most three/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Restore Iteration 2' }))
  expect(store!.state.draft.section).toEqual(initial.history[2]!.designSnapshot.section)
  expect(store!.state.draftStatus).toBe('draft')
  const history = screen.getByRole('tab', { name: 'Design history' })
  fireEvent.keyDown(history, { key: 'ArrowRight' })
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Compare results' }))
  const baseline = screen.getByRole('table', { name: 'Baseline differences' })
  expect(baseline.textContent).toContain('—')
  const first = screen.getByRole('table', { name: 'Iteration 1 differences' })
  const row = within(first).getAllByRole('row')[1]!
  const cells = within(row).getAllByRole('cell')
  expect(cells[1]!.textContent).toBe(cells[2]!.textContent)
  act(() => store!.dispatch({ type: 'toggleCompare', testResultId: initial.history[1]!.id }))
  const second = screen.getByRole('table', { name: 'Iteration 2 differences' })
  expect(second.textContent).toContain('Δ vs previous iteration')
  expect(store!.state.history).toBe(initial.history)
})
