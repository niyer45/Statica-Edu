import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import type { Challenge } from '../../challenge/types'
import { initSession, type SessionState } from '../../state/session'
import type { SessionStorage } from '../../state/persistence'
import StoreProvider from '../state/StoreProvider'
import { useStore, type Store } from '../state/store'
import { STEP_DIALOG_ENTRY_DELAY_MS, STEP_DIALOG_STEP_DELAY_MS } from './GuidedStepDialog'
import ModeExperience from './ModeExperience'
import Workbench from './Workbench'

// Guided structured experiments vs Parametric open design (task 58; supersedes the task 44
// Inspect/Experiment/Compare/Explain prompts). Mode stays fixed in the workbench (D-37).

vi.mock('../viewport/Viewport3D', () => ({ default: () => <div>Mode test viewport</div> }))
if (!bundledChallengeResult.ok) throw new Error('Invalid challenge')
const challenge = bundledChallengeResult.value
const now = '2026-10-16T00:00:00.000Z'
function fresh(mode: SessionState['mode'] = 'guided'): SessionState {
  const result = initSession(challenge, now, 'baseline', mode)
  if (!result.ok) throw new Error('Invalid initial session')
  return result.value
}
let store: Store
function Probe() { store = useStore(); return null }
function setup(initial = fresh(), storage?: SessionStorage, ch: Challenge = challenge, full = false) {
  let id = 0
  return render(<StoreProvider challenge={ch} initialSession={initial} clock={() => now} newId={() => `test-${++id}`} storage={storage}>
    {full ? <Workbench onExit={() => {}} /> : <ModeExperience />}<Probe />
  </StoreProvider>)
}
const test = () => act(() => { store.dispatch({ type: 'setPrediction', direction: 'decrease', now }); store.runTest() })
const steps = () => within(screen.getByRole('navigation', { name: 'Guided steps' })).getAllByRole('listitem').map((li) => { const c = li.cloneNode(true) as HTMLElement; c.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove()); return c.textContent })
// The step dialog opens after a delay (task 78.5, WD-48), so these tests run on fake timers.
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers() })
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
/** The entry delay elapsed (entering a challenge, reload, resume). */
const entered = () => advance(STEP_DIALOG_ENTRY_DELAY_MS)
/** The new-step delay elapsed (a step met, or all steps complete). */
const nextStep = () => advance(STEP_DIALOG_STEP_DELAY_MS)

// The Baseline is a solid Ø31 mm circle (task 59, D-47 amendment): the beam's first experiment
// grows the diameter, the second changes the shape.
const grow = (valueM = 0.034) => act(() => store.dispatch({ type: 'setParam', param: 'diameterM', valueM, mode: 'strict' }))

describe('Guided structured experiments (task 58)', () => {
  it('shows the ordered single-variable steps with the first one current', () => {
    setup()
    entered()
    const guide = screen.getByRole('region', { name: 'Guided experiments' })
    expect(within(guide).getByRole('button', { name: 'Grow the circle, current step' })).toBeTruthy()
    expect(steps()).toEqual(['Grow the circle, current step', 'Try another shape, locked', 'Tune one dimension, locked', 'Meet every check, locked'])
    const dialog = screen.getByRole('dialog', { name: 'Step 1 of 4: Grow the circle' })
    expect(within(dialog).getByRole('heading', { name: 'Grow the circle' })).toBeTruthy()
    expect(within(dialog).getByText(/Increase only the diameter of the solid circle/)).toBeTruthy()
    expect(within(dialog).getByText('Diameter')).toBeTruthy()
    expect(dialog.querySelector('details')?.open).toBe(false)
  })

  it('advances only when a tested result meets the step objective, reporting stored changes', () => {
    setup()
    entered()
    const before = store.state
    // Browsing the hint never changes the session.
    fireEvent.click(screen.getByText('Hint'))
    expect(store.state).toBe(before)
    // Retesting the unchanged Baseline does not meet "increase the diameter".
    test()
    expect(screen.getByRole('heading', { name: 'Grow the circle' })).toBeTruthy()
    // The line under the stepper and the same text inside the open dialog.
    expect(screen.getAllByText(/Iteration 1 did not complete this step yet/)).toHaveLength(2)
    // A smaller circle changes the diameter in the wrong direction.
    grow(0.029)
    test()
    expect(screen.getByRole('heading', { name: 'Grow the circle' })).toBeTruthy()
    grow(0.034)
    test()
    nextStep()
    expect(screen.getByRole('heading', { name: 'Try another shape' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try another shape, current step' })).toBeTruthy()
    expect(screen.getByText(/Grow the circle complete: Iteration 3 compared with Iteration 2\. Tip deflection decreased; Mass increased; Bending stress decreased\./)).toBeTruthy()
    expect(steps()[0]).toBe('Grow the circle, completed')
  })

  it('locks every control the current step does not unlock; Parametric locks nothing', () => {
    setup(fresh('guided'), undefined, challenge, true)
    const diameter = () => screen.getByRole('spinbutton', { name: /^Diameter/ }) as HTMLInputElement
    expect(diameter().readOnly).toBe(false)
    const rectangle = screen.getByRole('button', { name: /Rectangle/ })
    expect(rectangle.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getAllByText('Locked in this step. Editable now: Diameter.').length).toBeGreaterThan(0)
    const before = store.state
    fireEvent.click(rectangle)
    fireEvent.keyDown(rectangle, { key: 'Enter' })
    expect(store.state).toBe(before)
    // A direct dispatch (e.g. a viewport drop) is rejected by the runtime lock with a reason.
    act(() => store.dispatch({ type: 'applySection', kind: 'rectangle' }))
    expect(store.state.draft).toBe(before.draft)
    expect(store.state.ui.notice?.message).toBe('Section shape is locked in this Guided step. Editable now: Diameter.')

    // Step 2 unlocks the shape and locks the diameter.
    grow()
    test()
    expect(diameter().readOnly).toBe(true)
    expect((screen.getByRole('slider', { name: /^Diameter slider/ }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Rectangle/ }).getAttribute('aria-disabled')).not.toBe('true')
    cleanup()

    setup(fresh('parametric'), undefined, challenge, true)
    expect(screen.queryByRole('region', { name: 'Guided experiments' })).toBeNull()
    expect(screen.queryByText(/Locked in this step/)).toBeNull()
    expect(diameter().readOnly).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Rectangle/ }))
    expect(store.state.draft.section.kind).toBe('rectangle')
  })

  it('opens every parameter in the final step and completes on an Accepted test', () => {
    setup(fresh('guided'), undefined, challenge, true)
    grow()
    test()
    act(() => store.dispatch({ type: 'applySection', kind: 'iSection' }))
    test()
    act(() => store.dispatch({ type: 'setParam', param: 'heightM', valueM: 0.06, mode: 'strict' }))
    test()
    nextStep()
    expect(screen.getByRole('heading', { name: 'Meet every check' })).toBeTruthy()
    expect(screen.queryByText(/Locked in this step/)).toBeNull()
    act(() => {
      for (const [param, valueM] of [['heightM', 0.06], ['widthM', 0.04], ['flangeThicknessM', 0.004], ['webThicknessM', 0.003]] as const) store.dispatch({ type: 'setParam', param, valueM, mode: 'strict' })
    })
    test()
    expect(store.state.history.at(-1)?.accepted).toBe(true)
    nextStep()
    expect(screen.getByRole('heading', { name: 'All experiments complete' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'All 4 steps complete' })).toBeTruthy()
    expect(steps().every((t) => t!.endsWith(', completed'))).toBe(true)
  })

  it('keeps step progress after reload without a new persisted field', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
    const mounted = setup(fresh('guided'), storage)
    grow()
    test()
    const before = store.state
    mounted.unmount()
    setup(fresh('guided'), storage)
    entered()
    expect(store.state).toEqual(before)
    expect([...values.values()].join('')).not.toMatch(/completions|progress|stepId/)
    expect(screen.getByRole('heading', { name: 'Try another shape' })).toBeTruthy()
  })
})

describe('Guided stepper, step dialog and lock line (tasks 78, 78.3, 78.4)', () => {
  const stepButton = (name = 'Grow the circle, current step') => within(screen.getByRole('navigation', { name: 'Guided steps' })).getByRole('button', { name })
  const dialog = () => screen.getByRole('dialog', { name: /^Step \d of 4: / })
  const gotIt = () => screen.getByRole('button', { name: 'Got it' })

  it('opens a modal step dialog after the entry delay, named "Step N of M: <title>", with the current step content', () => {
    setup()
    expect(screen.queryByRole('dialog')).toBeNull()
    entered()
    const current = stepButton()
    expect(current.closest('li')?.getAttribute('aria-current')).toBe('step')
    expect(current.getAttribute('aria-haspopup')).toBe('dialog')
    expect(current.hasAttribute('aria-expanded')).toBe(false)
    expect(current.hasAttribute('aria-controls')).toBe(false)
    expect(screen.queryByText(/Step \d of \d/)).toBeNull()
    const d = screen.getByRole('dialog', { name: 'Step 1 of 4: Grow the circle' })
    expect(d.getAttribute('aria-modal')).toBe('true')
    expect(document.body.contains(d) && !screen.getByRole('region', { name: 'Guided experiments' }).contains(d)).toBe(true)
    expect(within(d).getByRole('heading', { name: 'Grow the circle' })).toBeTruthy()
    expect(within(d).getByText(/Increase only the diameter of the solid circle/)).toBeTruthy()
    expect(d.querySelector('ol')).toBeNull()
    expect(d.querySelector('details')?.open).toBe(false)
    expect(within(d).getByText('Hint')).toBeTruthy()
    // Initial focus is the dialog's first focusable, its Close button, like every other dialog.
    expect(document.activeElement).toBe(within(d).getByRole('button', { name: 'Close' }))
    // One merged line (WD-48): the lock icon (aria-hidden) then "Editable now: ..."; no separate lock paragraph.
    const focus = d.querySelectorAll('.guided-focus')
    expect(focus).toHaveLength(1)
    expect(focus[0]!.textContent).toBe('Editable now: Diameter. Other parameters stay locked until a later step.')
    expect(focus[0]!.firstElementChild?.tagName.toLowerCase()).toBe('svg')
    expect(focus[0]!.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(d.textContent).not.toMatch(/Locked in this step/)
    expect(d.querySelector('#guided-lock-line')).toBeNull()
    // Every body paragraph shares one container (one left edge, one gap).
    expect(d.querySelector('.guided-body')?.contains(focus[0]!)).toBe(true)
    // Completed and locked steps are not buttons; the row adds one tab stop.
    expect(within(screen.getByRole('navigation', { name: 'Guided steps' })).getAllByRole('button')).toEqual([current])
    expect(document.querySelector('.guided-popover')).toBeNull()
  })

  it('"Got it", Close and Escape each close it and return focus to the current step button', () => {
    setup()
    entered()
    for (const close of [() => fireEvent.click(gotIt()), () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' })), () => fireEvent.keyDown(document.activeElement!, { key: 'Escape' })]) {
      close()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.activeElement).toBe(stepButton())
      fireEvent.click(stepButton())
      expect(dialog()).toBeTruthy()
    }
  })

  it('a backdrop click does not dismiss it', () => {
    setup()
    entered()
    fireEvent.click(document.querySelector('.modal-backdrop')!)
    expect(dialog()).toBeTruthy()
  })

  it('traps focus while open: Tab and Shift+Tab cycle inside, and focus pulled outside returns inside', () => {
    setup(fresh('guided'), undefined, challenge, true)
    entered()
    const d = dialog()
    const close = within(d).getByRole('button', { name: 'Close' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(gotIt())
    fireEvent.keyDown(gotIt(), { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    // The background (a design control, Run Test) is not reachable: focus moving there is sent back.
    screen.getByRole('button', { name: 'Run Test' }).focus()
    expect(d.contains(document.activeElement)).toBe(true)
    screen.getByRole('spinbutton', { name: /^Diameter/ }).focus()
    expect(d.contains(document.activeElement)).toBe(true)
  })

  it('reopens from the current step, and opens by itself on a new step but not after a failed attempt', () => {
    setup()
    entered()
    fireEvent.click(gotIt())
    // A retest of the unchanged Baseline does not meet the step: the dialog stays closed.
    test()
    nextStep()
    expect(screen.queryByRole('dialog')).toBeNull()
    // A met step opens it again for the next step, after the step delay (the result is seen first).
    grow()
    test()
    advance(STEP_DIALOG_STEP_DELAY_MS - 1)
    expect(screen.queryByRole('dialog')).toBeNull()
    advance(1)
    expect(screen.getByRole('dialog', { name: 'Step 2 of 4: Try another shape' })).toBeTruthy()
    fireEvent.click(gotIt())
    expect(document.activeElement).toBe(stepButton('Try another shape, current step'))
  })

  it('shows one feedback line under the stepper only after an attempt that did not meet the step', () => {
    setup()
    const guide = screen.getByRole('region', { name: 'Guided experiments' })
    expect(guide.querySelector('.guided-feedback')).toBeNull()
    entered()
    fireEvent.click(gotIt())
    test()
    const line = guide.querySelector('.guided-feedback')!
    expect(line.textContent).toBe('Iteration 1 did not complete this step yet. Change only diameter as asked, then Run Test.')
    expect(line.getAttribute('aria-live')).toBeNull()
    expect(line.closest('[role]')).toBeNull()
    expect(line.previousElementSibling).toBe(screen.getByRole('navigation', { name: 'Guided steps' }))
    // Also inside the dialog when reopened.
    fireEvent.click(stepButton())
    expect(within(dialog()).getByText(line.textContent!)).toBeTruthy()
    fireEvent.click(gotIt())
    // Meeting the step clears the line.
    grow()
    test()
    nextStep()
    fireEvent.click(gotIt())
    expect(guide.querySelector('.guided-feedback')).toBeNull()
  })

  it('shows the completion message once when every step is met and reopens from "All N steps complete"', () => {
    setup(fresh('guided'), undefined, challenge, true)
    entered()
    fireEvent.click(gotIt())
    grow()
    test()
    nextStep()
    fireEvent.click(gotIt())
    act(() => store.dispatch({ type: 'applySection', kind: 'iSection' }))
    test()
    nextStep()
    fireEvent.click(gotIt())
    act(() => store.dispatch({ type: 'setParam', param: 'heightM', valueM: 0.06, mode: 'strict' }))
    test()
    nextStep()
    fireEvent.click(gotIt())
    act(() => {
      for (const [param, valueM] of [['heightM', 0.06], ['widthM', 0.04], ['flangeThicknessM', 0.004], ['webThicknessM', 0.003]] as const) store.dispatch({ type: 'setParam', param, valueM, mode: 'strict' })
    })
    test()
    expect(screen.queryByRole('dialog')).toBeNull()
    nextStep()
    expect(screen.getByRole('dialog', { name: 'All 4 steps complete' })).toBeTruthy()
    fireEvent.click(gotIt())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'All 4 steps complete' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'All 4 steps complete' }))
    expect(screen.getByRole('heading', { name: 'All experiments complete' })).toBeTruthy()
  })

  it('never stacks on another dialog: it waits for the Prediction dialog and opens when that closes', () => {
    setup(fresh('guided'), undefined, challenge, true)
    entered()
    fireEvent.click(gotIt())
    fireEvent.click(screen.getByRole('button', { name: 'Run Test' }))
    const prediction = screen.getByRole('dialog', { name: /./ })
    expect(within(prediction).getByRole('button', { name: 'Run structural test' })).toBeTruthy()
    // Meet the step while the prediction dialog is up: no second dialog appears.
    grow()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.click(within(prediction).getByLabelText('Decrease', { exact: true }))
    fireEvent.click(within(prediction).getByRole('button', { name: 'Run structural test' }))
    nextStep()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: /^Step 2 of 4: / })).toBeTruthy()
  })

  it('does not open while another dialog is on screen at entry, then opens when it closes', async () => {
    const other = document.createElement('div')
    other.setAttribute('role', 'dialog')
    other.setAttribute('aria-label', 'Other dialog')
    document.body.append(other)
    setup()
    entered()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    other.remove()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('dialog', { name: 'Step 1 of 4: Grow the circle' })).toBeTruthy()
  })

  it('Parametric has no stepper and no dialog', () => {
    setup(fresh('parametric'), undefined, challenge, true)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Guided steps' })).toBeNull()
  })

  it('shows the merged editable/lock line once and keeps a lock mark per locked control', () => {
    setup(fresh('guided'), undefined, challenge, true)
    entered()
    const line = screen.getByRole('dialog').querySelector('.guided-focus')!
    expect(line.textContent).toBe('Editable now: Diameter. Other parameters stay locked until a later step.')
    expect(screen.queryByText(/Locked in this step: everything except/)).toBeNull()
    expect(document.querySelectorAll('p.guided-lock')).toHaveLength(0)
    const rectangle = screen.getByRole('button', { name: /Rectangle/ })
    expect(rectangle.getAttribute('aria-disabled')).toBe('true')
    const mark = document.getElementById(rectangle.getAttribute('aria-describedby')!)!
    expect(mark.className).toBe('guided-lock-mark')
    expect(mark.querySelector('svg')).toBeTruthy()
    expect(mark.textContent).toBe('Locked in this step. Editable now: Diameter.')
  })

  it('shows no lock line when nothing is locked (Parametric, or the final step)', () => {
    setup(fresh('parametric'), undefined, challenge, true)
    expect(document.getElementById('guided-lock-line')).toBeNull()
  })
})

describe('mode is chosen before entry and fixed in the workbench (D-37)', () => {
  it.each(['guided', 'parametric'] as const)('keeps %s fixed with no mode-changing control and labels the mode', (mode) => {
    setup(fresh(mode), undefined, challenge, true)
    const before = store.state
    expect(screen.queryByRole('combobox', { name: 'Interaction mode' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Switch.*mode/ })).toBeNull()
    expect(screen.getByRole('region', { name: 'Design view' })).toBeTruthy()
    const context = screen.getByLabelText('Design mode')
    if (mode === 'guided') {
      expect(context.textContent).toContain('Guided mode')
      expect(context.textContent).toContain('Structured experiments')
      expect(screen.getByRole('region', { name: 'Guided experiments' })).toBeTruthy()
    } else {
      expect(context.textContent).toContain('Parametric mode')
      expect(context.textContent).toContain('Open design')
      expect(screen.queryByRole('region', { name: 'Guided experiments' })).toBeNull()
      expect(screen.queryByRole('list', { name: 'Experiment steps' })).toBeNull()
      expect(screen.getByText(/Every parameter is editable from the start/)).toBeTruthy()
    }
    expect(store.state).toBe(before)
  })

  it('preserves the entry-selected mode, pending prediction and saved workspace after reload', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
    const mounted = setup(fresh('parametric'), storage)
    act(() => { store.dispatch({ type: 'setPrediction', direction: 'decrease', now }); store.runTest(); store.runTest() })
    act(() => {
      store.dispatch({ type: 'toggleCompare', testResultId: 'test-2' })
      store.dispatch({ type: 'setReflection', text: 'Stored reasoning.' })
      store.submit('test-2')
      store.dispatch({ type: 'deleteIteration', testResultId: 'test-1' })
      store.dispatch({ type: 'setParam', param: 'flangeThicknessM', valueM: 0.004, mode: 'strict' })
      store.dispatch({ type: 'setPrediction', direction: 'decrease', now })
    })
    const before = store.state
    mounted.unmount()
    setup(fresh(), storage)
    expect(store.state).toEqual(before)
    expect(store.state.mode).toBe('parametric')
    expect(screen.queryByRole('region', { name: 'Guided experiments' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Interaction mode' })).toBeNull()
  })

  it('does not expose unsupported modes and rejects a disallowed entry selection', () => {
    const ch = { ...challenge, allowedModes: ['parametric'] as Challenge['allowedModes'] }
    setup(fresh('parametric'), undefined, ch)
    expect(screen.queryByRole('combobox', { name: 'Interaction mode' })).toBeNull()
    const before = store.state
    act(() => expect(store.selectMode('guided')).toBe(false))
    expect(store.state).toBe(before)
  })

  it('produces identical numerical/prediction/submission results for identical allowed actions in either mode', () => {
    const execute = (mode: 'guided' | 'parametric') => {
      setup(fresh(mode))
      act(() => {
        store.dispatch({ type: 'setOrientation', orientationDeg: 0 })
        store.dispatch({ type: 'setPrediction', direction: 'decrease', now })
        store.runTest()
        store.dispatch({ type: 'setReflection', text: 'Same model and constraints.' })
        store.submit('test-1')
      })
      const result = store.state
      cleanup()
      return result
    }
    const guided = execute('guided')
    expect(execute('parametric')).toEqual({ ...guided, mode: 'parametric' })
  })
})
