import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { bundledChallenge } from '../../../test/arbitraries'
import { createHarness } from '../../../test/state/model'
import StoreProvider from '../state/StoreProvider'
import { useStore, type Store } from '../state/store'
import PredictionDialog from './PredictionDialog'
const ch = bundledChallenge()
afterEach(cleanup)
it('starts unselected, validates confirmation, cancels without a result and confirms using injected time/id', () => {
  let store: Store
  function Probe() { store = useStore(); return <button onClick={() => store.runTest()}>Test</button> }
  render(<StoreProvider challenge={ch} initialSession={createHarness(ch).real.state} clock={() => 'prediction-clock'} newId={() => 'result-id'}><Probe /><PredictionDialog /></StoreProvider>)
  fireEvent.click(screen.getByText('Test'))
  expect(screen.getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true)
  fireEvent.click(screen.getByText('Run structural test'))
  expect(screen.getByRole('alert').textContent).toContain('Select')
  fireEvent.click(screen.getByText('Cancel'))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(store!.state.history).toHaveLength(1)
  act(() => store!.runTest())
  fireEvent.click(screen.getByLabelText('Stay the same'))
  fireEvent.change(screen.getByLabelText(/Explanation/), { target: { value: 'same geometry' } })
  fireEvent.click(screen.getByText('Run structural test'))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(store!.state.history[1]).toMatchObject({ id: 'result-id', timestamp: 'prediction-clock', prediction: { createdAt: 'prediction-clock', explanation: 'same geometry' } })
})
