import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import { baseInput, cantileverResponse } from '../../learn/beamDemo'
import { beamBending } from '../../learn/modules/beamBending'
import { learnKey, type LearnStorage } from '../../learn/progress'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { useSession } from '../state/store'
import PlatformShell from '../shell/PlatformShell'

// Task 67 (LRN-01–LRN-09): the Learn hub, predict-then-check steps with model-backed demos,
// saved progress, and Apply it opening Cantilever Beam I in Guided mode.

const clock = () => '2026-10-19T00:00:00.000Z'
const newId = () => 'baseline-id'

function memory(): LearnStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }
}

function ModeProbe() {
  return <output data-testid="mode">{useSession().mode}</output>
}

function renderLearn(storage = memory()) {
  const boot = bootstrap(bundledChallengeResult, clock, newId)
  if (!boot.ok) throw new Error(boot.error.message)
  render(
    <StoreProvider challenge={boot.value.challenge} initialSession={boot.value.session} clock={clock} newId={newId}>
      <PlatformShell learnStorage={storage} />
      <ModeProbe />
    </StoreProvider>,
  )
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Platform' })).getByRole('button', { name: 'Learn' }))
  return storage
}

const mm = (m: number) => `${(m * 1000).toFixed(1)} mm`
/** The prediction feedback (a role=status region; slider outputs are status elements too). */
const feedback = () => document.querySelector<HTMLElement>('.learn-feedback[role="status"]')!
const readout = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling!.textContent

afterEach(cleanup)

describe('Learn (task 67)', () => {
  it('lists subjects, topics and modules, with planned modules labelled and no content', () => {
    renderLearn()
    expect(screen.getByRole('heading', { level: 1, name: 'Learn' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Solid mechanics' })).toBeTruthy()
    const topic = screen.getByRole('list', { name: 'Mechanics of materials' })
    const cards = within(topic).getAllByRole('listitem')
    expect(within(cards[0]!).getByRole('heading', { name: 'Beam bending' })).toBeTruthy()
    expect(within(cards[0]!).getByText('Not started')).toBeTruthy()
    // Tasks 71 and 72: Torsion and Stress and strain are available too; the remaining entries are Planned with no content.
    const planned = cards.filter((card) => within(card).queryByText('Planned') !== null)
    expect(planned.length).toBeGreaterThan(0)
    for (const card of planned) expect(within(card).queryByRole('button')).toBeNull()
    for (const card of cards.filter((c) => !planned.includes(c))) expect(within(card).getByRole('button', { name: /^Start / })).toBeTruthy()
  })

  it('reveals the demo only after a prediction, explains a different answer, and computes every value', () => {
    const storage = renderLearn()
    fireEvent.click(screen.getByRole('button', { name: 'Start Beam bending' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Beam bending' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Load and deflection' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Try it' })).toBeNull()
    expect((screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Check my prediction' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('radio', { name: 'It stays the same' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check my prediction' }))
    expect(feedback().textContent).toContain('The model gives a different answer: it doubles.')
    expect(feedback().textContent).toContain(beamBending.steps[0]!.question.explanation)
    expect(JSON.parse(storage.map.get(learnKey(beamBending))!)).toEqual({ schemaVersion: 1, answers: { load: 'same' } })
    for (const radio of screen.getAllByRole('radio', { name: /^It / })) expect(radio.matches(':disabled')).toBe(true) // committed predictions are final

    // The demo appears and every number comes from the physics (LRN-04).
    const tryIt = screen.getByRole('region', { name: 'Try it' })
    expect(readout('Tip deflection')).toBe(mm(cantileverResponse(baseInput({ forceN: 200 })).tipDeflectionM))
    fireEvent.change(within(tryIt).getByRole('slider', { name: 'Tip load' }), { target: { value: '100' } })
    expect(readout('Tip deflection')).toBe(mm(cantileverResponse(baseInput({ forceN: 100 })).tipDeflectionM))
    expect(screen.getByText(beamBending.steps[0]!.takeaway)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Length' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Eight times as large' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check my prediction' }))
    expect(feedback().textContent).toContain('Your prediction matches the model.')
    expect(screen.getByLabelText('Module progress').textContent).toBe('2 of 5 steps done')
    const steps = screen.getByRole('list', { name: 'Steps' })
    expect(within(steps).getByRole('button', { name: 'Load and deflection, done' })).toBeTruthy()
  })

  it('remembers progress, shows it on the hub, and Apply it opens Cantilever Beam I in Guided mode', () => {
    const storage = memory()
    storage.setItem(learnKey(beamBending), JSON.stringify({ schemaVersion: 1, answers: { load: 'double', length: 'x8' } }))
    renderLearn(storage)
    expect(screen.getByText('2 of 5 steps done')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continue Beam bending' }))
    // Opens on the first step without a prediction.
    expect(screen.getByRole('heading', { level: 2, name: 'Material stiffness' })).toBeTruthy()
    fireEvent.click(within(screen.getByRole('list', { name: 'Steps' })).getByRole('button', { name: 'Apply it' }))
    expect(screen.getByText('You can open the challenge now, or finish the remaining steps first.')).toBeTruthy()
    expect(screen.getByTestId('workbench-host').hidden).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Open Cantilever Beam I in Guided mode' }))
    expect(screen.getByTestId('workbench-host').hidden).toBe(false)
    expect(screen.getByTestId('mode').textContent).toBe('guided')
  })

  it('uses the section and stress demos with model values', () => {
    const storage = memory()
    const answers = Object.fromEntries(beamBending.steps.map((s) => [s.id, s.question.answerId]))
    storage.setItem(learnKey(beamBending), JSON.stringify({ schemaVersion: 1, answers }))
    renderLearn(storage)
    expect(screen.getByText('Completed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Review Beam bending' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Apply it' })).toBeTruthy()
    const steps = screen.getByRole('list', { name: 'Steps' })

    fireEvent.click(within(steps).getByRole('button', { name: /Shape of the cross-section/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Upright bar, 20 × 40 mm' }))
    const upright = cantileverResponse(baseInput())
    expect(readout('Second moment of area I')).toBe(`${Math.round(upright.secondMomentM4 * 1e12).toLocaleString('en-US')} mm⁴`)

    fireEvent.click(within(steps).getByRole('button', { name: /Where the stress is/ }))
    expect(readout('Bending moment here')).toBe('0 N·m') // starts at the tip
    fireEvent.change(screen.getByRole('slider', { name: 'Position from the fixed end' }), { target: { value: '0' } })
    expect(readout('Bending moment here')).toBe(`${upright.rootMomentNm.toFixed(0)} N·m`)
    expect(readout('Stress, top surface (tension)')).toBe(`${(upright.maxStressPa / 1e6).toFixed(1)} MPa`)
    expect(readout('Stress, neutral axis')).toBe('0.0 MPa')
  })
})
