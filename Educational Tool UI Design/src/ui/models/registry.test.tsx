import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { torsionChallenge } from '../../../test/fixtures/torsion'
import type { TorsionChallenge } from '../../challenge/torsion/types'
import type { TorsionEfficiency } from '../../evaluation/torsion/types'
import { torsionRuntime, type ModelRuntime } from '../../state/runtimes'
import type { TorsionAction, TorsionSession } from '../../state/torsionModel'
import { bootstrapWith } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { useModelStore } from '../state/store'
import Workbench from '../workbench/Workbench'
import { beamUi } from './beam'
import { vibrationUi } from './vibration'
import { heatSinkUi } from './heatSink'
import { modelUiFor, ModelUiContext } from './registry'
import type { ModelUi } from './types'

// Model UI registry contract (task 34.2; MM-20, MM-21). The workbench renders a non-beam model
// entirely through its registered slots and wording; a model without a UI cannot render. The
// torsion UI below is a test-only stand-in passed through ModelUiContext; the production registry
// entries are checked separately.

const clock = () => '2026-10-17T00:00:00.000Z'
let n = 0
const newId = () => `id-${++n}`
const tch = torsionChallenge()

function TestTools() {
  const store = useModelStore<TorsionSession, TorsionAction, TorsionChallenge>()
  return (
    <div>
      <p>Torsion tools for {store.challenge.title}</p>
      <button type="button" onClick={() => store.dispatch({ type: 'edit', edit: { type: 'setSection', kind: 'tube' } })}>Use tube</button>
      <button type="button" onClick={() => store.dispatch({ type: 'edit', edit: { type: 'setParam', param: 'outerDiameterM', valueM: 0.05, mode: 'strict' } })}>OD 50</button>
      <button type="button" onClick={() => store.dispatch({ type: 'edit', edit: { type: 'setParam', param: 'innerDiameterM', valueM: 0.044, mode: 'strict' } })}>ID 44</button>
      <button type="button" onClick={store.runTest}>Run torsion test</button>
      <output aria-label="Torsion history">{store.state.history.length}</output>
    </div>
  )
}

const testUi: ModelUi = {
  copy: {
    tagline: 'Limit twist within stress, mass and packaging limits.',
    guidedContext: 'Guided shaft context.',
    parametricContext: 'Parametric shaft context.',
    parametricLabel: 'Direct shaft diameter editing',
    solverLabel: 'Saint-Venant · Circular shaft torsion',
    limitsNotice: 'Idealized circular-shaft torsion, not a certification',
    drawerAvailable: 'Available with an idealized torsion model.',
    prediction: { title: 'Predict twist', question: (p) => `Compared with ${p}, how will twist change?`, legend: 'Predicted change in twist angle' },
    efficiency: (e) => [{ label: 'Twist margin', value: (e as TorsionEfficiency).twistMargin }],
  },
  Tools: TestTools,
  View: () => <p>Torsion view</p>,
  ChallengePanel: () => <p>Torsion challenge panel</p>,
  Results: () => <p>Torsion results</p>,
  Help: ({ open }) => (open ? <p>Torsion help</p> : null),
  guidance: {
    steps: [
      { id: 'inspect', title: 'Inspect', instruction: 'Find the limit the solid shaft misses.', hint: 'Shaft hint.' },
      { id: 'experiment', title: 'Experiment', instruction: 'Change one diameter.', hint: 'One at a time.' },
      { id: 'compare', title: 'Compare', instruction: 'Compare twist per kilogram.', hint: 'Mass hint.' },
      { id: 'explain', title: 'Explain', instruction: 'Explain with tested values.', hint: 'Explain hint.' },
    ],
    experiment: () => undefined,
  },
}

function renderTorsion(mode: 'guided' | 'parametric' = 'guided', registry: ReadonlyMap<string, ModelUi> | null = new Map([['circularShaftTorsion', testUi]])) {
  const init = torsionRuntime.init(tch, clock(), 'base', mode)
  if (!init.ok) throw new Error('torsion challenge must initialize')
  return render(
    <ModelUiContext.Provider value={registry}>
      <StoreProvider challenge={tch} initialSession={init.value} runtime={torsionRuntime as unknown as ModelRuntime} clock={clock} newId={newId}>
        <Workbench onExit={() => {}} />
      </StoreProvider>
    </ModelUiContext.Provider>,
  )
}

afterEach(cleanup)

describe('model UI registry', () => {
  it('keeps the beam wording unchanged and registers no UI for models without one', () => {
    expect(modelUiFor({ id: 'eulerBernoulliCantileverTipForce', version: 1 })).toBe(beamUi)
    expect(modelUiFor({ id: 'sdofBaseIsolation', version: 1 })).toBe(vibrationUi)
    expect(modelUiFor({ id: 'plateFinHeatSink', version: 1 })).toBe(heatSinkUi)
    expect(modelUiFor({ id: 'pinJointedBracedFrame', version: 1 })).toBeUndefined()
    expect(beamUi.copy.limitsNotice).toBe('Idealized beam approximation, not a structural certification')
    expect(beamUi.copy.prediction.title).toBe('Predict deflection')
    expect(beamUi.copy.prediction.question('the Baseline')).toBe('Compared with the Baseline, how will your new section change tip deflection?')
  })

  it('renders a non-beam workbench entirely through its slots and wording', () => {
    renderTorsion()
    expect(screen.getByText('Torsion tools for Torsion Shaft I')).toBeTruthy()
    expect(screen.getByText('Torsion view')).toBeTruthy()
    expect(screen.getByText('Torsion challenge panel')).toBeTruthy()
    expect(screen.getByText('Torsion results')).toBeTruthy()
    expect(screen.getByText('Idealized circular-shaft torsion, not a certification')).toBeTruthy()
    expect(screen.getByText('Limit twist within stress, mass and packaging limits.')).toBeTruthy()
    expect(screen.getByText('Saint-Venant · Circular shaft torsion')).toBeTruthy()
    expect(screen.getByText('Find the limit the solid shaft misses.')).toBeTruthy()
    // No beam wording leaks into the non-beam workbench.
    expect(screen.queryByText(/beam/i)).toBeNull()
    expect(screen.queryByText(/deflection/i)).toBeNull()
  })

  it('runs the shared prediction and submission dialogs with the model wording', () => {
    renderTorsion()
    for (const name of ['Use tube', 'OD 50', 'ID 44', 'Run torsion test']) fireEvent.click(screen.getByRole('button', { name }))
    const dialog = screen.getByRole('dialog', { name: 'Predict twist' })
    expect(within(dialog).getByText('Compared with the Baseline, how will twist change?')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('radio', { name: /Decrease/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Run structural test/ }))
    expect(screen.getByLabelText('Torsion history').textContent).toBe('2')
  })

  it('shows the model parametric label and no guidance in Parametric mode', () => {
    renderTorsion('parametric')
    expect(screen.getByText('Direct shaft diameter editing')).toBeTruthy()
    expect(screen.queryByText('Find the limit the solid shaft misses.')).toBeNull()
  })

  it('refuses to render a model that has no registered UI', () => {
    expect(() => renderTorsion('guided', new Map())).toThrow('No workbench is available for analysis model "circularShaftTorsion".')
  })
})

describe('bootstrapWith (task 34.2)', () => {
  it('boots a registered model with a UI and refuses one without', () => {
    const ok = bootstrapWith({ ok: true, value: tch }, clock, newId, () => true)
    if (!ok.ok) throw new Error(ok.error.message)
    expect(ok.value.runtime).toBe(torsionRuntime)
    expect(ok.value.session.challengeId).toBe('torsion-shaft-1')
    const refused = bootstrapWith({ ok: true, value: tch }, clock, newId, () => false)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.error.issues[0]!.rule).toBe('MODEL_UI_UNAVAILABLE')
  })
})
