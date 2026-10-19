import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fatigueChallenge, spindle } from '../../../../test/fixtures/fatigue'
import { FATIGUE_PARAM_LABELS } from '../../../geometry/fatigue/validate'
import { fatigueModel } from '../../../state/fatigueModel'
import type { SessionStorage } from '../../../state/persistence'
import { fatigueRuntime, type ModelRuntime } from '../../../state/runtimes'
import StoreProvider from '../../state/StoreProvider'
import Workbench from '../../workbench/Workbench'
import { modelUiFor } from '../registry'
import { FATIGUE_LIMITS_NOTICE, fatigueUi } from '.'
import { SN_LABEL } from './FatigueDetails'
import { ELEVATION_LABEL } from './FatigueElevation'
import { FATIGUE_FALLBACK_NOTICE } from './FatigueView'
import { formatCycles } from './shared'

// The real 3D scene needs WebGL; these tests replace the lazy chunk to drive the 3D-or-2D switch.
const scene = vi.hoisted(() => ({ mode: 'ok' as 'ok' | 'throw' }))
vi.mock('./FatigueScene3D', () => ({
  default: ({ onContextLost }: { onContextLost: () => void }) => {
    if (scene.mode === 'throw') throw new Error('Canvas creation failed')
    return <button type="button" onClick={onContextLost}>Stub 3D scene: lose context</button>
  },
}))

// Fatigue Analysis I workbench (task 70) through the PRODUCTION model UI registry. Expected
// numbers are the worksheet values (test/fixtures/fatigue.ts) rounded for display.

const clock = () => '2026-10-19T00:00:00.000Z'
let n = 0
const newId = () => `f-${++n}`
const ch = fatigueChallenge()

function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
  return { values, storage }
}

function renderFatigue(mode: 'guided' | 'parametric' = 'parametric', storage?: SessionStorage) {
  const init = fatigueRuntime.init(ch, clock(), 'base', mode)
  if (!init.ok) throw new Error('fatigue challenge must initialize')
  return render(
    <StoreProvider challenge={ch} initialSession={init.value} runtime={fatigueRuntime as unknown as ModelRuntime} storage={storage ?? null} clock={clock} newId={newId}>
      <Workbench onExit={() => {}} />
    </StoreProvider>,
  )
}

const setMm = (label: string, value: string) => {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}
const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value
const requirement = (label: string) => within(screen.getByRole('list', { name: 'Design requirements' })).getByText(label).closest('li')!

function runTest(direction?: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: 'Run Test' }))
  if (direction === undefined) return
  const dialog = screen.getByRole('dialog', { name: 'Predict fatigue safety factor' })
  expect(within(dialog).getByText(/how will your new spindle change its fatigue safety factor\?/)).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('radio', { name: direction }))
  fireEvent.click(within(dialog).getByRole('button', { name: /Run structural test/ }))
}

/** Baseline → internal reference (d 24.5, D 34, r 2 mm, machined) with the iteration-1 prediction. */
function testReference() {
  setMm('Collar diameter', '34')
  setMm('Neck diameter', '24.5')
  setMm('Fillet radius', '2')
  fireEvent.click(screen.getByRole('radio', { name: 'Machined' }))
  runTest(/Increase/)
}

afterEach(cleanup)

describe('Fatigue Analysis I workbench', () => {
  it('is registered in the production model UI registry', () => {
    expect(modelUiFor(ch.model)).toBe(fatigueUi)
  })

  it('shows the Baseline failing fatigue, yield and mass with lower bounds as minimums', () => {
    renderFatigue()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(requirement('Fatigue safety factor at the target life')).getByText('0.62')).toBeTruthy()
    expect(within(requirement('Fatigue safety factor at the target life')).getByText('min 1.30')).toBeTruthy()
    expect(within(requirement('First-cycle yield safety factor')).getByText('1.11')).toBeTruthy()
    expect(within(requirement('Mass')).getByText('678 g')).toBeTruthy()
    expect(within(requirement('Mass')).getByText('max 520 g')).toBeTruthy()
    expect(within(requirement('Shoulder face for the wheel hub')).getByText('10.50 mm')).toBeTruthy()
    expect(within(requirements).getAllByText('✗ Fail')).toHaveLength(3)
    expect(within(requirements).getAllByText('✓ Pass')).toHaveLength(1)
    expect(screen.getByText(FATIGUE_LIMITS_NOTICE)).toBeTruthy()
    expect(screen.getByText(/fatigue safety factor 0\.62 \(fail\), Kf 2\.001, predicted life 6\.99 × 10³ cycles/)).toBeTruthy()
    // jsdom has no WebGL2: the 2D side view shows with a notice, plus the S-N diagram.
    expect(screen.getByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    expect(screen.getAllByText(FATIGUE_FALLBACK_NOTICE).length).toBeGreaterThan(0)
    const sn = screen.getByRole('img', { name: SN_LABEL })
    expect(sn.querySelectorAll('polyline.fatigue-sn-line')).toHaveLength(1)
    expect(sn.querySelectorAll('circle.fatigue-sn-point')).toHaveLength(1)
    const table = screen.getByRole('table', { name: 'S-N values of the latest tested design' })
    expect(within(within(table).getByRole('row', { name: /^Endurance limit/ })).getByText('116.0 MPa')).toBeTruthy()
    expect(screen.queryByText(/cantilever|bend stress|bolt/i)).toBeNull()
  })

  it('draws the draft spindle in the 2D view with no text and redraws on edits', () => {
    renderFatigue()
    const svg = screen.getByRole('img', { name: ELEVATION_LABEL })
    expect(svg.querySelectorAll('polygon.fatigue-body')).toHaveLength(1)
    expect(svg.querySelectorAll('polygon.fatigue-hub')).toHaveLength(2)
    expect(svg.querySelectorAll('circle.fatigue-fillet-marker')).toHaveLength(1)
    expect(svg.querySelectorAll('text')).toHaveLength(0)
    const before = svg.querySelector('polygon.fatigue-body')!.getAttribute('points')
    setMm('Fillet radius', '4')
    expect(svg.querySelector('polygon.fatigue-body')!.getAttribute('points')).not.toBe(before)
  })

  it('runs the learning loop to an Accepted reference with a scored fatigue-safety-factor prediction', () => {
    renderFatigue()
    testReference()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(requirement('Fatigue safety factor at the target life')).getByText('1.40')).toBeTruthy()
    expect(within(requirement('Mass')).getByText('507 g')).toBeTruthy()
    expect(within(requirements).queryByText('✗ Fail')).toBeNull()
    expect(within(screen.getByLabelText('Result status')).getByText(/Accepted/)).toBeTruthy()
    expect(screen.getByText(/predicted life infinite \(below the endurance limit\)/)).toBeTruthy()
    expect(screen.getByRole('img', { name: SN_LABEL }).querySelectorAll('circle.fatigue-sn-point-open')).toHaveLength(1)
    fireEvent.click(screen.getAllByText('Test details').at(-1)!)
    expect(screen.getByText(/Prediction: increase · Actual: increase · Matched/)).toBeTruthy()
  })

  it('reports a design outside the model limits as not applicable, with its reasons', () => {
    renderFatigue()
    setMm('Collar diameter', '60')
    setMm('Neck diameter', '20')
    setMm('Fillet radius', '0.5')
    runTest(/Decrease/)
    const reasons = screen.getByRole('list', { name: 'Model applicability reasons' })
    expect(within(reasons).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('fit limit (h/r from 0.1 to 20'),
      expect.stringContaining('Peak local stress at the fillet divided by the yield strength is 1.54'),
      expect.stringContaining('The Goodman ratio at a thousand cycles is 1.38'),
    ])
    expect(within(requirement('Mass')).getByText('Outside model assumptions')).toBeTruthy()
    const values = screen.getByRole('table', { name: 'Latest tested fatigue values' })
    expect(within(within(values).getByRole('row', { name: /^Predicted life/ })).getByText('Below a thousand cycles (outside the model)')).toBeTruthy()
  })

  it('rejects a fillet that no longer fits the step inline, keeping the draft', () => {
    renderFatigue()
    setMm('Collar diameter', '30')
    setMm('Neck diameter', '29')
    const input = screen.getByLabelText('Neck diameter')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toMatch(/^Neck diameter: The fillet radius \(1 mm\) must be smaller than the shoulder height/)
    expect(screen.getByRole('list', { name: 'Design errors' })).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(value('Neck diameter')).toBe('22.00')
    setMm('Fillet radius', 'abc')
    expect(screen.getByLabelText('Fillet radius').getAttribute('aria-invalid')).toBe('true')
  })

  it('changes the surface finish with the radio group and lists the fixed values', () => {
    renderFatigue()
    const ground = screen.getByRole('radio', { name: 'Ground' }) as HTMLInputElement
    expect((screen.getByRole('radio', { name: 'As-forged' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(ground)
    expect(ground.checked).toBe(true)
    fireEvent.click(screen.getByText('Some things are fixed.'))
    expect(screen.getByText('1000 N to 5000 N every cycle, 50 mm from the shoulder')).toBeTruthy()
    expect(screen.getByText('200,000 cycles')).toBeTruthy()
  })

  it('compares, restores and deletes with the shared semantics', () => {
    renderFatigue()
    testReference()
    fireEvent.click(screen.getByRole('tab', { name: 'Compare results' }))
    const table = screen.getByRole('table', { name: 'Iteration 1 differences' })
    expect(within(table).getByText('fatigue safety factor')).toBeTruthy()
    expect(within(table).getByText('endurance limit')).toBeTruthy()
    expect(within(within(table).getByRole('row', { name: /predicted life/ })).getAllByText('—').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Design history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore Baseline' }))
    expect(value('Collar diameter')).toBe('45.00')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Iteration 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Iteration 1?' })).getByRole('button', { name: 'Delete iteration' }))
    expect(screen.queryByRole('button', { name: /^Iteration 1/ })).toBeNull()
  })

  it('opens the reference with typeset formulas, key points, sources and unmodeled effects', () => {
    renderFatigue()
    fireEvent.click(screen.getByRole('button', { name: /Fatigue and stress concentration reference/ }))
    const dialog = screen.getByRole('dialog', { name: 'Fatigue at a stress raiser' })
    expect(within(dialog).getByText(/Cracks start where the local stress swings most/)).toBeTruthy()
    expect(within(dialog).getByText(/corrosion, and fretting/)).toBeTruthy()
    expect(within(dialog).getByText(/edition and equation numbers pending engineering review/)).toBeTruthy()
    expect(within(dialog).getByText(/not a fatigue certification/)).toBeTruthy()
  })

  it('Guided locks everything but the step parameter; Parametric is open design (task 58)', () => {
    renderFatigue('guided')
    const unlocked = fatigueUi.guided.steps[0]!.unlocks as readonly string[]
    for (const [param, label] of Object.entries(FATIGUE_PARAM_LABELS)) {
      if (param === 'surfaceFinish') continue
      expect((screen.getByLabelText(label) as HTMLInputElement).readOnly).toBe(!unlocked.includes(param))
    }
    expect((screen.getByRole('radio', { name: 'Ground' }) as HTMLInputElement).disabled).toBe(true)
    const guidance = screen.getByRole('region', { name: 'Guided experiments' })
    expect(within(guidance).getByRole('heading', { name: 'Round the fillet' })).toBeTruthy()
    expect(fatigueUi.guided.steps.map((s) => `${s.instruction} ${s.hint}`).join(' ')).not.toMatch(/\d/)
    cleanup()
    renderFatigue('parametric')
    expect(screen.queryByRole('region', { name: 'Guided experiments' })).toBeNull()
    expect((screen.getByRole('radio', { name: 'Ground' }) as HTMLInputElement).disabled).toBe(false)
  })

  it('persists the tested workspace under its own key in the v2 envelope', () => {
    const { values, storage } = memory()
    renderFatigue('parametric', storage)
    testReference()
    const saved = JSON.parse(values.get('ei:session:fatigue-analysis-1:v1')!)
    expect(saved).toMatchObject({ schemaVersion: 2, model: { id: 'steppedShaftFatigue', version: 1 } })
    cleanup()
    renderFatigue('parametric', storage)
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
  })

  it('imports a valid v2 design file and rejects an invalid one with its reasons', async () => {
    renderFatigue()
    const file = (text: string) => new File([text], 'design.json', { type: 'application/json' })
    const valid = fatigueModel.exportDesign(spindle('imported', 0.025, 0.035, 0.002, 'ground'), ch)
    fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file(valid)] } })
    await waitFor(() => expect(value('Neck diameter')).toBe('25.00'))
    const invalid = JSON.parse(valid)
    invalid.design.filletRadiusM = 0.006
    fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file(JSON.stringify(invalid))] } })
    const dialog = await screen.findByRole('dialog', { name: 'Design could not be imported' })
    expect(within(dialog).getByText(/Fillet radius must be at most 5 mm/)).toBeTruthy()
  })

  it('labels the four stored margins and formats cycles', () => {
    const init = fatigueRuntime.init(ch, clock(), 'base', 'parametric')
    if (!init.ok) throw new Error('init')
    const e = init.value.history[0]!.evaluation.efficiency
    expect(fatigueUi.copy.efficiency(e).map((x) => x.label)).toEqual(['Fatigue margin', 'Yield margin', 'Mass usage', 'Shoulder face margin (m)'])
    expect(formatCycles(6993.74)).toBe('6.99 × 10³ cycles')
    expect(formatCycles(99_999)).toBe('1.00 × 10⁵ cycles')
    expect(formatCycles(200_000)).toBe('2.00 × 10⁵ cycles')
  })
})

describe('Fatigue Analysis I design view: 3D with a 2D fallback', () => {
  afterEach(() => {
    scene.mode = 'ok'
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the lazy 3D scene when WebGL2 exists and swaps to the 2D view on context loss', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    renderFatigue()
    const stub = await screen.findByRole('button', { name: /Stub 3D scene/ })
    expect(screen.queryByRole('img', { name: ELEVATION_LABEL })).toBeNull()
    expect(screen.getByRole('img', { name: SN_LABEL })).toBeTruthy()
    fireEvent.click(stub)
    expect(screen.getByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
  })

  it('shows the 2D view when the 3D scene fails to render', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    scene.mode = 'throw'
    renderFatigue()
    expect(await screen.findByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
  })
})
