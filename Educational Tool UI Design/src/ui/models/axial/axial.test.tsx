import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axialChallenge, rod } from '../../../../test/fixtures/axial'
import { catalog } from '../../../challenge/catalog'
import { axialModel } from '../../../state/axialModel'
import type { SessionStorage } from '../../../state/persistence'
import { axialRuntime, type ModelRuntime } from '../../../state/runtimes'
import StoreProvider from '../../state/StoreProvider'
import Workbench from '../../workbench/Workbench'
import { modelUiFor } from '../registry'
import { axialUi, AXIAL_LIMITS_NOTICE } from '.'
import { ELEVATION_LABEL } from './AxialElevation'
import { AXIAL_FALLBACK_NOTICE } from './AxialView'
import { displayedStretch, formatAxial } from './shared'

// The real 3D scene needs WebGL; these tests replace the lazy chunk to drive the 3D-or-2D switch.
const scene = vi.hoisted(() => ({ mode: 'ok' as 'ok' | 'throw' }))
vi.mock('./AxialScene3D', () => ({
  default: ({ onContextLost }: { onContextLost: () => void }) => {
    if (scene.mode === 'throw') throw new Error('Canvas creation failed')
    return <button type="button" onClick={onContextLost}>Stub 3D scene: lose context</button>
  },
}))

// Stress and Strain I workbench (task 72) through the PRODUCTION model UI registry. Expected numbers
// are the worksheet values (test/fixtures/axial.ts) rounded for display.

const clock = () => '2026-10-19T00:00:00.000Z'
let n = 0
const newId = () => `r-${++n}`
const ch = axialChallenge()

function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
  return { values, storage }
}

function renderRod(mode: 'guided' | 'parametric' = 'parametric', storage?: SessionStorage) {
  const init = axialRuntime.init(ch, clock(), 'base', mode)
  if (!init.ok) throw new Error('rod challenge must initialize')
  return render(
    <StoreProvider challenge={ch} initialSession={init.value} runtime={axialRuntime as unknown as ModelRuntime} storage={storage ?? null} clock={clock} newId={newId}>
      <Workbench onExit={() => {}} />
    </StoreProvider>,
  )
}

const setDiameter = (value: string) => {
  const input = screen.getByLabelText('Diameter')
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}
const chooseMaterial = (name: RegExp) => fireEvent.click(screen.getByRole('radio', { name }))
const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value
const requirement = (label: string) => within(screen.getByRole('list', { name: 'Design requirements' })).getByText(label).closest('li')!

function runTest(direction?: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: 'Run Test' }))
  if (direction === undefined) return
  const dialog = screen.getByRole('dialog', { name: 'Predict elongation' })
  expect(within(dialog).getByText(/how will your new rod change its elongation\?/)).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('radio', { name: direction }))
  fireEvent.click(within(dialog).getByRole('button', { name: /Run structural test/ }))
}

/** Baseline → internal reference (aluminium, 20 mm) with the iteration-1 prediction. */
function testReference() {
  setDiameter('20')
  chooseMaterial(/^Aluminium alloy 6061-T6/)
  runTest(/Increase/)
}

afterEach(cleanup)

describe('Stress and Strain I workbench', () => {
  it('is registered in the production registry and linked from an available Introductory Mechanics card', () => {
    expect(modelUiFor(ch.model)).toBe(axialUi)
    expect(catalog.find((e) => e.id === '010')).toMatchObject({ available: true, challengeId: 'stress-strain-1', difficulty: 'introductory', discipline: 'Mechanics', art: 'rod' })
  })

  it('shows the steel baseline failing stress and mass, passing stretch, with rod wording only', () => {
    renderRod()
    expect(within(requirement('Axial stress (allowable)')).getByText('150.7 MPa')).toBeTruthy()
    expect(within(requirement('Axial stress (allowable)')).getByText('125.0 MPa')).toBeTruthy()
    expect(within(requirement('Elongation')).getByText('1.51 mm')).toBeTruthy()
    expect(within(requirement('Elongation')).getByText('2.00 mm')).toBeTruthy()
    expect(within(requirement('Mass')).getByText('2.084 kg')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Design requirements' })).getAllByText('✗ Fail')).toHaveLength(2)
    expect(screen.getByText(AXIAL_LIMITS_NOTICE)).toBeTruthy()
    expect(screen.getByText(/A 2 m steel hanger rod holds a 20 kN load from a roof beam/)).toBeTruthy()
    // jsdom has no WebGL2: the 2D view (roof beam, rod, load) shows with a notice and a text summary.
    expect(screen.getByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    expect(screen.getAllByText(AXIAL_FALLBACK_NOTICE).length).toBeGreaterThan(0)
    expect(screen.getByText(/Structural steel rod, Ø13\.0 mm and 2 m long, hanging from a roof beam with a 20 kN load\. Latest tested: elongation 1\.51 mm \(drawn ×100\), stress 150\.7 MPa\./)).toBeTruthy()
    expect(screen.queryByText(/torsion|twist|shaft|bracket|deflection/i)).toBeNull()
  })

  it('draws the draft rod to scale in width, stretched by the latest tested elongation, with no text', () => {
    renderRod()
    const svg = screen.getByRole('img', { name: ELEVATION_LABEL })
    expect(svg.querySelectorAll('text')).toHaveLength(0)
    const rodRect = () => svg.querySelector('rect.axial-rod')!
    expect(rodRect().getAttribute('class')).toContain('axial-material-steel')
    const width = Number(rodRect().getAttribute('width'))
    const height = Number(rodRect().getAttribute('height'))
    expect(width).toBeCloseTo((0.013 / ch.diameterLimits.maxM) * 60, 9)
    const { fractionOfLength } = displayedStretch(axialModel.analyze(ch.initialDesign, ch).elongationM, ch.lengthM, ch.visualization)
    expect(height).toBeCloseTo(120 * (1 + fractionOfLength), 9)
    expect(svg.querySelectorAll('line.axial-unstretched')).toHaveLength(1)
    setDiameter('26')
    expect(Number(rodRect().getAttribute('width'))).toBeCloseTo(2 * width, 9)
    // Draft edits change the width only; the stretch stays the latest tested one.
    expect(Number(rodRect().getAttribute('height'))).toBeCloseTo(height, 9)
    chooseMaterial(/^Titanium/)
    expect(rodRect().getAttribute('class')).toContain('axial-material-titanium')
    expect(screen.getByText(/Draft changed since this test\./)).toBeTruthy()
  })

  it('lists each material with its typical E, yield, density and allowable stress from the physics layer', () => {
    renderRod()
    const steel = screen.getByRole('radio', { name: /^Structural steel/ }).closest('label')!
    expect(steel.textContent).toContain('E 200 GPa · yield 250.0 MPa · 7850 kg/m³ · allowable 125.0 MPa')
    const ti = screen.getByRole('radio', { name: /^Titanium alloy/ }).closest('label')!
    expect(ti.textContent).toContain('allowable 415.0 MPa')
    expect(screen.getByText('Typical textbook values, not certified material data.')).toBeTruthy()
    fireEvent.click(screen.getByText('Some things are fixed.'))
    expect(screen.getByText('20 kN tension, through the rod’s axis'.replace('’', "'"))).toBeTruthy()
    expect(screen.getByText('2 on yield strength')).toBeTruthy()
  })

  it('runs the learning loop to an Accepted reference with a scored elongation prediction', () => {
    renderRod()
    testReference()
    expect(within(requirement('Axial stress (allowable)')).getByText('63.7 MPa')).toBeTruthy()
    expect(within(requirement('Axial stress (allowable)')).getByText('138.0 MPa')).toBeTruthy()
    expect(within(requirement('Elongation')).getByText('1.85 mm')).toBeTruthy()
    expect(within(requirement('Mass')).getByText('1.696 kg')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Design requirements' })).queryByText('✗ Fail')).toBeNull()
    expect(within(screen.getByLabelText('Result status')).getByText(/Accepted/)).toBeTruthy()
    fireEvent.click(screen.getAllByText('Test details').at(-1)!)
    expect(screen.getByText(/Prediction: increase · Actual: increase · Matched/)).toBeTruthy()
    expect(screen.getByText('Material changed from Steel to Aluminium.')).toBeTruthy()
  })

  it('flags a rod beyond yield as not applicable, with the reason, and never Accepted', () => {
    renderRod()
    setDiameter('6')
    runTest(/Increase/)
    const reasons = screen.getByRole('list', { name: 'Model applicability reasons' })
    expect(within(reasons).getByText(/Axial stress divided by yield strength is 2\.83, above the model limit of 1\. The rod has reached yield\./)).toBeTruthy()
    expect(within(requirement('Mass')).getByText('Outside model assumptions')).toBeTruthy()
    expect(within(screen.getByLabelText('Result status')).getByText(/Model not applicable/)).toBeTruthy()
    const values = screen.getByRole('table', { name: 'Latest tested rod values' })
    expect(within(within(values).getByRole('row', { name: /^Stress \/ yield strength/ })).getByText('2.83')).toBeTruthy()
  })

  it('warns close to yield without failing applicability', () => {
    renderRod()
    setDiameter('10.5')
    chooseMaterial(/^Aluminium/)
    runTest(/Increase/)
    const warnings = screen.getByRole('list', { name: 'Model warnings' })
    expect(within(warnings).getByText(/is 0\.837, above the caution level of 0\.8\. The rod is close to yield\./)).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Model applicability reasons' })).toBeNull()
  })

  it('rejects an out-of-range or unreadable diameter inline without changing the draft', () => {
    renderRod()
    setDiameter('40')
    const input = screen.getByLabelText('Diameter')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toBe('Diameter: Diameter must be at most 30 mm (got 40 mm).')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(value('Diameter')).toBe('13.0')
    setDiameter('abc')
    expect(screen.getByLabelText('Diameter').getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(screen.getByRole('slider', { name: 'Diameter slider' }), { target: { value: '18.5' } })
    expect(value('Diameter')).toBe('18.5')
  })

  it('compares, restores and deletes with the shared semantics', () => {
    renderRod()
    testReference()
    fireEvent.click(screen.getByRole('tab', { name: 'Compare results' }))
    const table = screen.getByRole('table', { name: 'Iteration 1 differences' })
    for (const label of ['elongation', 'axial stress', 'mass', 'diameter', 'strain']) expect(within(table).getByText(label)).toBeTruthy()
    // Δ vs Baseline and Δ vs previous are the same for iteration 1.
    expect(within(table).getAllByText(`+${formatAxial(0.02 - 0.013, 'diameter')}`)).toHaveLength(2)
    fireEvent.click(screen.getByRole('tab', { name: 'Design history' }))
    expect(screen.getAllByText('Ø20.0 mm · Aluminium').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Restore Baseline' }))
    expect(value('Diameter')).toBe('13.0')
    expect((screen.getByRole('radio', { name: /^Structural steel/ }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Iteration 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Iteration 1?' })).getByRole('button', { name: 'Delete iteration' }))
    expect(screen.queryByRole('button', { name: /^Iteration 1/ })).toBeNull()
  })

  it('opens the stress and strain reference with formulas, key points, sources and limits', () => {
    renderRod()
    fireEvent.click(screen.getByRole('button', { name: /Stress and strain reference/ }))
    const dialog = screen.getByRole('dialog', { name: 'Stress and strain' })
    expect(within(dialog).getByText('Stress depends only on the load and the area, not on the material.')).toBeTruthy()
    expect(within(dialog).getByText(/Gere & Goodno, Mechanics of Materials; Hibbeler/)).toBeTruthy()
    expect(within(dialog).getByText(/Edition and equation numbers pending engineering review/)).toBeTruthy()
    expect(within(dialog).getByText(/necking and plastic flow \(screened only\)/)).toBeTruthy()
    expect(within(dialog).getByText(/not a real-world approval/)).toBeTruthy()
  })

  it('Guided locks the material in step one; Parametric is open design', () => {
    renderRod('guided')
    expect(within(screen.getByRole('region', { name: 'Guided experiments' })).getByRole('heading', { name: 'Thicken the rod' })).toBeTruthy()
    expect((screen.getByLabelText('Diameter') as HTMLInputElement).readOnly).toBe(false)
    expect((screen.getByRole('radio', { name: /^Titanium/ }) as HTMLInputElement).disabled).toBe(true)
    cleanup()
    renderRod('parametric')
    expect(screen.getByText(/Every parameter is editable from the start/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Guided experiments' })).toBeNull()
    expect((screen.getByRole('radio', { name: /^Titanium/ }) as HTMLInputElement).disabled).toBe(false)
  })

  it('Guided steps never state a number or the reference design', () => {
    const text = axialUi.guided.steps.map((s) => `${s.title} ${s.instruction} ${s.hint}`).join(' ')
    expect(text).not.toMatch(/\d/)
    expect(text).not.toMatch(/aluminium alloy|6061|20 mm/i)
  })

  it('persists the tested workspace under its own version-1 key in the v2 envelope', () => {
    const { values, storage } = memory()
    renderRod('parametric', storage)
    testReference()
    const saved = JSON.parse(values.get('ei:session:stress-strain-1:v1')!)
    expect(saved).toMatchObject({ schemaVersion: 2, model: { id: 'axialTieRod', version: 1 } })
    cleanup()
    renderRod('parametric', storage)
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    expect(within(requirement('Mass')).getByText('1.696 kg')).toBeTruthy()
  })

  it('imports a valid v2 design file and rejects an invalid one with its reasons', async () => {
    renderRod()
    const file = (text: string) => new File([text], 'design.json', { type: 'application/json' })
    const valid = axialModel.exportDesign(rod('imported', 0.0155, 'titanium'), ch)
    fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file(valid)] } })
    await waitFor(() => expect(value('Diameter')).toBe('15.5'))
    expect((screen.getByRole('radio', { name: /^Titanium/ }) as HTMLInputElement).checked).toBe(true)
    const invalid = JSON.parse(valid)
    invalid.design.materialId = 'cork'
    fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file(JSON.stringify(invalid))] } })
    const dialog = await screen.findByRole('dialog', { name: 'Design could not be imported' })
    expect(within(dialog).getByText(/Material "cork" is not available in this challenge/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to design' }))
    expect(value('Diameter')).toBe('15.5')
  })

  it('labels the three stored margins', () => {
    const init = axialRuntime.init(ch, clock(), 'base', 'parametric')
    if (!init.ok) throw new Error('init')
    const e = init.value.history[0]!.evaluation.efficiency
    expect(axialUi.copy.efficiency(e)).toEqual([
      { label: 'Mass usage', value: e.massUsage },
      { label: 'Stress margin', value: e.stressMargin },
      { label: 'Elongation margin', value: e.elongationMargin },
    ])
  })
})

describe('Stress and Strain I design view: 3D with a 2D fallback', () => {
  afterEach(() => {
    scene.mode = 'ok'
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the lazy 3D scene when WebGL2 exists and swaps to the 2D view on context loss', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    renderRod()
    const stub = await screen.findByRole('button', { name: /Stub 3D scene/ })
    expect(screen.queryByRole('img', { name: ELEVATION_LABEL })).toBeNull()
    expect(screen.getByText(/Latest tested: elongation 1\.51 mm/)).toBeTruthy()
    fireEvent.click(stub)
    expect(screen.getByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    await waitFor(() => expect(screen.getAllByText(AXIAL_FALLBACK_NOTICE).length).toBeGreaterThan(0))
  })

  it('shows the 2D view when the 3D scene fails to render', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    scene.mode = 'throw'
    renderRod()
    expect(await screen.findByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    expect(screen.getAllByText(AXIAL_FALLBACK_NOTICE).length).toBeGreaterThan(0)
  })
})
