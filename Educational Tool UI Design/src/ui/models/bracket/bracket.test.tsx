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

// Mounting Bracket I workbench (task 55 L-bracket) through the PRODUCTION model UI registry.
// Expected numbers are the worksheet values (test/fixtures/bracket.ts) rounded for display.

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
  return designs.reduce<BracketSession>((s, [t, w, H, r], i) => {
    const actions: BracketAction[] = [
      { type: 'importDesign', json: bracketModel.exportDesign(bracket(`d${i}`, t, w, H, r), ch) },
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
  const dialog = screen.getByRole('dialog', { name: 'Predict bend stress' })
  expect(within(dialog).getByText(/how will your new bracket change its bend stress\?/)).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('radio', { name: direction }))
  fireEvent.click(within(dialog).getByRole('button', { name: /Run structural test/ }))
}

/** Baseline → internal reference (t 7, w 40, flange 80, r 6 mm) with the iteration-1 prediction. */
function testReference() {
  setMm('Thickness', '7')
  setMm('Width', '40')
  setMm('Flange height', '80')
  setMm('Inner bend radius', '6')
  runTest(/Decrease/)
}

const requirement = (label: string) => within(screen.getByRole('list', { name: 'Design requirements' })).getByText(label).closest('li')!

afterEach(cleanup)

describe('Mounting Bracket I workbench', () => {
  it('is registered in the production model UI registry', () => {
    expect(modelUiFor(ch.model)).toBe(bracketUi)
  })

  it('shows the baseline failing all four checks, with L-bracket wording only', () => {
    renderBracket()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(requirement('Bend stress')).getByText('231.0 MPa')).toBeTruthy()
    expect(within(requirement('Deflection at the load')).getByText('8.04 mm')).toBeTruthy()
    expect(within(requirement('Bolt tension')).getByText('333 N')).toBeTruthy()
    expect(within(requirement('Bolt tension')).getByText('300 N')).toBeTruthy()
    expect(within(requirement('Mass')).getByText('180.7 g')).toBeTruthy()
    expect(within(requirements).getAllByText('✗ Fail')).toHaveLength(4)
    expect(screen.getAllByText(/Bend stress 231\.0 MPa at the inside of the bend \(curved-beam factor 1\.73\) · 333 N per bolt/).length).toBeGreaterThan(0)
    expect(screen.getByText(BRACKET_LIMITS_NOTICE)).toBeTruthy()
    // jsdom has no WebGL2: the 2D side view (wall, L-bracket, bolts, hanging load) shows with a notice.
    expect(screen.getByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    expect(screen.getAllByText(BRACKET_FALLBACK_NOTICE).length).toBeGreaterThan(0)
    expect(screen.getByText(/An L-bracket: its vertical flange is bolted flat to the wall/)).toBeTruthy()
    const view = screen.getByRole('img', { name: STRIP_LABEL })
    // The bend is a distinct shape (filled triangle) and the bolt row an open circle, not only a color.
    expect(view.querySelectorAll('polygon.governing-marker')).toHaveLength(1)
    expect(view.querySelectorAll('circle.section-marker')).toHaveLength(1)
    const sections = screen.getByRole('table', { name: 'Checked sections of the latest tested design' })
    expect(within(within(sections).getByRole('row', { name: /^Bend, inner fibre/ })).getByText('✗ Fail')).toBeTruthy()
    expect(within(within(sections).getByRole('row', { name: /^Bolt row, 36\.00 mm above the heel/ })).getByText('333 N per bolt')).toBeTruthy()
    expect(screen.queryByText(/cantilever/i)).toBeNull()
    expect(screen.queryByText(/stepped|fillet|shoulder/i)).toBeNull()
    expect(screen.queryByText(/torsion|twist|shaft/i)).toBeNull()
  })

  it('draws the draft L-bracket in the 2D side view: wall, L outline, two bolts and the hanging load', () => {
    renderBracket()
    const svg = screen.getByRole('img', { name: ELEVATION_LABEL })
    expect(svg.querySelectorAll('polygon.bracket-body')).toHaveLength(1)
    expect(svg.querySelectorAll('polygon.bracket-body-back')).toHaveLength(1)
    expect(svg.querySelectorAll('rect.bracket-bolt')).toHaveLength(2)
    expect(svg.querySelectorAll('rect.bracket-weight')).toHaveLength(1)
    expect(svg.querySelectorAll('line.bracket-section-line')).toHaveLength(1)
    expect(svg.querySelectorAll('text')).toHaveLength(0)
    const before = svg.querySelector('polygon.bracket-body')!.getAttribute('points')
    setMm('Flange height', '100')
    expect(svg.querySelector('polygon.bracket-body')!.getAttribute('points')).not.toBe(before)
  })

  it('runs the learning loop to an Accepted reference with a scored bend-stress prediction', () => {
    renderBracket()
    testReference()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(requirement('Bend stress')).getByText('97.7 MPa')).toBeTruthy()
    expect(within(requirement('Bolt tension')).getByText('231 N')).toBeTruthy()
    expect(within(requirements).queryByText('✗ Fail')).toBeNull()
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    expect(within(screen.getByLabelText('Result status')).getByText(/Accepted/)).toBeTruthy()
    fireEvent.click(screen.getAllByText('Test details').at(-1)!)
    expect(screen.getByText(/Prediction: decrease · Actual: decrease · Matched/)).toBeTruthy()
  })

  it('reports a design outside the model limits as not applicable, with its reasons', () => {
    renderBracket()
    // legSpanNA: t 10, w 40, flange 50, r 12 mm (thickness / bolt lever arm 0.77).
    setMm('Thickness', '10')
    setMm('Width', '40')
    setMm('Flange height', '50')
    setMm('Inner bend radius', '12')
    runTest(/Decrease/)
    const reasons = screen.getByRole('list', { name: 'Model applicability reasons' })
    expect(within(reasons).getByText(/Thickness divided by bolt lever arm is 0\.769, above the model limit of 0\.5/)).toBeTruthy()
    expect(within(requirement('Bolt tension')).getByText('Outside model assumptions')).toBeTruthy()
    expect(within(screen.getByLabelText('Result status')).getByText(/Model not applicable/)).toBeTruthy()
    const values = screen.getByRole('table', { name: 'Latest tested bend and bolt values' })
    expect(within(within(values).getByRole('row', { name: /^Bolt lever arm/ })).getByText('13.00 mm')).toBeTruthy()
  })

  it('rejects an out-of-range value inline without changing the draft', () => {
    renderBracket()
    setMm('Flange height', '200')
    const input = screen.getByLabelText('Flange height')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toBe('Flange height: Flange height must be at most 150 mm (got 200 mm).')
    expect(value('Thickness')).toBe('3.0')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(value('Flange height')).toBe('55.0')
    setMm('Inner bend radius', 'abc')
    expect(screen.getByLabelText('Inner bend radius').getAttribute('aria-invalid')).toBe('true')
    expect(value('Width')).toBe('120.0')
  })

  it('lists the fixed load, offset, bolts, material and support', () => {
    renderBracket()
    fireEvent.click(screen.getByText('Some things are fixed.'))
    expect(screen.getByText('200 N hanging from the arm')).toBeTruthy()
    expect(screen.getByText('120 mm from the wall face')).toBeTruthy()
    expect(screen.getByText(/2 in one row, 15 mm below the top of the flange/)).toBeTruthy()
  })

  it('compares, restores and deletes with the shared semantics', () => {
    renderBracket()
    testReference()
    fireEvent.click(screen.getByRole('tab', { name: 'Compare results' }))
    const table = screen.getByRole('table', { name: 'Iteration 1 differences' })
    expect(within(table).getByText('bend stress')).toBeTruthy()
    expect(within(table).getByText('curved-beam factor')).toBeTruthy()
    expect(within(table).getByText('bolt tension')).toBeTruthy()
    expect(within(table).getAllByText(/^−/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Design history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore Baseline' }))
    expect(value('Flange height')).toBe('55.0')
    expect(value('Inner bend radius')).toBe('1.0')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Iteration 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Iteration 1?' })).getByRole('button', { name: 'Delete iteration' }))
    expect(screen.queryByRole('button', { name: /^Iteration 1/ })).toBeNull()
  })

  it('opens the bend-stress and bolt-load reference with the sources, assumptions and unsupported effects', () => {
    renderBracket()
    fireEvent.click(screen.getByRole('button', { name: /Bend stress and bolt load reference/ }))
    const dialog = screen.getByRole('dialog', { name: 'Bend stress and bolt loads' })
    expect(within(dialog).getByText(/Winkler–Bach curved-beam formula \(Shigley; Roark's curved-beam table\)/)).toBeTruthy()
    expect(within(dialog).getByText(/T-stub prying/)).toBeTruthy()
    expect(within(dialog).getByText(/rotates about its heel/)).toBeTruthy()
    expect(within(dialog).getByText(/not a real-world approval/)).toBeTruthy()
  })

  it('Parametric omits guidance and shows the direct-edit label', () => {
    renderBracket('parametric')
    expect(screen.getByText('Direct thickness, width, flange and bend radius editing')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Guided instructions' })).toBeNull()
  })

  it('Guided steps never reveal the reference dimensions', () => {
    renderBracket()
    const guidance = screen.getByRole('region', { name: 'Guided instructions' })
    expect(within(guidance).getByRole('heading', { name: 'Inspect' })).toBeTruthy()
    const text = bracketUi.guidance.steps.map((s) => `${s.instruction} ${s.hint}`).join(' ')
    expect(text).not.toMatch(/\d/)
  })

  it('persists the tested workspace under its own version-2 key in the v2 envelope', () => {
    const { values, storage } = memory()
    renderBracket('guided', storage)
    testReference()
    expect(values.has('ei:session:mounting-bracket-1:v1')).toBe(false)
    const saved = JSON.parse(values.get('ei:session:mounting-bracket-1:v2')!)
    expect(saved).toMatchObject({ schemaVersion: 2, model: { id: 'boltedLBracket', version: 1 } })
    cleanup()
    renderBracket('guided', storage)
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    expect(within(requirement('Bend stress')).getByText('97.7 MPa')).toBeTruthy()
  })

  it('imports a valid v2 design file and rejects an invalid one with its reasons', async () => {
    renderBracket()
    const file = (text: string) => new File([text], 'design.json', { type: 'application/json' })
    const valid = bracketModel.exportDesign(bracket('imported', 0.005, 0.06, 0.09, 0.004), ch)
    fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file(valid)] } })
    await waitFor(() => expect(value('Flange height')).toBe('90.0'))
    expect(screen.queryByRole('button', { name: /^Iteration 1/ })).toBeNull()
    const invalid = JSON.parse(valid)
    invalid.design.widthM = 0.2
    fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file(JSON.stringify(invalid))] } })
    const dialog = await screen.findByRole('dialog', { name: 'Design could not be imported' })
    expect(within(dialog).getByText(/Width must be at most 120 mm/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to design' }))
    expect(value('Width')).toBe('60.0')
  })

  it('labels the four stored margins', () => {
    const [base] = testedSession().history
    const e = base!.evaluation.efficiency
    expect(bracketUi.copy.efficiency(e)).toEqual([
      { label: 'Mass usage', value: e.massUsage },
      { label: 'Stress margin', value: e.stressMargin },
      { label: 'Deflection margin', value: e.deflectionMargin },
      { label: 'Bolt margin', value: e.boltMargin },
    ])
  })

  it('suggests a Guided experiment from the stored failures only', () => {
    const experiment = (s: BracketSession) => bracketUi.guidance.experiment(s as unknown as LoopSession)
    // Baseline (bend stress fails first), thicknessOnly (bolts), legSpanNA (not applicable), oversized (mass), reference (none).
    expect(experiment(testedSession())).toMatch(/overstressed at the bend/)
    expect(experiment(testedSession([0.007, 0.12, 0.055, 0.001]))).toMatch(/overloads the bolts/)
    expect(experiment(testedSession([0.01, 0.04, 0.05, 0.012]))).toMatch(/outside the model limits/)
    expect(experiment(testedSession([0.008, 0.06, 0.1, 0.006]))).toMatch(/too heavy/)
    expect(experiment(testedSession([0.007, 0.04, 0.08, 0.006]))).toBeUndefined()
    for (const s of [testedSession(), testedSession([0.007, 0.12, 0.055, 0.001])]) expect(experiment(s)).not.toMatch(/\d/)
    renderBracket()
    fireEvent.click(screen.getByRole('button', { name: '2. Experiment' }))
    fireEvent.click(screen.getByText('Hint & suggested experiment'))
    expect(screen.getByText(/Your latest test is overstressed at the bend/)).toBeTruthy()
  })
})

describe('Mounting Bracket I design view: 3D with a 2D fallback (tasks 54.1, 55)', () => {
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
    // The details (summary, moment path, section table) show with the 3D scene too.
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
