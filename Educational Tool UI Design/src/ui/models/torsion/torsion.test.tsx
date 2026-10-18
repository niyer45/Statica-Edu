import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { torsionChallenge } from '../../../../test/fixtures/torsion'
import { torsionRuntime, type ModelRuntime } from '../../../state/runtimes'
import type { SessionStorage } from '../../../state/persistence'
import StoreProvider from '../../state/StoreProvider'
import Workbench from '../../workbench/Workbench'
import { modelUiFor } from '../registry'
import { torsionUi, TORSION_LIMITS_NOTICE } from '.'

// Torsion Shaft I workbench (task 47.3) through the PRODUCTION model UI registry. The challenge
// is booted directly here; card activation is a separate, explicitly approved step.

const clock = () => '2026-10-17T00:00:00.000Z'
let n = 0
const newId = () => `t-${++n}`
const ch = torsionChallenge()

function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
  return { values, storage }
}

// Default Parametric: free editing. Guided locks parameters by step (task 58); see the mode test.
function renderShaft(mode: 'guided' | 'parametric' = 'parametric', storage?: SessionStorage) {
  const init = torsionRuntime.init(ch, clock(), 'base', mode)
  if (!init.ok) throw new Error('torsion challenge must initialize')
  return render(
    <StoreProvider challenge={ch} initialSession={init.value} runtime={torsionRuntime as unknown as ModelRuntime} storage={storage ?? null} clock={clock} newId={newId}>
      <Workbench onExit={() => {}} />
    </StoreProvider>,
  )
}

const setMm = (label: string, value: string) => {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

/** Baseline → hollow 50/44 tube with the iteration-1 prediction. */
function testReference() {
  fireEvent.click(screen.getByRole('button', { name: /Hollow tube/ }))
  setMm('Outer diameter', '50')
  setMm('Inner diameter', '44')
  fireEvent.click(screen.getByRole('button', { name: 'Run Test' }))
  const dialog = screen.getByRole('dialog', { name: 'Predict twist' })
  fireEvent.click(within(dialog).getByRole('radio', { name: /Decrease/ }))
  fireEvent.click(within(dialog).getByRole('button', { name: /Run structural test/ }))
}

afterEach(cleanup)

describe('Torsion Shaft I workbench', () => {
  it('is registered in the production model UI registry', () => {
    expect(modelUiFor(ch.model)).toBe(torsionUi)
  })

  it('shows the baseline twist failure with torsion wording and no beam wording', () => {
    renderShaft()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(requirements).getByText('2.92°')).toBeTruthy()
    expect(within(requirements).getAllByText('✗ Fail')).toHaveLength(1)
    expect(screen.getByText(TORSION_LIMITS_NOTICE)).toBeTruthy()
    expect(screen.getByRole('img', { name: /Solid shaft cross-section and side view/ })).toBeTruthy()
    expect(screen.queryByText(/beam/i)).toBeNull()
    expect(screen.queryByText(/deflection/i)).toBeNull()
  })

  it('runs the learning loop to an Accepted hollow shaft with a scored twist prediction', () => {
    renderShaft()
    testReference()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(requirements).getByText('0.94°')).toBeTruthy()
    expect(within(requirements).queryByText('✗ Fail')).toBeNull()
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    fireEvent.click(screen.getAllByText('Test details').at(-1)!)
    expect(screen.getByText(/Prediction: decrease · Actual: decrease · Matched/)).toBeTruthy()
  })

  it('rejects an invalid diameter inline without changing the draft', () => {
    renderShaft()
    fireEvent.click(screen.getByRole('button', { name: /Hollow tube/ }))
    setMm('Inner diameter', '60')
    const input = screen.getByLabelText('Inner diameter')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toMatch(/^Inner diameter:/)
    // The rejected edit keeps the converted draft: outer 30 mm, default 4 mm wall (inner 22 mm).
    expect((screen.getByLabelText('Outer diameter') as HTMLInputElement).value).toBe('30.0')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect((screen.getByLabelText('Inner diameter') as HTMLInputElement).value).toBe('22.0')
  })

  it('compares, restores and deletes with the shared semantics', () => {
    renderShaft()
    testReference()
    fireEvent.click(screen.getByRole('tab', { name: 'Compare results' }))
    const table = screen.getByRole('table', { name: 'Iteration 1 differences' })
    expect(within(table).getByText('twist angle')).toBeTruthy()
    expect(within(table).getAllByText(/^−/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Design history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore Baseline' }))
    expect((screen.getByLabelText('Diameter') as HTMLInputElement).value).toBe('30.0')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Iteration 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Iteration 1?' })).getByRole('button', { name: 'Delete iteration' }))
    expect(screen.queryByRole('button', { name: /^Iteration 1/ })).toBeNull()
  })

  it('opens the torsion reference from the challenge panel', () => {
    renderShaft()
    fireEvent.click(screen.getByRole('button', { name: /Torsional stiffness reference/ }))
    expect(screen.getByRole('dialog', { name: 'Torsional stiffness' })).toBeTruthy()
  })

  it('Guided runs structured experiments with locked controls; Parametric is open design (task 58)', () => {
    renderShaft('guided')
    const guide = screen.getByRole('region', { name: 'Guided experiments' })
    expect(within(guide).getByRole('heading', { name: 'Thicken the shaft' })).toBeTruthy()
    expect((screen.getByLabelText('Diameter') as HTMLInputElement).readOnly).toBe(false)
    const hollow = screen.getByRole('button', { name: /Hollow tube/ })
    expect(hollow.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(hollow)
    expect(screen.getByLabelText('Diameter')).toBeTruthy()
    expect(screen.queryByLabelText('Outer diameter')).toBeNull()
    expect(screen.getByText('Locked in this step. Editable now: Outside diameter.')).toBeTruthy()
    cleanup()
    renderShaft('parametric')
    expect(screen.queryByRole('region', { name: 'Guided experiments' })).toBeNull()
    expect(screen.getByText(/Every parameter is editable from the start/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Hollow tube/ }))
    expect((screen.getByLabelText('Outer diameter') as HTMLInputElement).readOnly).toBe(false)
  })

  it('persists the tested workspace under its own key in the v2 envelope', () => {
    const { values, storage } = memory()
    renderShaft('parametric', storage)
    testReference()
    const saved = JSON.parse(values.get('ei:session:torsion-shaft-1:v1')!)
    expect(saved).toMatchObject({ schemaVersion: 2, model: { id: 'circularShaftTorsion', version: 1 } })
    cleanup()
    renderShaft('parametric', storage)
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
  })
})
