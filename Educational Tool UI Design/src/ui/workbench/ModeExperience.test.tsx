import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import type { Challenge } from '../../challenge/types'
import { initSession, type SessionState } from '../../state/session'
import type { SessionStorage } from '../../state/persistence'
import StoreProvider from '../state/StoreProvider'
import { useStore, type Store } from '../state/store'
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
afterEach(cleanup)

// The Baseline is a solid Ø31 mm circle (task 59, D-47 amendment): the beam's first experiment
// grows the diameter, the second changes the shape.
const grow = (valueM = 0.034) => act(() => store.dispatch({ type: 'setParam', param: 'diameterM', valueM, mode: 'strict' }))

describe('Guided structured experiments (task 58)', () => {
  it('shows the ordered single-variable steps with the first one current', () => {
    setup()
    const guide = screen.getByRole('region', { name: 'Guided experiments' })
    expect(within(guide).getByRole('button', { name: 'Grow the circle, current step' })).toBeTruthy()
    expect(steps()).toEqual(['Grow the circle, current step', 'Try another shape, locked', 'Tune one dimension, locked', 'Meet every check, locked'])
    expect(within(guide).getByRole('heading', { name: 'Grow the circle' })).toBeTruthy()
    expect(within(guide).getByText(/Increase only the diameter of the solid circle/)).toBeTruthy()
    expect(within(guide).getByText('Diameter')).toBeTruthy()
    expect(guide.querySelector('details')?.open).toBe(false)
  })

  it('advances only when a tested result meets the step objective, reporting stored changes', () => {
    setup()
    const before = store.state
    // Browsing the hint never changes the session.
    fireEvent.click(screen.getByText('Hint'))
    expect(store.state).toBe(before)
    // Retesting the unchanged Baseline does not meet "increase the diameter".
    test()
    expect(screen.getByRole('heading', { name: 'Grow the circle' })).toBeTruthy()
    expect(screen.getByText(/Iteration 1 did not complete this step yet/)).toBeTruthy()
    // A smaller circle changes the diameter in the wrong direction.
    grow(0.029)
    test()
    expect(screen.getByRole('heading', { name: 'Grow the circle' })).toBeTruthy()
    grow(0.034)
    test()
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
    expect(screen.getByRole('heading', { name: 'Meet every check' })).toBeTruthy()
    expect(screen.queryByText(/Locked in this step/)).toBeNull()
    act(() => {
      for (const [param, valueM] of [['heightM', 0.06], ['widthM', 0.04], ['flangeThicknessM', 0.004], ['webThicknessM', 0.003]] as const) store.dispatch({ type: 'setParam', param, valueM, mode: 'strict' })
    })
    test()
    expect(store.state.history.at(-1)?.accepted).toBe(true)
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
    expect(store.state).toEqual(before)
    expect([...values.values()].join('')).not.toMatch(/completions|progress|stepId/)
    expect(screen.getByRole('heading', { name: 'Try another shape' })).toBeTruthy()
  })
})

describe('Guided stepper, popover and lock line (tasks 78, 78.3)', () => {
  it('shows the stepper with the current step as the toggle of a non-modal popover that opens by itself', () => {
    setup()
    const guide = screen.getByRole('region', { name: 'Guided experiments' })
    const current = within(guide).getByRole('button', { name: 'Grow the circle, current step' })
    expect(current.closest('li')?.getAttribute('aria-current')).toBe('step')
    expect(current.getAttribute('aria-expanded')).toBe('true')
    // No "Step N of M" chip, and no experiments list in the popover (the stepper shows the steps).
    expect(screen.queryByText(/Step \d of \d/)).toBeNull()
    expect(screen.queryByRole('list', { name: 'Experiment steps' })).toBeNull()
    const popover = within(guide).getByRole('group', { name: 'Guided step instructions' })
    expect(popover.getAttribute('id')).toBe(current.getAttribute('aria-controls'))
    expect(popover.querySelector('ol')).toBeNull()
    expect(within(popover).getByText(/Increase only the diameter of the solid circle/)).toBeTruthy()
    expect(within(popover).getByRole('heading', { name: 'Grow the circle' })).toBeTruthy()
    expect(document.activeElement).toBe(document.body)
    expect(popover.querySelector('details')?.open).toBe(false)
    // The lock line is inside the popover, after "Editable now".
    const focus = popover.querySelector('.guided-focus')!
    const line = popover.querySelector('#guided-lock-line')!
    expect(line.textContent).toContain('Locked in this step: everything except diameter.')
    expect((focus.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true)
    // Completed and locked steps are not buttons; the row adds one tab stop.
    expect(within(screen.getByRole('navigation', { name: 'Guided steps' })).getAllByRole('button')).toEqual([current])
  })

  it('closing the popover hides the lock line with it and the current step reopens it', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    const line = document.getElementById('guided-lock-line')!
    expect(line.closest('.guided-popover')?.hasAttribute('hidden')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Grow the circle, current step' }))
    expect(line.closest('.guided-popover')?.hasAttribute('hidden')).toBe(false)
  })

  it('reopens on a new step, leaves a closed popover closed on a retest of the same step', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('button', { name: 'Grow the circle, current step' }).getAttribute('aria-expanded')).toBe('false')
    // A step change reopens it, still without focus.
    grow()
    test()
    const next = screen.getByRole('button', { name: 'Try another shape, current step' })
    expect(next.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(document.body)
  })

  it('replaces the per-control sentences with one lock line and a lock mark per locked control', () => {
    setup(fresh('guided'), undefined, challenge, true)
    const line = document.getElementById('guided-lock-line')!
    expect(line.textContent).toContain('Locked in this step: everything except diameter. Others unlock in later steps.')
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
