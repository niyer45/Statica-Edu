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
  const announce = vi.fn()
  const rendered = render(<StoreProvider challenge={ch} initialSession={initial} clock={() => now} newId={() => `test-${++id}`} storage={storage}>
    {full ? <Workbench onExit={() => {}} /> : <ModeExperience onAnnounce={announce} />}<Probe />
  </StoreProvider>)
  return { ...rendered, announce }
}
const select = () => screen.getByRole('combobox', { name: 'Interaction mode' })
const switchTo = (mode: string) => fireEvent.change(select(), { target: { value: mode } })
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
    expect(within(guidance).getByText(/Try a diameter change/)).toBeTruthy()
    expect(store.state).toBe(before)
    fireEvent.click(within(guidance).getByRole('button', { name: '3. Compare' }))
    expect(guidance.querySelector('details')?.open).toBe(false)
    expect(store.state).toBe(before)
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

  it('Parametric removes scaffolding, preserves mounted editor elements and announces switching', () => {
    setup(fresh(), undefined, challenge, true)
    const input = screen.getByRole('spinbutton', { name: /Diameter/ })
    const viewport = screen.getByRole('region', { name: 'Design view' })
    const before = store.state
    select().focus()
    switchTo('parametric')
    expect(screen.queryByRole('region', { name: 'Guided instructions' })).toBeNull()
    expect(screen.queryByRole('list', { name: 'Workflow' })).toBeNull()
    expect(screen.getByText('Direct section and dimension editing')).toBeTruthy()
    expect(screen.getByRole('spinbutton', { name: /Diameter/ })).toBe(input)
    expect(screen.getByRole('region', { name: 'Design view' })).toBe(viewport)
    expect(document.activeElement).toBe(select())
    expect(store.state).toEqual({ ...before, mode: 'parametric' })
    expect(screen.getByTestId('live-region').textContent).toContain('Parametric mode')
    switchTo('guided')
    expect(screen.getByRole('region', { name: 'Guided instructions' })).toBeTruthy()
    expect(screen.getByRole('spinbutton', { name: /Diameter/ })).toBe(input)
    expect(store.state).toEqual(before)
  })

  it('preserves pending prediction, archived history, comparison, reflection and submission across switching/reload', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
    const mounted = setup(fresh(), storage)
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
    switchTo('parametric')
    expect(store.state).toEqual({ ...before, mode: 'parametric' })
    expect(store.state.history).toBe(before.history)
    expect(store.state.draft).toBe(before.draft)
    mounted.unmount()
    setup(fresh(), storage)
    expect(store.state).toEqual({ ...before, mode: 'parametric' })
    expect(select()).toHaveProperty('value', 'parametric')
    switchTo('guided')
    expect(store.state).toEqual(before)
  })

  it('only offers allowed modes and never offers Freeform', () => {
    const ch = { ...challenge, allowedModes: ['parametric'] as Challenge['allowedModes'] }
    setup({ ...fresh(), mode: 'parametric' }, undefined, ch)
    expect(within(select()).getAllByRole('option').map((node) => node.textContent)).toEqual(['Parametric'])
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
