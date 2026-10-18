import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { heatSinkChallenge } from '../../../../test/fixtures/heatSink'
import { heatSinkRuntime, type ModelRuntime } from '../../../state/runtimes'
import type { SessionStorage } from '../../../state/persistence'
import StoreProvider from '../../state/StoreProvider'
import Workbench from '../../workbench/Workbench'
import { modelUiFor } from '../registry'
import { heatSinkUi, HEAT_SINK_LIMITS_NOTICE } from '.'

// Heat Sink I workbench (task 48.3) through the PRODUCTION model UI registry. The challenge is
// booted directly here; card activation is a separate, explicitly approved step (HSK-16).

const clock = () => '2026-10-17T00:00:00.000Z'
let n = 0
const newId = () => `h-${++n}`
const ch = heatSinkChallenge()

function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
  return { values, storage }
}

// Default Parametric: free editing. Guided locks parameters by step (task 58); see the mode test.
function renderHeatSink(mode: 'guided' | 'parametric' = 'parametric', storage?: SessionStorage) {
  const init = heatSinkRuntime.init(ch, clock(), 'base', mode)
  if (!init.ok) throw new Error('heat sink challenge must initialize')
  return render(
    <StoreProvider challenge={ch} initialSession={init.value} runtime={heatSinkRuntime as unknown as ModelRuntime} storage={storage ?? null} clock={clock} newId={newId}>
      <Workbench onExit={() => {}} />
    </StoreProvider>,
  )
}

const setField = (label: string, value: string) => {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}
const fieldValue = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value

/** Baseline → the spec's reference fin array (N = 10, t = 1.5 mm, H = 35 mm) with the iteration-1 prediction. */
function testReference() {
  setField('Fin thickness', '1.5')
  setField('Fin count', '10')
  setField('Fin height', '35')
  fireEvent.click(screen.getByRole('button', { name: 'Run Test' }))
  const dialog = screen.getByRole('dialog', { name: 'Predict base temperature rise' })
  expect(within(dialog).getByText('Compared with the Baseline, how will your new fin array change the base temperature rise?')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('radio', { name: /Decrease/ }))
  fireEvent.click(within(dialog).getByRole('button', { name: /Run structural test/ }))
}

afterEach(cleanup)

describe('Heat Sink I workbench', () => {
  it('is registered in the production model UI registry', () => {
    expect(modelUiFor(ch.model)).toBe(heatSinkUi)
  })

  it('shows the baseline temperature, mass and fin height failures with heat sink wording and no beam or torsion wording', () => {
    renderHeatSink()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(requirements).getByText('82.1 °C')).toBeTruthy()
    expect(within(requirements).getByText('136.1 g')).toBeTruthy()
    expect(within(requirements).getByText('40.0 mm')).toBeTruthy()
    expect(within(requirements).getByText('max 55.0 °C')).toBeTruthy()
    // The fin gap is a lower bound: shown as a minimum, and the baseline passes it.
    expect(within(requirements).getByText('min 4.00 mm')).toBeTruthy()
    expect(within(requirements).getAllByText('✗ Fail')).toHaveLength(3)
    expect(screen.getByText(HEAT_SINK_LIMITS_NOTICE)).toBeTruthy()
    expect(screen.getByRole('img', { name: /Front view across the heat sink: 3 fins on the base, drawn to scale, shaded/ })).toBeTruthy()
    for (const word of [/beam/i, /deflection/i, /torsion/i, /twist/i, /shaft/i]) expect(screen.queryByText(word)).toBeNull()
  })

  it('lists the stored fin profile as text alongside the shading, and drops the shading for an untested draft', () => {
    renderHeatSink()
    const table = screen.getByRole('table', { name: 'Fin temperature profile' })
    const rows = within(table).getAllByRole('row')
    // Header + the five stored samples, root first.
    expect(rows).toHaveLength(6)
    expect(within(rows[1]!).getByRole('rowheader').textContent).toBe('Root')
    expect(within(rows[5]!).getByRole('rowheader').textContent).toBe('Tip')
    expect(screen.getByText(/Fin color scale: 25\.0 °C \(air\)/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add a fin' }))
    expect(fieldValue('Fin count')).toBe('4')
    expect(screen.getByRole('img', { name: 'Front view across the heat sink: 4 fins on the base, drawn to scale' })).toBeTruthy()
    expect(screen.getByText(/shading appears after you test this design/)).toBeTruthy()
    expect(screen.queryByText(/Fin color scale/)).toBeNull()
  })

  it('runs the learning loop to an Accepted reference fin array with a scored base temperature rise prediction', () => {
    renderHeatSink()
    testReference()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(requirements).getByText('48.5 °C')).toBeTruthy()
    expect(within(requirements).getByText('123.9 g')).toBeTruthy()
    expect(within(requirements).getByText('5.00 mm')).toBeTruthy()
    expect(within(requirements).queryByText('✗ Fail')).toBeNull()
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    // The profile table now reports the reference fins (root 321.52 K, tip 319.23 K).
    const profile = screen.getByRole('table', { name: 'Fin temperature profile' })
    expect(within(profile).getByText('48.4 °C')).toBeTruthy()
    expect(within(profile).getByText('46.1 °C')).toBeTruthy()
    fireEvent.click(screen.getAllByText('Test details').at(-1)!)
    expect(screen.getByText(/Prediction: decrease · Actual: decrease · Matched/)).toBeTruthy()
  })

  it('rejects invalid fin input inline without changing the draft', () => {
    renderHeatSink()
    // 20 fins of 5 mm cannot fit across the 60 mm base.
    setField('Fin count', '20')
    const count = screen.getByLabelText('Fin count')
    expect(count.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(count.getAttribute('aria-describedby')!)!.textContent).toMatch(/^Fin count: Fins overlap/)
    fireEvent.keyDown(count, { key: 'Escape' })
    expect(fieldValue('Fin count')).toBe('3')
    // Off the 0.5 mm thickness grid: rejected by the model, draft unchanged.
    setField('Fin thickness', '1.2')
    const thickness = screen.getByLabelText('Fin thickness')
    expect(thickness.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(thickness.getAttribute('aria-describedby')!)!.textContent).toMatch(/^Fin thickness: .*multiple of/)
    // Both rejections kept the tested baseline as the draft.
    expect(screen.getByLabelText('Test status').textContent).toBe('Tested #0')
    expect(fieldValue('Fin thickness')).toBe('1.2')
    fireEvent.keyDown(thickness, { key: 'Escape' })
    expect(fieldValue('Fin thickness')).toBe('5.0')
    // A slider edit snaps to the grid (clamp mode).
    fireEvent.change(screen.getByLabelText('Fin thickness slider'), { target: { value: '2.2' } })
    expect(fieldValue('Fin thickness')).toBe('2.0')
  })

  it('compares, restores and deletes with the shared semantics', () => {
    renderHeatSink()
    testReference()
    fireEvent.click(screen.getByRole('tab', { name: 'Compare results' }))
    const table = screen.getByRole('table', { name: 'Iteration 1 differences' })
    expect(within(table).getByText('base temperature rise')).toBeTruthy()
    expect(within(table).getAllByText(/^−/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Design history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore Baseline' }))
    expect(fieldValue('Fin count')).toBe('3')
    expect(fieldValue('Fin thickness')).toBe('5.0')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Iteration 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Iteration 1?' })).getByRole('button', { name: 'Delete iteration' }))
    expect(screen.queryByRole('button', { name: /^Iteration 1/ })).toBeNull()
  })

  it('opens the fin heat transfer reference with the unsupported effects', () => {
    renderHeatSink()
    fireEvent.click(screen.getByRole('button', { name: /Fin heat transfer reference/ }))
    const dialog = screen.getByRole('dialog', { name: 'Fin heat transfer' })
    expect(within(dialog).getByText(/does not include: radiation/)).toBeTruthy()
    expect(within(dialog).getByText(/coefficient h is given/)).toBeTruthy()
  })

  it('Guided content never reveals reference values', () => {
    for (const step of heatSinkUi.guided.steps) {
      expect(`${step.instruction} ${step.hint}`).not.toMatch(/\d/)
    }
  })

  it('Guided locks all but the step parameter; Parametric is open design; both disclose the given coefficient (task 58)', () => {
    renderHeatSink('guided')
    expect(within(screen.getByRole('region', { name: 'Guided experiments' })).getByRole('heading', { name: 'More fins' })).toBeTruthy()
    expect((screen.getByLabelText('Fin count') as HTMLInputElement).readOnly).toBe(false)
    expect((screen.getByRole('button', { name: 'Add a fin' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByLabelText('Fin height') as HTMLInputElement).readOnly).toBe(true)
    expect((screen.getByLabelText('Fin thickness') as HTMLInputElement).readOnly).toBe(true)
    expect((screen.getByRole('slider', { name: 'Fin height slider' }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText(/convection coefficient is a given fan-assisted value/)).toBeTruthy()
    cleanup()
    renderHeatSink('parametric')
    expect(screen.getByText(/Every parameter is editable from the start/)).toBeTruthy()
    expect(screen.getByText(/convection coefficient is a given fan-assisted value/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Guided experiments' })).toBeNull()
    expect((screen.getByLabelText('Fin height') as HTMLInputElement).readOnly).toBe(false)
  })

  it('persists the tested workspace under its own key in the v2 envelope', () => {
    const { values, storage } = memory()
    renderHeatSink('parametric', storage)
    testReference()
    const saved = JSON.parse(values.get('ei:session:heat-sink-1:v2')!)
    expect(saved).toMatchObject({ schemaVersion: 2, model: { id: 'plateFinHeatSink', version: 1 } })
    cleanup()
    renderHeatSink('parametric', storage)
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Design requirements' })).getByText('48.5 °C')).toBeTruthy()
  })
})
