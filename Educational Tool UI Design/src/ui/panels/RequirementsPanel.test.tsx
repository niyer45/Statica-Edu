import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { bundledChallenge } from '../../../test/arbitraries'
import { createHarness } from '../../../test/state/model'
import { reference, tinyCircle, wideI } from '../../../test/fixtures/designs'
import { sessionReducer } from '../../state/reducer'
import type { SessionState } from '../../state/session'
import { exportDesign } from '../../state/importExport'
import StoreProvider from '../state/StoreProvider'
import { useStore, type Store } from '../state/store'
import RequirementsPanel from './RequirementsPanel'
import PredictionDialog from '../dialogs/PredictionDialog'
const ch = bundledChallenge()
afterEach(cleanup)
function mount(design?: typeof reference.design, details = true) {
  let s: SessionState = { ...createHarness(ch).real.state, mode: 'parametric' }
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
it('shows only the stored constraint table inside collapsed test details', () => {
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
  expect(screen.queryByLabelText('Result status')).toBeNull()
  expect(screen.queryByLabelText('Test status')).toBeNull()
  expect(disclosure.querySelectorAll('p')).toHaveLength(0)
  expect(screen.queryByText('College details')).toBeNull()
  expect(screen.queryByLabelText('Explanation facts')).toBeNull()
})
it('leaves displayed numbers unchanged during edits and records a new result after prediction', () => {
  const store = mount()
  fireEvent.click(screen.getByText('Test details'))
  const table = screen.getByRole('table').textContent
  // The baseline is an I-section, so a tube is a real change of section.
  act(() => store().dispatch({ type: 'applySection', kind: 'tube' }))
  expect(screen.getByRole('table').textContent).toBe(table)
  expect(store().state.draftStatus).toBe('draft')
  fireEvent.click(screen.getByRole('button', { name: 'Run Test' }))
  fireEvent.click(screen.getByLabelText('Decrease'))
  fireEvent.click(screen.getByText('Run structural test'))
  expect(store().state.history).toHaveLength(2)
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
  expect(screen.queryByLabelText('Result status')).toBeNull()
  fireEvent.click(screen.getByText('Test details'))
  expect(screen.getAllByText('Outside model assumptions')).toHaveLength(8)
  expect(screen.getByRole('list', { name: 'Model applicability reasons' }).textContent!.length).toBeGreaterThan(0)
})
