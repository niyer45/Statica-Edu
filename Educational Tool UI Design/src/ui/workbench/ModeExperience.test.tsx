import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import type { Challenge } from '../../challenge/types'
import { initSession, type SessionState } from '../../state/session'
import type { SessionStorage } from '../../state/persistence'
import StoreProvider from '../state/StoreProvider'
import { useStore, type Store } from '../state/store'
import ModeExperience, { recommendedStep } from './ModeExperience'
import Workbench from './Workbench'

vi.mock('../viewport/Viewport3D', () => ({ default: () => <div>Mode test viewport</div> }))
if (!bundledChallengeResult.ok) throw new Error('Invalid challenge')
const challenge = bundledChallengeResult.value
const now = '2026-10-16T00:00:00.000Z'
function fresh(): SessionState {
  const result = initSession(challenge, now, 'baseline')
  if (!result.ok) throw new Error('Invalid initial session')
  return result.value
}
let store: Store
function Probe() { store = useStore(); return null }
function setup(initial = fresh(), storage?: SessionStorage, ch: Challenge = challenge, full = false) {
  let id = 0
  const rendered = render(<StoreProvider challenge={ch} initialSession={initial} clock={() => now} newId={() => `test-${++id}`} storage={storage}>
    {full ? <Workbench onExit={() => {}} /> : <ModeExperience />}<Probe />
  </StoreProvider>)
  return rendered
}
afterEach(cleanup)

describe('mode guidance (task 44)', () => {
  it('offers collapsed hints and browsable guidance without changing the session', () => {
    setup()
    const before = store.state
    const guidance = screen.getByRole('region', { name: 'Guided instructions' })
    expect(within(guidance).getByRole('heading', { name: 'Inspect' })).toBeTruthy()
    expect(guidance.querySelector('details')?.open).toBe(false)
    fireEvent.click(within(guidance).getByRole('button', { name: '2. Experiment' }))
    fireEvent.click(within(guidance).getByText('Hint & suggested experiment'))
    expect(guidance.querySelector('details')?.open).toBe(true)
    // The baseline is an I-section turned 90°, so the suggested experiment is a rotation (task 59).
    expect(within(guidance).getByText(/Try rotating a rectangle or I-section/)).toBeTruthy()
    expect(store.state).toBe(before)
    fireEvent.click(within(guidance).getByRole('button', { name: '3. Compare' }))
    expect(guidance.querySelector('details')?.open).toBe(false)
    expect(store.state).toBe(before)
  })

  it('suggests a diameter change once the draft is round', () => {
    setup()
    act(() => store.dispatch({ type: 'applySection', kind: 'circle' }))
    const guidance = screen.getByRole('region', { name: 'Guided instructions' })
    fireEvent.click(within(guidance).getByText('Hint & suggested experiment'))
    expect(within(guidance).getByText(/Try a diameter change/)).toBeTruthy()
  })

  it('recommends guidance from actual changes and uses orientation hints for non-round sections', () => {
    setup()
    act(() => store.dispatch({ type: 'applySection', kind: 'rectangle' }))
    const guidance = screen.getByRole('region', { name: 'Guided instructions' })
    expect(within(guidance).getByRole('heading', { name: 'Experiment' })).toBeTruthy()
    fireEvent.click(within(guidance).getByText('Hint & suggested experiment'))
    expect(within(guidance).getByText(/Try rotating a rectangle/)).toBeTruthy()
    act(() => { store.dispatch({ type: 'setPrediction', direction: 'decrease', now }); store.runTest() })
    expect(within(guidance).getByRole('heading', { name: 'Compare' })).toBeTruthy()
    act(() => store.dispatch({ type: 'setReflection', text: 'One tradeoff.' }))
    expect(within(guidance).getByRole('heading', { name: 'Explain' })).toBeTruthy()
  })

  it.each(['guided', 'parametric'] as const)('keeps %s fixed in the workbench with no mode-changing control', (mode) => {
    setup({ ...fresh(), mode }, undefined, challenge, true)
    const before = store.state
    expect(screen.queryByRole('combobox', { name: 'Interaction mode' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Switch.*mode/ })).toBeNull()
    expect(screen.getByRole('spinbutton', { name: /^Flange thickness/ })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Design view' })).toBeTruthy()
    if (mode === 'guided') {
      expect(screen.getByRole('region', { name: 'Guided instructions' })).toBeTruthy()
      expect(screen.getByRole('list', { name: 'Workflow' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: '3. Compare' }))
    } else {
      expect(screen.queryByRole('region', { name: 'Guided instructions' })).toBeNull()
      expect(screen.queryByRole('list', { name: 'Workflow' })).toBeNull()
      expect(screen.getByText('Direct section and dimension editing')).toBeTruthy()
    }
    expect(store.state).toBe(before)
  })

  it('preserves the entry-selected mode, pending prediction and saved workspace after reload', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
    const mounted = setup({ ...fresh(), mode: 'parametric' }, storage)
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
    expect(screen.queryByRole('region', { name: 'Guided instructions' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Interaction mode' })).toBeNull()
  })

  it('does not expose unsupported modes and rejects a disallowed entry selection', () => {
    const ch = { ...challenge, allowedModes: ['parametric'] as Challenge['allowedModes'] }
    setup({ ...fresh(), mode: 'parametric' }, undefined, ch)
    expect(screen.queryByRole('combobox', { name: 'Interaction mode' })).toBeNull()
    const before = store.state
    act(() => expect(store.selectMode('guided')).toBe(false))
    expect(store.state).toBe(before)
  })

  it('produces identical numerical/prediction/submission results for identical actions in either mode', () => {
    const execute = (mode: 'guided' | 'parametric') => {
      setup({ ...fresh(), mode })
      act(() => {
        store.dispatch({ type: 'applySection', kind: 'rectangle' })
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

  it('does not count archived tests or guidance browsing as progress', () => {
    const state = fresh()
    const archived = { ...state.history[0]!, id: 'archived', iteration: 1 }
    expect(recommendedStep({ ...state, history: [...state.history, archived], deletedIterationIds: ['archived'] })).toBe('inspect')
    expect(recommendedStep({ ...state, draftStatus: 'draft' })).toBe('experiment')
    expect(recommendedStep({ ...state, history: [...state.history, archived] })).toBe('compare')
    expect(recommendedStep({ ...state, reflectionAnswer: 'Reflection started.' })).toBe('explain')
  })
})
