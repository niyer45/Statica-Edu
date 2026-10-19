import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { vessel, vesselChallenge } from '../../../../test/fixtures/vessel'
import { VESSEL_PARAM_LABELS } from '../../../geometry/vessel/validate'
import { vesselModel, vesselReducer, type VesselAction, type VesselSession } from '../../../state/vesselModel'
import { vesselRuntime, type ModelRuntime } from '../../../state/runtimes'
import type { SessionStorage } from '../../../state/persistence'
import StoreProvider from '../../state/StoreProvider'
import Workbench from '../../workbench/Workbench'
import { modelUiFor } from '../registry'
import { vesselUi, VESSEL_LIMITS_NOTICE } from '.'
import { ELEVATION_LABEL, WALL_EXAGGERATION } from './VesselElevation'
import { ELEVATION_CAPTION, VESSEL_FALLBACK_NOTICE } from './VesselView'
import { formatLimit, formatVessel } from './shared'

// The real 3D scene needs WebGL; these tests replace the lazy chunk to drive the 3D-or-2D switch.
const scene = vi.hoisted(() => ({ mode: 'ok' as 'ok' | 'throw' }))
vi.mock('./VesselScene3D', () => ({
  default: ({ onContextLost }: { onContextLost: () => void }) => {
    if (scene.mode === 'throw') throw new Error('Canvas creation failed')
    return <button type="button" onClick={onContextLost}>Stub 3D scene: lose context</button>
  },
}))

// Pressure Vessel I workbench (task 69) through the PRODUCTION model UI registry. Expected
// numbers are the worksheet values (test/fixtures/vessel.ts) rounded for display.

const clock = () => '2026-10-19T00:00:00.000Z'
let n = 0
const newId = () => `v-${++n}`
const ch = vesselChallenge()

function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
  return { values, storage }
}

// Default Parametric: free editing. Guided locks parameters by step (D-49); see the mode test.
function renderVessel(mode: 'guided' | 'parametric' = 'parametric', storage?: SessionStorage) {
  const init = vesselRuntime.init(ch, clock(), 'base', mode)
  if (!init.ok) throw new Error('vessel challenge must initialize')
  return render(
    <StoreProvider challenge={ch} initialSession={init.value} runtime={vesselRuntime as unknown as ModelRuntime} storage={storage ?? null} clock={clock} newId={newId}>
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

/** Runs a test, answering the checkpoint prediction when the dialog opens. */
function runTest(direction?: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: 'Run Test' }))
  if (direction === undefined) return
  const dialog = screen.getByRole('dialog', { name: 'Predict hoop stress' })
  expect(within(dialog).getByText(/how will your new vessel change its hoop stress\?/)).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('radio', { name: direction }))
  fireEvent.click(within(dialog).getByRole('button', { name: /Run structural test/ }))
}

/** Baseline → internal reference (Ø400, L 530, shell 6.5, heads 3.5 mm) with the iteration-1 prediction. */
function testReference() {
  setMm('Inner diameter', '400')
  setMm('Shell length', '530')
  setMm('Shell thickness', '6.5')
  setMm('Head thickness', '3.5')
  runTest(/Decrease/)
}

const requirement = (label: string) => within(screen.getByRole('list', { name: 'Design requirements' })).getByText(label).closest('li')!

afterEach(cleanup)

describe('Pressure Vessel I workbench', () => {
  it('is registered in the production model UI registry', () => {
    expect(modelUiFor(ch.model)).toBe(vesselUi)
  })

  it('shows the baseline failing hoop, head, volume and length, with the longitudinal stress passing at half the hoop', () => {
    renderVessel()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(requirement('Hoop stress (shell)')).getByText('192.0 MPa')).toBeTruthy()
    expect(within(requirement('Hoop stress (shell)')).getByText('125.0 MPa')).toBeTruthy()
    expect(within(requirement('Longitudinal stress (shell)')).getByText('96.0 MPa')).toBeTruthy()
    expect(within(requirement('Longitudinal stress (shell)')).getByText('✓ Pass')).toBeTruthy()
    expect(within(requirement('Head stress')).getByText('160.0 MPa')).toBeTruthy()
    expect(within(requirement('Internal volume')).getByText('61.5 L')).toBeTruthy()
    expect(within(requirement('Internal volume')).getByText('at least 100.0 L')).toBeTruthy()
    expect(within(requirement('Overall length')).getByText('1443 mm')).toBeTruthy()
    expect(within(requirement('Mass')).getByText('20.10 kg')).toBeTruthy()
    expect(within(requirements).getAllByText('✗ Fail')).toHaveLength(4)
    expect(screen.getByText(VESSEL_LIMITS_NOTICE)).toBeTruthy()
    // jsdom has no WebGL2: the 2D section shows with a notice and the exaggeration caption.
    expect(screen.getByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    expect(screen.getAllByText(VESSEL_FALLBACK_NOTICE).length).toBeGreaterThan(0)
    expect(screen.getByText(ELEVATION_CAPTION)).toBeTruthy()
    expect(screen.getByText(/hoop stress 192\.0 MPa, longitudinal stress 96\.0 MPa, head stress 160\.0 MPa · volume 61\.5 L · overall length 1443 mm/)).toBeTruthy()
    const stresses = screen.getByRole('table', { name: 'Checked stresses of the latest tested design' })
    expect(within(within(stresses).getByRole('row', { name: /^Shell, around the circumference/ })).getByText('✗ Fail')).toBeTruthy()
    expect(within(within(stresses).getByRole('row', { name: /^Shell, along the axis/ })).getByText('✓ Pass')).toBeTruthy()
    expect(screen.queryByText(/bracket|torsion|twist|deflection|cantilever/i)).toBeNull()
  })

  it('draws the draft section: two walls, the air space and the axis, with no text on the drawing', () => {
    renderVessel()
    const svg = screen.getByRole('img', { name: ELEVATION_LABEL })
    expect(svg.querySelectorAll('polygon.vessel-wall')).toHaveLength(2)
    expect(svg.querySelectorAll('polygon.vessel-cavity')).toHaveLength(1)
    expect(svg.querySelectorAll('line.vessel-axis')).toHaveLength(1)
    expect(svg.querySelectorAll('text')).toHaveLength(0)
    expect(WALL_EXAGGERATION).toBeGreaterThan(1)
    const before = svg.querySelector('polygon.vessel-wall')!.getAttribute('points')
    setMm('Head thickness', '4')
    expect(svg.querySelector('polygon.vessel-wall')!.getAttribute('points')).not.toBe(before)
  })

  it('runs the learning loop to an Accepted reference with a scored hoop-stress prediction', () => {
    renderVessel()
    testReference()
    const requirements = screen.getByRole('list', { name: 'Design requirements' })
    expect(within(requirement('Hoop stress (shell)')).getByText('123.1 MPa')).toBeTruthy()
    expect(within(requirement('Head stress')).getByText('114.3 MPa')).toBeTruthy()
    expect(within(requirement('Internal volume')).getByText('100.1 L')).toBeTruthy()
    expect(within(requirement('Mass')).getByText('48.59 kg')).toBeTruthy()
    expect(within(requirements).queryByText('✗ Fail')).toBeNull()
    expect(within(screen.getByLabelText('Result status')).getByText(/Accepted/)).toBeTruthy()
    fireEvent.click(screen.getAllByText('Test details').at(-1)!)
    expect(screen.getByText(/Prediction: decrease · Actual: decrease · Matched/)).toBeTruthy()
    expect(screen.getByText('Hoop stress changed by ×0.64; it grows with the radius and falls with the shell thickness.')).toBeTruthy()
  })

  it('reports thick walls as outside the thin-wall model, naming r/t of at least 10', () => {
    renderVessel()
    setMm('Inner diameter', '200')
    setMm('Shell length', '600')
    setMm('Shell thickness', '12')
    setMm('Head thickness', '12')
    runTest(/Decrease/)
    const reasons = screen.getByRole('list', { name: 'Model applicability reasons' })
    expect(within(reasons).getByText(/Shell thickness divided by inner radius is 0\.12, above the model limit of 0\.1.*r\/t of at least 10/)).toBeTruthy()
    expect(within(reasons).getByText(/Head thickness divided by inner radius is 0\.12/)).toBeTruthy()
    expect(within(requirement('Hoop stress (shell)')).getByText('Outside model assumptions')).toBeTruthy()
    expect(within(screen.getByLabelText('Result status')).getByText(/Model not applicable/)).toBeTruthy()
  })

  it('shows caution warnings in Test details, not under the checks', () => {
    renderVessel()
    setMm('Shell thickness', '2')
    runTest(/Decrease/)
    const panel = screen.getByRole('complementary', { name: 'The challenge' })
    const warnings = within(panel).getByRole('list', { name: 'Model warnings', hidden: true })
    expect(warnings.closest('details')?.querySelector('summary')?.textContent).toBe('Test details')
    expect(within(warnings).getByText(/Largest membrane stress divided by yield stress is 0\.96/, undefined)).toBeTruthy()
  })

  it('rejects an out-of-range value inline without changing the draft', () => {
    renderVessel()
    setMm('Inner diameter', '600')
    const input = screen.getByLabelText('Inner diameter')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toBe('Inner diameter: Inner diameter must be at most 500 mm (got 600 mm).')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(value('Inner diameter')).toBe('240')
    setMm('Head thickness', 'thick')
    expect(screen.getByLabelText('Head thickness').getAttribute('aria-invalid')).toBe('true')
    expect(value('Shell thickness')).toBe('2.5')
  })

  it('moves a slider by a clamp edit on the configured grid', () => {
    renderVessel()
    fireEvent.change(screen.getByRole('slider', { name: 'Shell length slider' }), { target: { value: '800' } })
    expect(value('Shell length')).toBe('800')
  })

  it('lists the fixed pressure, heads, material and design factor with the allowable stress', () => {
    renderVessel()
    fireEvent.click(screen.getByText('Some things are fixed.'))
    expect(screen.getByText('4.0 MPa (gauge)')).toBeTruthy()
    expect(screen.getByText('Hemispherical, same inner diameter as the shell')).toBeTruthy()
    expect(screen.getByText(/Steel \(educational nominal\), yield 250 MPa/)).toBeTruthy()
    expect(screen.getByText('2 on yield: allowable stress 125 MPa')).toBeTruthy()
  })

  it('compares, restores and deletes with the shared semantics', () => {
    renderVessel()
    testReference()
    fireEvent.click(screen.getByRole('tab', { name: 'Compare results' }))
    const table = screen.getByRole('table', { name: 'Iteration 1 differences' })
    for (const label of ['hoop stress', 'longitudinal stress', 'head stress', 'internal volume', 'overall length', 'mass']) expect(within(table).getByText(label)).toBeTruthy()
    expect(within(table).getAllByText(/^−/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Design history' }))
    expect(screen.getAllByText('Ø240 · L 1200 · shell 2.5 · heads 1.5 mm').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Restore Baseline' }))
    expect(value('Inner diameter')).toBe('240')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Iteration 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Iteration 1?' })).getByRole('button', { name: 'Delete iteration' }))
    expect(screen.queryByRole('button', { name: /^Iteration 1/ })).toBeNull()
  })

  it('opens the stress reference with key points, sources, assumptions and unsupported effects', () => {
    renderVessel()
    fireEvent.click(screen.getByRole('button', { name: /Pressure vessel stress reference/ }))
    const dialog = screen.getByRole('dialog', { name: 'Pressure vessel stresses' })
    expect(within(dialog).getByText(/hoop stress is always twice the longitudinal stress/)).toBeTruthy()
    expect(within(dialog).getByText(/edition and equation numbers pending engineering review/)).toBeTruthy()
    expect(within(dialog).getByText(/discontinuity \(bending\) stresses where the heads meet the shell/)).toBeTruthy()
    expect(within(dialog).getByText(/not a real-world approval or a pressure-vessel code/)).toBeTruthy()
  })

  it('Guided locks every dimension but the step one; Parametric is open design (D-49)', () => {
    renderVessel('guided')
    const unlocked = vesselUi.guided.steps[0]!.unlocks as readonly string[]
    for (const [param, label] of Object.entries(VESSEL_PARAM_LABELS)) {
      expect((screen.getByLabelText(label) as HTMLInputElement).readOnly).toBe(!unlocked.includes(param))
    }
    const guidance = screen.getByRole('region', { name: 'Guided experiments' })
    expect(within(guidance).getByRole('heading', { name: 'Thicken the shell' })).toBeTruthy()
    cleanup()
    renderVessel('parametric')
    expect(screen.queryByRole('region', { name: 'Guided experiments' })).toBeNull()
    for (const label of Object.values(VESSEL_PARAM_LABELS)) expect((screen.getByLabelText(label) as HTMLInputElement).readOnly).toBe(false)
  })

  it('persists the tested workspace under its own key in the v2 envelope and restores it', () => {
    const { values, storage } = memory()
    renderVessel('parametric', storage)
    testReference()
    const saved = JSON.parse(values.get('ei:session:pressure-vessel-1:v1')!)
    expect(saved).toMatchObject({ schemaVersion: 2, model: { id: 'thinWallPressureVessel', version: 1 } })
    cleanup()
    renderVessel('parametric', storage)
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    expect(within(requirement('Hoop stress (shell)')).getByText('123.1 MPa')).toBeTruthy()
  })

  it('imports a valid v2 design file and rejects an invalid one with its reasons', async () => {
    renderVessel()
    const file = (text: string) => new File([text], 'design.json', { type: 'application/json' })
    const valid = vesselModel.exportDesign(vessel('imported', 0.45, 0.4, 0.008, 0.004), ch)
    fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file(valid)] } })
    await waitFor(() => expect(value('Inner diameter')).toBe('450'))
    const invalid = JSON.parse(valid)
    invalid.design.shellLengthM = 2
    fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file(JSON.stringify(invalid))] } })
    const dialog = await screen.findByRole('dialog', { name: 'Design could not be imported' })
    expect(within(dialog).getByText(/Shell length must be at most 1200 mm/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to design' }))
    expect(value('Shell length')).toBe('400')
  })

  it('labels the four stored margins', () => {
    const init = vesselRuntime.init(ch, clock(), 'base', 'parametric')
    if (!init.ok) throw new Error('vessel challenge must initialize')
    const s = ([{ type: 'runTest', now: clock(), id: 'x' }] as VesselAction[]).reduce<VesselSession>((acc, a) => vesselReducer(acc, a, ch), init.value)
    const e = s.history[0]!.evaluation.efficiency
    expect(vesselUi.copy.efficiency(e)).toEqual([
      { label: 'Mass usage', value: e.massUsage },
      { label: 'Hoop stress margin', value: e.hoopMargin },
      { label: 'Head stress margin', value: e.headMargin },
      { label: 'Volume margin', value: e.volumeMargin },
    ])
  })

  it('formats stored values by unit and reads a minimum as "at least"', () => {
    expect(formatVessel(0.1, 'm3')).toBe('100.0 L')
    expect(formatVessel(125e6, 'Pa')).toBe('125.0 MPa')
    expect(formatVessel(0.937, 'm')).toBe('937 mm')
    expect(formatVessel(48.589, 'kg')).toBe('48.59 kg')
    expect(formatVessel(30.77, 'ratio')).toBe('30.8')
    expect(formatVessel(1, 'bool')).toBe('')
    expect(formatLimit({ limit: 0.1, unit: 'm3', bound: 'min' })).toBe('at least 100.0 L')
    expect(formatLimit({ limit: 55, unit: 'kg', bound: 'max' })).toBe('55.00 kg')
  })
})

describe('Pressure Vessel I design view: 3D with a 2D fallback (D-45 pattern)', () => {
  afterEach(() => {
    scene.mode = 'ok'
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the lazy 3D scene when WebGL2 exists and swaps to the 2D section on context loss', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    renderVessel()
    const stub = await screen.findByRole('button', { name: /Stub 3D scene/ })
    expect(screen.queryByRole('img', { name: ELEVATION_LABEL })).toBeNull()
    expect(screen.getByRole('table', { name: 'Checked stresses of the latest tested design' })).toBeTruthy()
    fireEvent.click(stub)
    expect(screen.getByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    await waitFor(() => expect(screen.getAllByText(VESSEL_FALLBACK_NOTICE).length).toBeGreaterThan(0))
  })

  it('shows the 2D section when the 3D scene fails to render', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    scene.mode = 'throw'
    renderVessel()
    expect(await screen.findByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    expect(screen.getAllByText(VESSEL_FALLBACK_NOTICE).length).toBeGreaterThan(0)
  })
})
