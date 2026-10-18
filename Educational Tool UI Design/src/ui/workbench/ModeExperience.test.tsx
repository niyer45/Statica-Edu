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
const diameter = () => (store.state.draft.section as { diameterM: number }).diameterM
const test = () => act(() => { store.dispatch({ type: 'setPrediction', direction: 'decrease', now }); store.runTest() })
const steps = () => within(screen.getByRole('list', { name: 'Experiment steps' })).getAllByRole('listitem').map((li) => li.textContent)
afterEach(cleanup)

describe('Guided structured experiments (task 58)', () => {
  it('shows the ordered single-variable steps with the first one current', () => {
    setup()
    const guide = screen.getByRole('region', { name: 'Guided experiments' })
    expect(within(guide).getByText(/Step 1 of 4/)).toBeTruthy()
    expect(steps()).toEqual(['1. Make it deeper, current step', '2. Try another shape, locked', '3. Tune one dimension, locked', '4. Meet every check, locked'])
    expect(within(guide).getByRole('heading', { name: 'Make it deeper' })).toBeTruthy()
    expect(within(guide).getByText(/Increase only the depth/)).toBeTruthy()
    expect(within(guide).getByText('Depth (diameter or height)')).toBeTruthy()
    expect(guide.querySelector('details')?.open).toBe(false)
  })

  it('advances only when a tested result meets the step objective, reporting stored changes', () => {
    setup()
    const before = store.state
    // Browsing the hint never changes the session.
    fireEvent.click(screen.getByText('Hint'))
    expect(store.state).toBe(before)
    // Decreasing the depth does not meet "increase only the depth".
    act(() => store.dispatch({ type: 'setParam', param: 'diameterM', valueM: diameter() - 0.002, mode: 'strict' }))
    test()
    expect(screen.getByRole('heading', { name: 'Make it deeper' })).toBeTruthy()
    expect(screen.getByText(/Iteration 1 did not complete this step yet/)).toBeTruthy()
    act(() => store.dispatch({ type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' }))
    test()
    expect(screen.getByRole('heading', { name: 'Try another shape' })).toBeTruthy()
    expect(screen.getByText(/Step 2 of 4/)).toBeTruthy()
    expect(screen.getByText(/Make it deeper complete: Iteration 2 compared with Iteration 1\. Tip deflection decreased; Mass increased\./)).toBeTruthy()
    expect(steps()[0]).toBe('1. Make it deeper, complete')
  })

  it('locks every control the current step does not unlock; Parametric locks nothing', () => {
    setup(fresh('guided'), undefined, challenge, true)
    const field = screen.getByRole('spinbutton', { name: /Diameter/ }) as HTMLInputElement
    expect(field.readOnly).toBe(false)
    const rectangle = screen.getByRole('button', { name: /Rectangle/ })
    expect(rectangle.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Locked in this step. Editable now: Depth (diameter or height).')).toBeTruthy()
    const before = store.state
    fireEvent.click(rectangle)
    fireEvent.keyDown(rectangle, { key: 'Enter' })
    expect(store.state).toBe(before)
    // A direct dispatch (e.g. a viewport drop) is rejected by the runtime lock with a reason.
    act(() => store.dispatch({ type: 'applySection', kind: 'rectangle' }))
    expect(store.state.draft).toBe(before.draft)
    expect(store.state.ui.notice?.message).toBe('Section shape is locked in this Guided step. Editable now: Depth (diameter or height).')

    // Step 2 unlocks the shape and locks the diameter.
    act(() => store.dispatch({ type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' }))
    test()
    expect((screen.getByRole('spinbutton', { name: /Diameter/ }) as HTMLInputElement).readOnly).toBe(true)
    expect((screen.getByRole('slider', { name: /Diameter slider/ }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Rectangle/ }).getAttribute('aria-disabled')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Rectangle/ }))
    expect(store.state.draft.section.kind).toBe('rectangle')
    cleanup()

    setup(fresh('parametric'), undefined, challenge, true)
    expect(screen.queryByRole('region', { name: 'Guided experiments' })).toBeNull()
    expect(screen.queryByText(/Locked in this step/)).toBeNull()
    expect((screen.getByRole('spinbutton', { name: /Diameter/ }) as HTMLInputElement).readOnly).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Rectangle/ }))
    expect(store.state.draft.section.kind).toBe('rectangle')
  })

  it('opens every parameter in the final step and completes on an Accepted test', () => {
    setup(fresh('guided'), undefined, challenge, true)
    act(() => store.dispatch({ type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' }))
    test()
    act(() => store.dispatch({ type: 'applySection', kind: 'rectangle' }))
    test()
    act(() => store.dispatch({ type: 'setParam', param: 'heightM', valueM: 0.05, mode: 'strict' }))
    test()
    expect(screen.getByRole('heading', { name: 'Meet every check' })).toBeTruthy()
    expect(screen.queryByText(/Locked in this step/)).toBeNull()
    act(() => {
      store.dispatch({ type: 'applySection', kind: 'iSection' })
      for (const [param, valueM] of [['heightM', 0.06], ['widthM', 0.04], ['flangeThicknessM', 0.004], ['webThicknessM', 0.003]] as const) store.dispatch({ type: 'setParam', param, valueM, mode: 'strict' })
    })
    test()
    expect(store.state.history.at(-1)?.accepted).toBe(true)
    expect(screen.getByRole('heading', { name: 'All experiments complete' })).toBeTruthy()
    expect(screen.getByText(/All 4 steps complete/)).toBeTruthy()
  })

  it('keeps step progress after reload without a new persisted field', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
    const mounted = setup(fresh('guided'), storage)
    act(() => store.dispatch({ type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' }))
    test()
    const before = store.state
    mounted.unmount()
    setup(fresh('guided'), storage)
    expect(store.state).toEqual(before)
    expect([...values.values()].join('')).not.toMatch(/completions|progress|stepId/)
    expect(screen.getByRole('heading', { name: 'Try another shape' })).toBeTruthy()
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
      store.dispatch({ type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' })
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
        store.dispatch({ type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' })
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
