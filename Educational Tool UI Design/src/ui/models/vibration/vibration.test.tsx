import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { vibrationChallenge } from '../../../../test/fixtures/vibration'
import { catalog } from '../../../challenge/catalog'
import { vibrationRuntime, type ModelRuntime } from '../../../state/runtimes'
import type { SessionStorage } from '../../../state/persistence'
import { vibrationModel } from '../../../state/vibrationModel'
import StoreProvider from '../../state/StoreProvider'
import Workbench from '../../workbench/Workbench'
import { modelUiFor } from '../registry'
import { vibrationUi, VIBRATION_LIMITS_NOTICE } from '.'

// Vibration Isolation I workbench (task 50.3) through the PRODUCTION model UI registry. The
// challenge is booted directly here; card activation is a separate, owner-approved step.

const clock = () => '2026-10-17T00:00:00.000Z'
let n = 0
const newId = () => `v-${++n}`
const ch = vibrationChallenge()

function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
  return { values, storage }
}

function renderMount(mode: 'guided' | 'parametric' = 'guided', storage?: SessionStorage) {
  const init = vibrationRuntime.init(ch, clock(), 'base', mode)
  if (!init.ok) throw new Error('vibration challenge must initialize')
  return render(
    <StoreProvider challenge={ch} initialSession={init.value} runtime={vibrationRuntime as unknown as ModelRuntime} storage={storage ?? null} clock={clock} newId={newId}>
      <Workbench onExit={() => {}} />
    </StoreProvider>,
  )
}

const setStiffness = (value: string) => {
  const input = screen.getByLabelText('Stiffness')
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

/** Baseline → reference mount (85 kN/m, neoprene) with the iteration-1 prediction. */
function testReference() {
  setStiffness('85')
  fireEvent.click(screen.getByRole('radio', { name: /Neoprene/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Run Test' }))
  const dialog = screen.getByRole('dialog', { name: 'Predict transmitted vibration' })
  expect(within(dialog).getByText('Compared with the Baseline, how will your new mount change the worst vibration transmitted in the operating band?')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('radio', { name: /Decrease/ }))
  fireEvent.click(within(dialog).getByRole('button', { name: /Run structural test/ }))
}

afterEach(cleanup)

describe('Vibration Isolation I workbench', () => {
  it('is registered in the production model UI registry while its catalog card stays unavailable', () => {
    expect(modelUiFor(ch.model)).toBe(vibrationUi)
    expect(catalog.find((e) => e.id === '006')?.available).toBe(false)
  })

  it('shows the baseline resonance failures with vibration wording and no beam or torsion wording', () => {
    const { container } = renderMount()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    // Worst in-band and peak transmissibility are both 10.1 (resonance inside the band).
    expect(within(requirements).getAllByText('10.1')).toHaveLength(2)
    expect(within(requirements).getByText('2.00 mm')).toBeTruthy()
    expect(within(requirements).getAllByText('✗ Fail')).toHaveLength(3)
    expect(within(requirements).getByText('Worst vibration transmitted in the operating band')).toBeTruthy()
    expect(screen.getByText(VIBRATION_LIMITS_NOTICE)).toBeTruthy()
    expect(screen.getByRole('img', { name: /Static schematic: component mass on a Natural rubber mount/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Steady-state frequency response/ })).toBeTruthy()
    const table = screen.getByRole('table', { name: 'Frequency response values' })
    expect(within(table).getByText('30.20 Hz')).toBeTruthy()
    expect(within(table).getByText('None: the band is amplified')).toBeTruthy()
    expect(screen.getByText(/inside the operating band ·/)).toBeTruthy()
    // Static figures only: no SVG animation implies a time simulation.
    expect(container.querySelector('animate, animateTransform, animateMotion')).toBeNull()
    for (const word of [/beam/i, /twist/i, /torsion/i, /shaft/i, /tip deflection/i]) expect(screen.queryByText(word)).toBeNull()
  })

  it('runs the learning loop to an Accepted reference mount with a scored prediction', () => {
    renderMount()
    testReference()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(requirements).getByText('0.0929')).toBeTruthy()
    expect(within(requirements).getByText('5.12')).toBeTruthy()
    expect(within(requirements).getByText('5.77 mm')).toBeTruthy()
    expect(within(requirements).queryByText('✗ Fail')).toBeNull()
    const table = screen.getByRole('table', { name: 'Frequency response values' })
    expect(within(table).getByText('6.56 Hz')).toBeTruthy()
    expect(within(table).getByText('90.7 %')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    fireEvent.click(screen.getAllByText('Test details').at(-1)!)
    expect(screen.getByText(/Prediction: decrease · Actual: decrease · Matched/)).toBeTruthy()
    expect(screen.getByText(/The worst vibration transmitted in the operating band changed by ×/)).toBeTruthy()
  })

  it('rejects invalid stiffness inline without changing the draft', () => {
    renderMount()
    setStiffness('10')
    const input = screen.getByLabelText('Stiffness')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toMatch(/^Stiffness: Stiffness must be at least/)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect((screen.getByLabelText('Stiffness') as HTMLInputElement).value).toBe('1800.0')
    expect(input.getAttribute('aria-invalid')).toBe('false')
    setStiffness('85 kN')
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toBe('Stiffness: enter a number in kN/m.')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect((screen.getByLabelText('Stiffness') as HTMLInputElement).value).toBe('1800.0')
    expect((screen.getByRole('radio', { name: /Natural rubber/ }) as HTMLInputElement).checked).toBe(true)
  })

  it('moves stiffness with the logarithmic slider as a clamp edit', () => {
    renderMount()
    const slider = screen.getByRole('slider', { name: 'Stiffness slider (logarithmic)' })
    fireEvent.change(slider, { target: { value: '0' } })
    expect((screen.getByLabelText('Stiffness') as HTMLInputElement).value).toBe('20.0')
    fireEvent.change(slider, { target: { value: '400' } })
    expect((screen.getByLabelText('Stiffness') as HTMLInputElement).value).toBe('2000.0')
    expect(slider.getAttribute('aria-valuetext')).toBe('2000.0 kN/m')
  })

  it('compares, restores and deletes with the shared semantics', () => {
    renderMount()
    testReference()
    fireEvent.click(screen.getByRole('tab', { name: 'Compare results' }))
    const table = screen.getByRole('table', { name: 'Iteration 1 differences' })
    expect(within(table).getByText('worst vibration transmitted in the operating band')).toBeTruthy()
    expect(within(table).getByText('natural frequency')).toBeTruthy()
    expect(within(table).getAllByText(/^−/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Design history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore Baseline' }))
    expect((screen.getByLabelText('Stiffness') as HTMLInputElement).value).toBe('1800.0')
    expect((screen.getByRole('radio', { name: /Natural rubber/ }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Iteration 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Iteration 1?' })).getByRole('button', { name: 'Delete iteration' }))
    expect(screen.queryByRole('button', { name: /^Iteration 1/ })).toBeNull()
  })

  it('imports a v2 vibration design file and rejects a file for another challenge', async () => {
    renderMount()
    const file = (text: string) => new File([text], 'design.json', { type: 'application/json' })
    const input = screen.getByLabelText('Import design', { selector: 'input' })
    fireEvent.change(input, { target: { files: [file(vibrationModel.exportDesign({ id: 'imp', stiffnessNPerM: 70000, materialId: 'butylRubber' }, ch))] } })
    await waitFor(() => expect((screen.getByLabelText('Stiffness') as HTMLInputElement).value).toBe('70.0'))
    expect((screen.getByRole('radio', { name: /Butyl rubber/ }) as HTMLInputElement).checked).toBe(true)
    const foreign = vibrationModel.exportDesign({ id: 'imp', stiffnessNPerM: 70000, materialId: 'butylRubber' }, { ...ch, id: 'torsion-shaft-1' })
    fireEvent.change(input, { target: { files: [file(foreign)] } })
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Design could not be imported' })).toBeTruthy())
    expect((screen.getByLabelText('Stiffness') as HTMLInputElement).value).toBe('70.0')
  })

  it('opens the vibration reference with the unsupported effects from the challenge panel', () => {
    renderMount()
    fireEvent.click(screen.getByRole('button', { name: /Vibration isolation reference/ }))
    const dialog = screen.getByRole('dialog', { name: 'Vibration isolation' })
    expect(within(dialog).getByText(/coil-spring surge/)).toBeTruthy()
    expect(within(dialog).getByText(/not a simulation of motion over time/)).toBeTruthy()
  })

  it('Guided shows the staged steps without revealing the reference design', () => {
    renderMount()
    expect(screen.getByRole('region', { name: 'Guided instructions' })).toBeTruthy()
    for (const step of vibrationUi.guidance.steps) {
      const text = `${step.instruction} ${step.hint}`
      expect(text).not.toMatch(/\d/)
      expect(text).not.toMatch(/neoprene|butyl/i)
    }
  })

  it('Parametric omits guidance and shows the direct-edit label', () => {
    renderMount('parametric')
    expect(screen.getByText('Direct mount stiffness and material editing')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Guided instructions' })).toBeNull()
  })

  it('labels the stored submission margins', () => {
    expect(vibrationUi.copy.efficiency({ isolationMargin: 0.2, sagUsage: 0.7, clearanceUsage: 0.6 })).toEqual([
      { label: 'Isolation margin', value: 0.2 },
      { label: 'Sag usage', value: 0.7 },
      { label: 'Clearance usage', value: 0.6 },
    ])
  })

  it('persists the tested workspace under its own key in the v2 envelope', () => {
    const { values, storage } = memory()
    renderMount('guided', storage)
    testReference()
    const saved = JSON.parse(values.get('ei:session:vibration-isolation-1:v1')!)
    expect(saved).toMatchObject({ schemaVersion: 2, model: { id: 'sdofBaseIsolation', version: 1 } })
    cleanup()
    renderMount('guided', storage)
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Design requirements' })).getByText('0.0929')).toBeTruthy()
  })
})
