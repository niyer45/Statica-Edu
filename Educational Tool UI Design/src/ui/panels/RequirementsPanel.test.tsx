import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { bundledChallenge } from '../../../test/arbitraries'
import { createHarness } from '../../../test/state/model'
import { reference, tinyCircle, wideI } from '../../../test/fixtures/designs'
import { sessionReducer } from '../../state/reducer'
import { exportDesign } from '../../state/importExport'
import StoreProvider from '../state/StoreProvider'
import { useStore, type Store } from '../state/store'
import RequirementsPanel from './RequirementsPanel'
import PredictionDialog from '../dialogs/PredictionDialog'
const ch = bundledChallenge()
afterEach(cleanup)
function mount(design?: typeof reference.design, details = true) {
  let s = createHarness(ch).real.state
  if (design) {
    s = sessionReducer(s, { type: 'importDesign', json: exportDesign(design, ch) }, ch)
    s = sessionReducer(s, { type: 'setPrediction', direction: 'decrease', now: 'p' }, ch)
    s = sessionReducer(s, { type: 'runTest', now: 't', id: 'recorded' }, ch)
  }
  let store: Store
  function Probe() { store = useStore(); return null }
  render(<StoreProvider challenge={{ ...ch, content: { ...ch.content, collegeDetails: details } }} initialSession={s}><Probe /><RequirementsPanel onOpenHelp={() => {}} /><PredictionDialog /></StoreProvider>)
  return () => store!
}
it('displays ordered stored constraints, fixed units, textual pass/fail and collapsed college details', () => {
  const store = mount(reference.design)
  const disclosure = screen.getByText('Test details').closest('details')!
  expect(disclosure.open).toBe(false)
  fireEvent.click(screen.getByText('Test details'))
  const table = screen.getByRole('table', { name: 'Latest tested results' })
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(7)
  store().state.history[1]!.evaluation.constraints.forEach((c, i) => expect(rows[i]!.textContent).toContain(c.label))
  expect(rows[0]!.textContent).toMatch(/\d+\.\d{2} mm/)
  expect(rows[1]!.textContent).toMatch(/\d+\.\d MPa/)
  expect(rows[2]!.textContent).toMatch(/\d+\.\d{3} kg/)
  expect(rows[5]!.textContent).toContain('Pass')
  expect(screen.getByLabelText('Result status').textContent).toContain('Accepted')
  expect(screen.getByText('College details').closest('details')!.open).toBe(false)
  fireEvent.click(screen.getByText('College details'))
  expect(screen.getByText('College details').closest('details')!.open).toBe(true)
})
it('leaves displayed numbers unchanged during edits and records a new result after prediction', () => {
  const store = mount()
  fireEvent.click(screen.getByText('Test details'))
  const table = screen.getByRole('table').textContent
  act(() => store().dispatch({ type: 'applySection', kind: 'iSection' }))
  expect(screen.getByRole('table').textContent).toBe(table)
  expect(screen.getByLabelText('Test status').textContent).toBe('Draft')
  fireEvent.click(screen.getByRole('button', { name: 'Run Test' }))
  fireEvent.click(screen.getByLabelText('Decrease'))
  fireEvent.click(screen.getByText('Run structural test'))
  expect(screen.getByLabelText('Test status').textContent).toBe('Tested #1')
  expect(screen.getByRole('table').textContent).not.toBe(table)
})
it('shows envelope failure from the evaluator and omits disabled college details', () => {
  mount(wideI.design, false)
  const list = screen.getByRole('list', { name: 'Design requirements' })
  expect(within(list).getByText('Section envelope').parentElement!.textContent).toContain('Fail')
  expect(screen.queryByText('College details')).toBeNull()
})
it('labels every out-of-assumption numeric result and lists applicability reasons', () => {
  mount(tinyCircle.design)
  expect(screen.getByLabelText('Result status').textContent).toContain('Model not applicable')
  fireEvent.click(screen.getByText('Test details'))
  expect(screen.getAllByText('Outside model assumptions')).toHaveLength(8)
  expect(screen.getByRole('list', { name: 'Model applicability reasons' }).textContent!.length).toBeGreaterThan(0)
})
