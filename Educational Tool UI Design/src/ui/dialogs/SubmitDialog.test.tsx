import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { bundledChallenge } from '../../../test/arbitraries'
import { createHarness } from '../../../test/state/model'
import { sequenceHarness } from '../../../test/state/sequence'
import StoreProvider from '../state/StoreProvider'
import SubmitDialog from './SubmitDialog'
afterEach(cleanup)
it('shows both disabled reasons when baseline and reflection are empty', () => {
  render(<StoreProvider challenge={bundledChallenge()} initialSession={createHarness(bundledChallenge()).real.state}><SubmitDialog open onClose={() => {}} onExit={() => {}} /></StoreProvider>)
  expect(screen.getByText(/Run at least one/)).toBeTruthy()
  expect(screen.getByText(/Enter a non-whitespace/)).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Submit design & reflection' }) as HTMLButtonElement).disabled).toBe(true)
})
it('lists only tested iterations, preselects latest, preserves ungraded text and displays stored status/efficiency', () => {
  const state = sequenceHarness(() => {}).real.state
  render(<StoreProvider challenge={bundledChallenge()} initialSession={state}><SubmitDialog open onClose={() => {}} onExit={() => {}} /></StoreProvider>)
  const select = screen.getByLabelText('Iteration to submit') as HTMLSelectElement
  expect(select.options.length).toBe(4)
  expect(select.value).toBe(state.history[4]!.id)
  const input = screen.getByRole('textbox')
  expect(input.getAttribute('maxlength')).toBe('2000')
  fireEvent.change(input, { target: { value: '  <script>literal</script>  ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit design & reflection' }))
  const status = screen.getByLabelText('Recorded submission').textContent
  expect(status).toContain('Submitted iteration 4: Not accepted')
  expect(screen.getByLabelText('Submission efficiency')).toBeTruthy()
  expect(document.querySelector('script')).toBeNull()
  fireEvent.change(input, { target: { value: 'different reflection' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit design & reflection' }))
  expect(screen.getByLabelText('Recorded submission').textContent).toBe(status)
  fireEvent.change(input, { target: { value: ' ' } })
  expect(screen.getByText(/Enter a non-whitespace/)).toBeTruthy()
})
it('offers Back to challenges and Return to this challenge once a submission is recorded (task 61)', () => {
  const state = sequenceHarness(() => {}).real.state
  const calls: string[] = []
  render(<StoreProvider challenge={bundledChallenge()} initialSession={state}><SubmitDialog open onClose={() => calls.push('close')} onExit={() => calls.push('exit')} /></StoreProvider>)
  expect(screen.queryByRole('button', { name: 'Back to challenges' })).toBeNull()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'reflection' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit design & reflection' }))
  const back = screen.getByRole('button', { name: 'Back to challenges' })
  expect(document.activeElement).toBe(back)
  fireEvent.click(screen.getByRole('button', { name: 'Return to this challenge' }))
  expect(calls).toEqual(['close'])
  fireEvent.click(back)
  expect(calls).toEqual(['close', 'close', 'exit'])
})
