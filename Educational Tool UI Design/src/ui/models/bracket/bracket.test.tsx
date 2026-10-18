import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bracket, bracketChallenge } from '../../../../test/fixtures/bracket'
import { bracketModel, bracketReducer, type BracketAction, type BracketSession } from '../../../state/bracketModel'
import { bracketRuntime, type LoopSession, type ModelRuntime } from '../../../state/runtimes'
import type { SessionStorage } from '../../../state/persistence'
import StoreProvider from '../../state/StoreProvider'
import Workbench from '../../workbench/Workbench'
import { modelUiFor } from '../registry'
import { bracketUi, BRACKET_LIMITS_NOTICE } from '.'
import { STRIP_LABEL } from './BracketDetails'
import { ELEVATION_LABEL } from './BracketElevation'
import { BRACKET_FALLBACK_NOTICE } from './BracketView'

// The real 3D scene needs WebGL; these tests replace the lazy chunk to drive the 3D-or-2D switch.
const scene = vi.hoisted(() => ({ mode: 'ok' as 'ok' | 'throw' }))
vi.mock('./BracketScene3D', () => ({
  default: ({ onContextLost }: { onContextLost: () => void }) => {
    if (scene.mode === 'throw') throw new Error('Canvas creation failed')
    return <button type="button" onClick={onContextLost}>Stub 3D scene: lose context</button>
  },
}))

// Mounting Bracket I workbench (task 46.3) through the PRODUCTION model UI registry. The
// challenge is booted directly here; card activation is a separate, owner-approved step.
// Expected numbers are the worksheet values (design.md) rounded for display.

const clock = () => '2026-10-17T00:00:00.000Z'
let n = 0
const newId = () => `b-${++n}`
const ch = bracketChallenge()

function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
  return { values, storage }
}

function renderBracket(mode: 'guided' | 'parametric' = 'guided', storage?: SessionStorage) {
  const init = bracketRuntime.init(ch, clock(), 'base', mode)
  if (!init.ok) throw new Error('bracket challenge must initialize')
  return render(
    <StoreProvider challenge={ch} initialSession={init.value} runtime={bracketRuntime as unknown as ModelRuntime} storage={storage ?? null} clock={clock} newId={newId}>
      <Workbench onExit={() => {}} />
    </StoreProvider>,
  )
}

const setMm = (label: string, value: string) => {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

/** A stored session after testing designs through the real reducer (no UI). */
function testedSession(...designs: [number, number, number, number][]): BracketSession {
  const init = bracketRuntime.init(ch, clock(), 'base', 'guided')
  if (!init.ok) throw new Error('bracket challenge must initialize')
  return designs.reduce<BracketSession>((s, [D, d, a, r], i) => {
    const actions: BracketAction[] = [
      { type: 'importDesign', json: bracketModel.exportDesign(bracket(`d${i}`, D, d, a, r), ch) },
      { type: 'setPrediction', direction: 'decrease', now: clock() },
      { type: 'runTest', now: clock(), id: `r${i}` },
    ]
    return actions.reduce((acc, act) => bracketReducer(acc, act, ch), s)
  }, init.value)
}

const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value

/** Runs a test, answering the checkpoint prediction when the dialog opens. */
function runTest(direction?: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: 'Run Test' }))
  if (direction === undefined) return
  const dialog = screen.getByRole('dialog', { name: 'Predict peak stress' })
  expect(within(dialog).getByText(/how will your new bracket change its peak stress\?/)).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('radio', { name: direction }))
  fireEvent.click(within(dialog).getByRole('button', { name: /Run structural test/ }))
}

/** Baseline → spec reference (D 30, d 20, a 175, r 3 mm) with the iteration-1 prediction. */
function testReference() {
  setMm('Step location', '175')
  setMm('Fillet radius', '3')
  runTest(/Decrease/)
}

const peakRequirement = () => within(screen.getByRole('list', { name: 'Design requirements' })).getByText('Peak stress').closest('li')!

afterEach(cleanup)

describe('Mounting Bracket I workbench', () => {
  it('is registered in the production model UI registry', () => {
    expect(modelUiFor(ch.model)).toBe(bracketUi)
  })

  it('shows the baseline peak-stress failure at the step with bracket wording only', () => {
    renderBracket()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(peakRequirement()).getByText('157.9 MPa')).toBeTruthy()
    expect(within(peakRequirement()).getByText('✗ Fail')).toBeTruthy()
    expect(within(requirements).getAllByText('✗ Fail')).toHaveLength(1)
    expect(screen.getAllByText(/Peak stress 157\.9 MPa at the step · Kt at the step 2\.34/).length).toBeGreaterThan(0)
    expect(screen.getByText(BRACKET_LIMITS_NOTICE)).toBeTruthy()
    // jsdom has no WebGL2: the 2D side view (wall, plate, bolts, bar, hanging load) shows with a notice.
    expect(screen.getByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    expect(screen.getAllByText(BRACKET_FALLBACK_NOTICE).length).toBeGreaterThan(0)
    expect(screen.getByText(/A flat bracket bolted to a wall carries a load hanging from its tip/)).toBeTruthy()
    const view = screen.getByRole('img', { name: STRIP_LABEL })
    // The governing section is a distinct shape (filled triangle), not only a color.
    expect(view.querySelectorAll('polygon.governing-marker')).toHaveLength(1)
    expect(view.querySelectorAll('circle.section-marker')).toHaveLength(1)
    const sections = screen.getByRole('table', { name: 'Checked sections of the latest tested design' })
    expect(within(within(sections).getByRole('row', { name: /^Step/ })).getByText('Yes (triangle)')).toBeTruthy()
    expect(within(within(sections).getByRole('row', { name: /^Root/ })).getByText('No')).toBeTruthy()
    expect(screen.queryByText(/beam/i)).toBeNull()
    expect(screen.queryByText(/torsion|twist|shaft/i)).toBeNull()
  })

  it('runs the learning loop to an Accepted reference with a scored peak-stress prediction', () => {
    renderBracket()
    testReference()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(peakRequirement()).getByText('90.8 MPa')).toBeTruthy()
    expect(within(requirements).queryByText('✗ Fail')).toBeNull()
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    expect(within(screen.getByLabelText('Result status')).getByText(/Accepted/)).toBeTruthy()
    fireEvent.click(screen.getAllByText('Test details').at(-1)!)
    expect(screen.getByText(/Prediction: decrease · Actual: decrease · Matched/)).toBeTruthy()
  })

  it('reports a design outside the Kt fit as not applicable, with reasons and a not-scorable prediction', () => {
    renderBracket()
    // fitShallowNA: D 30, d 29.5, a 150, r 5 mm (h/r 0.05).
    setMm('Arm depth', '29.5')
    setMm('Fillet radius', '5')
    runTest(/Decrease/)
    const peak = peakRequirement()
    expect(within(peak).getByText('Not applicable')).toBeTruthy()
    expect(within(peak).queryByText(/MPa \//)).toBeNull()
    expect(peak.textContent).not.toMatch(/\d+(\.\d+)? MPa \/ 120/)
    expect(screen.getAllByText(/Peak stress not applicable: the shoulder-fillet curve fit does not cover this step/).length).toBeGreaterThan(0)
    const reasons = screen.getByRole('list', { name: 'Model applicability reasons' })
    expect(within(reasons).getAllByRole('listitem').length).toBeGreaterThanOrEqual(2)
    const stresses = screen.getByRole('table', { name: 'Latest tested stresses' })
    expect(within(within(stresses).getByRole('row', { name: /^Kt at the step/ })).getByText('Not applicable')).toBeTruthy()
    expect(within(within(stresses).getByRole('row', { name: /^Step peak stress/ })).getByText('Not applicable')).toBeTruthy()
    expect(within(screen.getByLabelText('Result status')).getByText(/Model not applicable/)).toBeTruthy()
    // No governing marker without a peak stress.
    expect(screen.getByRole('img', { name: STRIP_LABEL }).querySelectorAll('polygon.governing-marker')).toHaveLength(0)
    fireEvent.click(screen.getAllByText('Test details').at(-1)!)
    expect(screen.getByText('Prediction: decrease · Not scorable: no peak stress to compare')).toBeTruthy()
  })

  it('rejects an arm deeper than the root inline without changing the draft', () => {
    renderBracket()
    setMm('Arm depth', '35')
    const input = screen.getByLabelText('Arm depth')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toMatch(/^Arm depth: Arm depth must not exceed the root depth/)
    expect(value('Root depth')).toBe('30.0')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(value('Arm depth')).toBe('20.0')
    setMm('Fillet radius', 'abc')
    expect(screen.getByLabelText('Fillet radius').getAttribute('aria-invalid')).toBe('true')
    expect(value('Step location')).toBe('150.0')
  })

  it('shows "no step" for equal depths while the step location and fillet radius stay editable', () => {
    renderBracket()
    setMm('Arm depth', '30')
    expect(screen.getByText(/No step: the arm depth equals the root depth/)).toBeTruthy()
    setMm('Step location', '200')
    expect(value('Step location')).toBe('200.0')
    setMm('Fillet radius', '4')
    expect(value('Fillet radius')).toBe('4.0')
    runTest(/Decrease/)
    expect(screen.getAllByText(/Peak stress 60\.0 MPa at the root · no step: stress concentration not applied/).length).toBeGreaterThan(0)
    const sections = screen.getByRole('table', { name: 'Checked sections of the latest tested design' })
    expect(within(sections).getByText('No step: stress concentration not applied')).toBeTruthy()
  })

  it('compares, restores and deletes with the shared semantics', () => {
    renderBracket()
    testReference()
    fireEvent.click(screen.getByRole('tab', { name: 'Compare results' }))
    const table = screen.getByRole('table', { name: 'Iteration 1 differences' })
    expect(within(table).getByText('peak stress')).toBeTruthy()
    expect(within(table).getByText('Kt at the step')).toBeTruthy()
    expect(within(table).getAllByText(/^−/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Design history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore Baseline' }))
    expect(value('Step location')).toBe('150.0')
    expect(value('Fillet radius')).toBe('1.0')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Iteration 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Iteration 1?' })).getByRole('button', { name: 'Delete iteration' }))
    expect(screen.queryByRole('button', { name: /^Iteration 1/ })).toBeNull()
  })

  it('opens the stress-concentration reference with the Kt source disclosure and unsupported effects', () => {
    renderBracket()
    fireEvent.click(screen.getByRole('button', { name: /Stress concentration reference/ }))
    const dialog = screen.getByRole('dialog', { name: 'Stress concentration' })
    expect(within(dialog).getByText(/transcribed from secondary copies of Peterson's charts as fitted in Roark's formulas, pending printed-edition verification/)).toBeTruthy()
    expect(within(dialog).getByText(/fatigue and notch sensitivity/)).toBeTruthy()
    expect(within(dialog).getByText(/not a\s+real-world approval/)).toBeTruthy()
  })

  it('Parametric omits guidance and shows the direct-edit label', () => {
    renderBracket('parametric')
    expect(screen.getByText('Direct depth, step and fillet editing')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Guided instructions' })).toBeNull()
  })

  it('Guided steps never reveal the reference dimensions', () => {
    renderBracket()
    const guidance = screen.getByRole('region', { name: 'Guided instructions' })
    expect(within(guidance).getByRole('heading', { name: 'Inspect' })).toBeTruthy()
    const text = bracketUi.guidance.steps.map((s) => `${s.instruction} ${s.hint}`).join(' ')
    expect(text).not.toMatch(/\d/)
  })

  it('persists the tested workspace under its own key in the v2 envelope', () => {
    const { values, storage } = memory()
    renderBracket('guided', storage)
    testReference()
    const saved = JSON.parse(values.get('ei:session:mounting-bracket-1:v1')!)
    expect(saved).toMatchObject({ schemaVersion: 2, model: { id: 'steppedBarBracket', version: 1 } })
    cleanup()
    renderBracket('guided', storage)
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    expect(within(peakRequirement()).getByText('90.8 MPa')).toBeTruthy()
  })

  it('imports a valid v2 design file and rejects an invalid one with its reasons', async () => {
    renderBracket()
    const file = (text: string) => new File([text], 'design.json', { type: 'application/json' })
    const valid = bracketModel.exportDesign(bracket('imported', 0.03, 0.02, 0.19, 0.001), ch)
    fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file(valid)] } })
    await waitFor(() => expect(value('Step location')).toBe('190.0'))
    expect(screen.queryByRole('button', { name: /^Iteration 1/ })).toBeNull()
    const invalid = JSON.parse(valid)
    invalid.design.armDepthM = 0.035
    fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file(JSON.stringify(invalid))] } })
    const dialog = await screen.findByRole('dialog', { name: 'Design could not be imported' })
    expect(within(dialog).getByText(/Arm depth must not exceed the root depth/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to design' }))
    expect(value('Arm depth')).toBe('20.0')
  })

  it('labels stored margins and omits the stress margin when no peak stress exists', () => {
    const s = testedSession([0.03, 0.0295, 0.15, 0.005])
    const [base, na] = s.history
    expect(bracketUi.copy.efficiency(base!.evaluation.efficiency)).toEqual([
      { label: 'Mass usage', value: base!.evaluation.efficiency.massUsage },
      { label: 'Stress margin', value: base!.evaluation.efficiency.stressMargin },
      { label: 'Deflection margin', value: base!.evaluation.efficiency.deflectionMargin },
    ])
    expect(na!.evaluation.efficiency.stressMargin).toBeUndefined()
    expect(bracketUi.copy.efficiency(na!.evaluation.efficiency).map((e) => e.label)).toEqual(['Mass usage', 'Deflection margin'])
  })

  it('suggests a Guided experiment from the stored peak location only', () => {
    const experiment = (s: BracketSession) => bracketUi.guidance.experiment(s as unknown as LoopSession)
    // Baseline (step governs), rootGoverned (28/24/170/4 mm), fitShallowNA.
    expect(experiment(testedSession())).toMatch(/peaks at the step/)
    expect(experiment(testedSession([0.028, 0.024, 0.17, 0.004]))).toMatch(/peaks at the root/)
    expect(experiment(testedSession([0.03, 0.0295, 0.15, 0.005]))).toMatch(/outside the fillet curve fit/)
    for (const s of [testedSession(), testedSession([0.028, 0.024, 0.17, 0.004])]) expect(experiment(s)).not.toMatch(/\d/)
    renderBracket()
    fireEvent.click(screen.getByRole('button', { name: '2. Experiment' }))
    fireEvent.click(screen.getByText('Hint & suggested experiment'))
    expect(screen.getByText(/Your latest test peaks at the step/)).toBeTruthy()
  })
})

describe('Mounting Bracket I design view: 3D with a 2D fallback (task 54.1)', () => {
  afterEach(() => {
    scene.mode = 'ok'
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the lazy 3D scene when WebGL2 exists and swaps to the 2D side view on context loss', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    renderBracket()
    const stub = await screen.findByRole('button', { name: /Stub 3D scene/ })
    expect(screen.queryByRole('img', { name: ELEVATION_LABEL })).toBeNull()
    // The details (summary, moment strip, section table) show with the 3D scene too.
    expect(screen.getByRole('img', { name: STRIP_LABEL })).toBeTruthy()
    fireEvent.click(stub)
    expect(screen.getByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    await waitFor(() => expect(screen.getAllByText(BRACKET_FALLBACK_NOTICE).length).toBeGreaterThan(0))
    expect(screen.queryByRole('button', { name: /Stub 3D scene/ })).toBeNull()
  })

  it('shows the 2D side view when the 3D scene fails to render', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    scene.mode = 'throw'
    renderBracket()
    expect(await screen.findByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    expect(screen.getAllByText(BRACKET_FALLBACK_NOTICE).length).toBeGreaterThan(0)
    expect(screen.getByRole('table', { name: 'Checked sections of the latest tested design' })).toBeTruthy()
  })
})
