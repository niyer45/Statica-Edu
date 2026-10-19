import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { catalog } from '../../challenge/catalog'
import { baseRod, demoMaterial, rodResponse } from '../../learn/axialDemo'
import { stressStrain } from '../../learn/modules/stressStrain'
import { learnKey } from '../../learn/progress'
import type { SessionStorage } from '../../state/persistence'
import { bootCatalog } from '../App'
import CatalogHost from '../shell/CatalogHost'

// Task 72 (SSL-01–SSL-06): the Stress and strain module in the real catalog host. Predict-then-check
// steps with demos whose every value comes from the shared axial physics, beyond-yield states
// labelled in text, saved progress, and Apply it opening Stress and Strain I in Guided mode through
// the shell's openChallenge (LRN-06).

const clock = () => '2026-10-19T00:00:00.000Z'
let ids = 0
const newId = () => `id-${++ids}`

function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
  return { values, storage }
}

function renderHost(storage = memory()) {
  const boot = bootCatalog(catalog, clock, newId)
  if (!boot.ok) throw new Error(boot.error.message)
  render(<CatalogHost runnable={boot.value} storage={storage.storage} clock={clock} newId={newId} />)
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Platform' })).getByRole('button', { name: 'Learn' }))
  return storage
}

const mpa = (pa: number) => `${(pa / 1e6).toFixed(1)} MPa`
const mm = (m: number) => `${(m * 1000).toFixed(2)} mm`
const feedback = () => document.querySelector<HTMLElement>('.learn-feedback[role="status"]')!
const readout = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling!.textContent
function predict(option: string) {
  fireEvent.click(screen.getByRole('radio', { name: option }))
  fireEvent.click(screen.getByRole('button', { name: 'Check my prediction' }))
}
const steps = () => screen.getByRole('list', { name: 'Steps' })

afterEach(cleanup)

describe('Stress and strain module (task 72)', () => {
  it('is available on the Learn hub and reveals each demo only after a prediction, with model values', () => {
    const { values } = renderHost()
    fireEvent.click(screen.getByRole('button', { name: 'Start Stress and strain' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Stress and strain' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Stress: force over area' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Try it' })).toBeNull()

    predict('Half as large')
    expect(feedback().textContent).toContain('The model gives a different answer: a quarter as large.')
    expect(JSON.parse(values.get(learnKey(stressStrain))!)).toEqual({ schemaVersion: 1, answers: { area: 'half' } })
    const tryIt = screen.getByRole('region', { name: 'Try it' })
    expect(readout('Stress')).toBe(mpa(rodResponse(baseRod({ diameterM: 0.01 })).stressPa))
    fireEvent.change(within(tryIt).getByRole('slider', { name: 'Diameter' }), { target: { value: '20' } })
    expect(readout('Stress')).toBe(mpa(rodResponse(baseRod({ diameterM: 0.02 })).stressPa))
    // A thin rod is beyond yield: labelled, and its linear-model stretch is not shown as real.
    fireEvent.change(within(tryIt).getByRole('slider', { name: 'Diameter' }), { target: { value: '5' } })
    expect(readout('State (steel)')).toBe('Beyond yield: not modeled')
    expect(readout('Elongation')).toBe('Beyond yield: not modeled')
    expect(screen.getByText(stressStrain.steps[0]!.takeaway)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Strain: stretch per length' }))
    predict('The 1 m rod')
    expect(feedback().textContent).toContain('Your prediction matches the model.')
    expect(readout('Strain ε = δ ÷ L')).toBe('0.050 %')
    fireEvent.click(screen.getByRole('radio', { name: '1 m rod' }))
    expect(readout('Strain ε = δ ÷ L')).toBe('0.100 %')
    expect(readout('Stress this needs in steel')).toBe('200.0 MPa')
    expect(screen.getByLabelText('Module progress').textContent).toBe('2 of 5 steps done')
  })

  it('shows the same stress in every material, different stretch, and yield states in text', () => {
    const storage = memory()
    storage.storage.setItem(learnKey(stressStrain), JSON.stringify({ schemaVersion: 1, answers: Object.fromEntries(stressStrain.steps.map((s) => [s.id, s.question.answerId])) }))
    renderHost(storage)
    expect(within(screen.getByRole('list', { name: 'Mechanics of materials' })).getAllByText('Completed').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Review Stress and strain' }))

    fireEvent.click(within(steps()).getByRole('button', { name: /Hooke's law and stiffness/ }))
    const steel = rodResponse(baseRod({ material: demoMaterial('steel') }))
    expect(readout('Elongation')).toBe(mm(steel.elongationM))
    fireEvent.click(screen.getByRole('radio', { name: 'Aluminium alloy 6061-T6' }))
    const al = rodResponse(baseRod({ material: demoMaterial('aluminium') }))
    expect(readout('Stress')).toBe(mpa(steel.stressPa))
    expect(readout('Elongation')).toBe(mm(al.elongationM))
    expect(readout("Young's modulus E")).toBe('69 GPa')

    fireEvent.click(within(steps()).getByRole('button', { name: /Yield: strength is not stiffness/ }))
    const steelRow = 'Structural steel: yield 250.0 MPa, E 200 GPa'
    const alRow = 'Aluminium alloy 6061-T6: yield 276.0 MPa, E 69 GPa'
    expect(readout(steelRow)).toMatch(/^Elastic, strain /)
    fireEvent.change(screen.getByRole('slider', { name: 'Load' }), { target: { value: '20' } })
    expect(readout(steelRow)).toBe('Beyond yield: not modeled')
    expect(readout(alRow)).toMatch(/^Elastic/)
    fireEvent.change(screen.getByRole('slider', { name: 'Load' }), { target: { value: '22' } })
    expect(readout(alRow)).toBe('Beyond yield: not modeled')
    expect(readout('Titanium alloy Ti-6Al-4V: yield 830.0 MPa, E 114 GPa')).toMatch(/^Elastic/)
    expect(screen.getByRole('list', { name: 'Chart lines' })).toBeTruthy()

    fireEvent.click(within(steps()).getByRole('button', { name: /Longer rods stretch more/ }))
    fireEvent.change(screen.getByRole('slider', { name: 'Length' }), { target: { value: '4' } })
    expect(readout('Elongation')).toBe(mm(rodResponse(baseRod({ lengthM: 4 })).elongationM))
    expect(readout('Stress')).toBe(mpa(steel.stressPa))
  })

  it('Apply it opens Stress and Strain I in Guided mode through the shell', () => {
    const storage = memory()
    storage.storage.setItem(learnKey(stressStrain), JSON.stringify({ schemaVersion: 1, answers: { area: 'quarter' } }))
    renderHost(storage)
    fireEvent.click(screen.getByRole('button', { name: 'Continue Stress and strain' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Strain: stretch per length' })).toBeTruthy()
    fireEvent.click(within(steps()).getByRole('button', { name: 'Apply it' }))
    expect(screen.getByText(stressStrain.apply.text)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Stress and Strain I in Guided mode' }))
    expect(screen.getByTestId('workbench-host').hidden).toBe(false)
    expect(window.__EI_STATE__).toMatchObject({ challengeId: 'stress-strain-1', mode: 'guided' })
    expect(within(screen.getByRole('region', { name: 'Guided experiments' })).getByRole('heading', { name: 'Thicken the rod' })).toBeTruthy()
  })
})
