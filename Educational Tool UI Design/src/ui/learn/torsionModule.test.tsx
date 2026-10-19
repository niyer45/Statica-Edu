import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { catalog } from '../../challenge/catalog'
import { learnKey } from '../../learn/progress'
import { torsion } from '../../learn/modules/torsion'
import { baseShaft, demoShaftSection, shaftResponse, shearStressAt, solidSection } from '../../learn/torsionDemo'
import type { SessionStorage } from '../../state/persistence'
import { radToDeg } from '../../units/units'
import { bootCatalog } from '../App'
import CatalogHost from '../shell/CatalogHost'

// Task 71 (D-61; LRN-01–LRN-09): the Torsion module through the real challenge host. Predict
// before the demo, model-backed readouts for every demo, saved progress, and Apply it opening
// Torsion Shaft I in Guided mode.

const clock = () => '2026-10-19T00:00:00.000Z'
let ids = 0
const newId = () => `id-${++ids}`

function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
  return { values, storage }
}

function renderHost(storage: SessionStorage) {
  const boot = bootCatalog(catalog, clock, newId)
  if (!boot.ok) throw new Error(boot.error.message)
  render(<CatalogHost runnable={boot.value} storage={storage} clock={clock} newId={newId} />)
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Platform' })).getByRole('button', { name: 'Learn' }))
}

const deg = (rad: number) => `${radToDeg(rad).toFixed(2)}°`
const mpa = (pa: number) => `${(pa / 1e6).toFixed(1)} MPa`
const readout = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling!.textContent
const feedback = () => document.querySelector<HTMLElement>('.learn-feedback[role="status"]')!
const steps = () => screen.getByRole('list', { name: 'Steps' })

afterEach(cleanup)

describe('Torsion learn module (task 71)', () => {
  it('is an available module on the hub, next to Beam bending', () => {
    renderHost(memory().storage)
    const topic = screen.getByRole('list', { name: 'Mechanics of materials' })
    const card = within(topic).getAllByRole('listitem').find((li) => within(li).queryByRole('heading', { name: 'Torsion' }) !== null)!
    expect(within(card).getByText('Not started')).toBeTruthy()
    expect(within(card).getByText(torsion.summary)).toBeTruthy()
    expect(within(card).getByRole('button', { name: 'Start Torsion' })).toBeTruthy()
  })

  it('reveals the demo only after a prediction and computes every value from the physics', () => {
    const { values, storage } = memory()
    renderHost(storage)
    fireEvent.click(screen.getByRole('button', { name: 'Start Torsion' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Torsion' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Torque and twist' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Try it' })).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: 'It becomes four times larger' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check my prediction' }))
    expect(feedback().textContent).toContain('The model gives a different answer: it doubles.')
    expect(JSON.parse(values.get(learnKey(torsion))!)).toEqual({ schemaVersion: 1, answers: { torque: 'quadruple' } })

    const tryIt = screen.getByRole('region', { name: 'Try it' })
    expect(readout('Angle of twist')).toBe(deg(shaftResponse(baseShaft()).twistRad))
    expect(readout('Peak shear stress')).toBe(mpa(shaftResponse(baseShaft()).maxShearStressPa))
    fireEvent.change(within(tryIt).getByRole('slider', { name: 'Torque' }), { target: { value: '50' } })
    expect(readout('Angle of twist')).toBe(deg(shaftResponse(baseShaft({ torqueNm: 50 })).twistRad))
    expect(screen.getByText(/idealized as in Torsion Shaft I/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Length' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Twice as large' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check my prediction' }))
    expect(feedback().textContent).toContain('Your prediction matches the model.')
    fireEvent.change(screen.getByRole('slider', { name: 'Length' }), { target: { value: '0.5' } })
    expect(readout('Angle of twist')).toBe(deg(shaftResponse(baseShaft({ lengthM: 0.5 })).twistRad))
    expect(readout('Peak shear stress')).toBe(mpa(shaftResponse(baseShaft()).maxShearStressPa))
    expect(screen.getByLabelText('Module progress').textContent).toBe('2 of 5 steps done')
  })

  it('uses the diameter, hollow and stress demos with model values', () => {
    const { storage } = memory()
    const answers = Object.fromEntries(torsion.steps.map((s) => [s.id, s.question.answerId]))
    storage.setItem(learnKey(torsion), JSON.stringify({ schemaVersion: 1, answers }))
    renderHost(storage)
    fireEvent.click(screen.getByRole('button', { name: 'Review Torsion' }))

    fireEvent.click(within(steps()).getByRole('button', { name: /^Diameter/ }))
    fireEvent.change(screen.getByRole('slider', { name: 'Diameter' }), { target: { value: '40' } })
    const d40 = shaftResponse(baseShaft({ section: solidSection(40) }))
    expect(readout('Polar moment J')).toBe(`${Math.round(d40.polarMomentM4 * 1e12).toLocaleString('en-US')} mm⁴`)
    expect(readout('Angle of twist')).toBe(deg(d40.twistRad))

    fireEvent.click(within(steps()).getByRole('button', { name: /^Hollow or solid/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Tube, 29 mm with a 21 mm bore' }))
    const tube = shaftResponse(baseShaft({ section: demoShaftSection('tube29').section }))
    expect(readout('Area')).toBe('314 mm²')
    expect(readout('Angle of twist')).toBe(deg(tube.twistRad))

    fireEvent.click(within(steps()).getByRole('button', { name: /^Where the shear stress is/ }))
    expect(readout('Shear stress here')).toBe('0.0 MPa') // starts at the centre
    fireEvent.change(screen.getByRole('slider', { name: 'Distance from the centre' }), { target: { value: '10' } })
    expect(readout('Shear stress here')).toBe(mpa(shearStressAt(baseShaft(), 1)))
    expect(readout('Shear stress at the surface')).toBe(mpa(shaftResponse(baseShaft()).maxShearStressPa))
  })

  it('Apply it opens Torsion Shaft I in Guided mode', () => {
    renderHost(memory().storage)
    fireEvent.click(screen.getByRole('button', { name: 'Start Torsion' }))
    fireEvent.click(within(steps()).getByRole('button', { name: 'Apply it' }))
    expect(screen.getByText(torsion.apply.text)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Torsion Shaft I in Guided mode' }))
    expect(window.__EI_STATE__!.challengeId).toBe('torsion-shaft-1')
    expect(window.__EI_STATE__!.mode).toBe('guided')
    expect(within(screen.getByRole('region', { name: 'Guided experiments' })).getByRole('heading', { name: 'Hollow it out' })).toBeTruthy()
  })
})
