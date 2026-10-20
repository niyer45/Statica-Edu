import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { column, columnChallenge, tube } from '../../../../test/fixtures/column'
import { columnModel } from '../../../state/columnModel'
import type { SessionStorage } from '../../../state/persistence'
import { columnRuntime, type ModelRuntime } from '../../../state/runtimes'
import StoreProvider from '../../state/StoreProvider'
import TechnicalArt from '../../shell/TechnicalArt'
import Workbench from '../../workbench/Workbench'
import { modelUiFor } from '../registry'
import { columnUi, COLUMN_LIMITS_NOTICE } from '.'
import { ELEVATION_LABEL } from './ColumnElevation'
import { COLUMN_FALLBACK_NOTICE } from './ColumnView'
import { DISPLAY_NOTE, modeShapePoints } from './columnLayout'

// The real 3D scene needs WebGL; these tests replace the lazy chunk to drive the 3D-or-2D switch.
const scene = vi.hoisted(() => ({ mode: 'ok' as 'ok' | 'throw' }))
vi.mock('./ColumnScene3D', () => ({
  default: ({ onContextLost }: { onContextLost: () => void }) => {
    if (scene.mode === 'throw') throw new Error('Canvas creation failed')
    return (
      <button type="button" onClick={onContextLost}>
        Stub 3D scene: lose context
      </button>
    )
  },
}))

// Column Buckling I workbench (task 68; CBK-18, CBK-19) through the PRODUCTION model UI registry.
// Expected numbers are the worksheet values (test/fixtures/column.ts) rounded for display.

const clock = () => '2026-10-19T00:00:00.000Z'
let n = 0
const newId = () => `c-${++n}`
const ch = columnChallenge()

function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
  return { values, storage }
}

function renderColumn(mode: 'guided' | 'parametric' = 'parametric', storage?: SessionStorage) {
  const init = columnRuntime.init(ch, clock(), 'base', mode)
  if (!init.ok) throw new Error('column challenge must initialize')
  return render(
    <StoreProvider challenge={ch} initialSession={init.value} runtime={columnRuntime as unknown as ModelRuntime} storage={storage ?? null} clock={clock} newId={newId}>
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
  const dialog = screen.getByRole('dialog', { name: 'Predict critical load' })
  expect(within(dialog).getByText(/how will your new column change its critical buckling load\?/)).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('radio', { name: direction }))
  fireEvent.click(within(dialog).getByRole('button', { name: /Run structural test/ }))
}

/** Baseline → internal reference (tube 60 × 2 mm) with the iteration-1 prediction. */
function testReference() {
  fireEvent.click(screen.getByRole('button', { name: /Hollow tube/ }))
  setMm('Outer diameter', '60')
  setMm('Wall thickness', '2')
  runTest(/Increase/)
}

afterEach(cleanup)

describe('Column Buckling I workbench', () => {
  it('is registered in the production model UI registry', () => {
    expect(modelUiFor(ch.model)).toBe(columnUi)
  })

  it('shows the baseline failing buckling and mass while its stress passes, with column wording only', () => {
    renderColumn()
    expect(within(requirement('Critical buckling load')).getByText('3.01 kN')).toBeTruthy()
    expect(within(requirement('Critical buckling load')).getByText('≥ 20.00 kN')).toBeTruthy()
    expect(within(requirement('Axial stress')).getByText('21.2 MPa')).toBeTruthy()
    expect(within(requirement('Axial stress')).getByText('✓ Pass')).toBeTruthy()
    expect(within(requirement('Mass')).getByText('2.55 kg')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Design requirements' })).getAllByText('✗ Fail')).toHaveLength(2)
    expect(screen.getByText(COLUMN_LIMITS_NOTICE)).toBeTruthy()
    expect(screen.getByText(/The current solid bar is strong enough not to crush/)).toBeTruthy()
    // jsdom has no WebGL2: the 2D side view shows with a notice and the text summary.
    expect(screen.getByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    expect(screen.getAllByText(COLUMN_FALLBACK_NOTICE).length).toBeGreaterThan(0)
    expect(screen.getByText(/Latest tested critical buckling load 3\.01 kN \(needs ≥ 20\.00 kN\)/)).toBeTruthy()
    expect(screen.getByText(new RegExp(DISPLAY_NOTE.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy()
    expect(screen.queryByText(/cantilever|bracket|torsion|twist/i)).toBeNull()
  })

  it('draws the draft column: pins, support, load, mode shape and its cross-section, with no text on it', () => {
    renderColumn()
    const svg = screen.getByRole('img', { name: ELEVATION_LABEL })
    expect(svg.querySelectorAll('circle.column-pin')).toHaveLength(2)
    expect(svg.querySelectorAll('polygon.column-support')).toHaveLength(1)
    expect(svg.querySelectorAll('line.column-load')).toHaveLength(1)
    expect(svg.querySelectorAll('polyline.column-mode')).toHaveLength(1)
    expect(svg.querySelectorAll('circle.column-section')).toHaveLength(1)
    expect(svg.querySelectorAll('circle.column-bore')).toHaveLength(0)
    expect(svg.querySelectorAll('text')).toHaveLength(0)
    const width = svg.querySelector('rect.column-body')!.getAttribute('width')
    fireEvent.click(screen.getByRole('button', { name: /Hollow tube/ }))
    setMm('Outer diameter', '60')
    expect(svg.querySelectorAll('circle.column-bore')).toHaveLength(1)
    expect(svg.querySelector('rect.column-body')!.getAttribute('width')).not.toBe(width)
  })

  it('runs the learning loop to an Accepted reference with a scored critical-load prediction', () => {
    renderColumn()
    testReference()
    expect(within(requirement('Critical buckling load')).getByText('26.12 kN')).toBeTruthy()
    expect(within(requirement('Axial stress')).getByText('27.4 MPa')).toBeTruthy()
    expect(within(requirement('Mass')).getByText('1.97 kg')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Design requirements' })).queryByText('✗ Fail')).toBeNull()
    expect(within(screen.getByLabelText('Result status')).getByText(/Accepted/)).toBeTruthy()
    fireEvent.click(screen.getAllByText('Test details').at(-1)!)
    expect(screen.getByText(/Prediction: increase · Actual: increase · Matched/)).toBeTruthy()
    expect(screen.getByText('Critical buckling load changed by ×8.67.')).toBeTruthy()
  })

  it('reports a stocky tube as outside the Euler range, with its reason', () => {
    renderColumn()
    fireEvent.click(screen.getByRole('button', { name: /Hollow tube/ }))
    setMm('Outer diameter', '80')
    setMm('Wall thickness', '2')
    runTest(/Increase/)
    const reasons = screen.getByRole('list', { name: 'Model applicability reasons' })
    expect(within(reasons).getByText(/Buckling stress divided by yield stress is 0\.54, above the model limit of 0\.5/)).toBeTruthy()
    expect(within(requirement('Mass')).getByText('Outside model assumptions')).toBeTruthy()
    expect(within(screen.getByLabelText('Result status')).getByText(/Model not applicable/)).toBeTruthy()
    const values = screen.getByRole('table', { name: 'Latest tested column values' })
    expect(within(within(values).getByRole('row', { name: /^Slenderness/ })).getByText('72 (Euler applies from 75)')).toBeTruthy()
  })

  it('shows a caution for a thin wall without blocking acceptance', () => {
    renderColumn()
    fireEvent.click(screen.getByRole('button', { name: /Hollow tube/ }))
    setMm('Outer diameter', '60')
    setMm('Wall thickness', '1')
    runTest(/Increase/)
    expect(within(screen.getByRole('list', { name: 'Model warnings' })).getByText(/Outer diameter divided by wall thickness is 60, above the caution level of 40/)).toBeTruthy()
  })

  it('rejects an out-of-range value inline without changing the draft', () => {
    renderColumn()
    setMm('Diameter', '70')
    const input = screen.getByLabelText('Diameter')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toBe('Diameter: Diameter must be at most 60 mm (got 70 mm).')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(value('Diameter')).toBe('24.5')
    setMm('Diameter', 'abc')
    expect(screen.getByLabelText('Diameter').getAttribute('aria-invalid')).toBe('true')
  })

  it('switches between solid bar and tube, keeping the outer diameter, and back', () => {
    renderColumn()
    fireEvent.click(screen.getByRole('button', { name: /Hollow tube/ }))
    expect(value('Outer diameter')).toBe('24.5')
    expect(value('Wall thickness')).toBe('3.0')
    fireEvent.keyDown(screen.getByRole('button', { name: /Solid bar/ }), { key: 'Enter' })
    expect(value('Diameter')).toBe('24.5')
  })

  it('lists the fixed length, load, pinned ends and material', () => {
    renderColumn()
    fireEvent.click(screen.getByText('Some things are fixed.'))
    expect(screen.getByText('2000.0 mm between the pins')).toBeTruthy()
    expect(screen.getByText('10 kN pressing straight down at the top')).toBeTruthy()
    expect(screen.getByText(/Pinned at the top and bottom/)).toBeTruthy()
  })

  it('compares, restores and deletes with the shared semantics', () => {
    renderColumn()
    testReference()
    fireEvent.click(screen.getByRole('tab', { name: 'Compare results' }))
    const table = screen.getByRole('table', { name: 'Iteration 1 differences' })
    expect(within(table).getByText('critical buckling load')).toBeTruthy()
    expect(within(table).getByText('critical load per kilogram')).toBeTruthy()
    expect(within(table).getAllByText(/^\+/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Design history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore Baseline' }))
    expect(value('Diameter')).toBe('24.5')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Iteration 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Iteration 1?' })).getByRole('button', { name: 'Delete iteration' }))
    expect(screen.queryByRole('button', { name: /^Iteration 1/ })).toBeNull()
  })

  it('opens the column buckling reference with formulas, key points, sources and unsupported effects', () => {
    renderColumn()
    fireEvent.click(screen.getByRole('button', { name: /Column buckling reference/ }))
    const dialog = screen.getByRole('dialog', { name: 'Column buckling' })
    expect(within(dialog).getByText(/Twice the length means a quarter of the critical load/)).toBeTruthy()
    expect(within(dialog).getByText(/Buckling is a stiffness failure/)).toBeTruthy()
    expect(within(dialog).getByText(/edition and equation numbers pending engineering review/)).toBeTruthy()
    expect(within(dialog).getByText(/initial crookedness/)).toBeTruthy()
    expect(within(dialog).getByText(/not a real-world approval/)).toBeTruthy()
  })

  it('Guided locks every control but the step one and never reveals reference numbers; Parametric is open', () => {
    renderColumn('guided')
    expect(within(screen.getByRole('region', { name: 'Guided experiments' })).getByRole('heading', { name: 'Thicken the solid bar' })).toBeTruthy()
    expect((screen.getByLabelText('Diameter') as HTMLInputElement).readOnly).toBe(false)
    expect(screen.getByRole('button', { name: /Hollow tube/ }).getAttribute('aria-disabled')).toBe('true')
    expect(columnUi.guided.steps.map((s) => `${s.instruction} ${s.hint}`).join(' ')).not.toMatch(/\d/)
    cleanup()
    renderColumn('parametric')
    expect(screen.queryByRole('region', { name: 'Guided experiments' })).toBeNull()
    expect(screen.getByRole('button', { name: /Hollow tube/ }).getAttribute('aria-disabled')).toBeNull()
  })

  it('persists the tested workspace under its own version-1 key in the v2 envelope', () => {
    const { values, storage } = memory()
    renderColumn('parametric', storage)
    testReference()
    const saved = JSON.parse(values.get('ei:session:column-buckling-1:v1')!)
    expect(saved).toMatchObject({ schemaVersion: 2, model: { id: 'eulerColumnBuckling', version: 1 } })
    cleanup()
    renderColumn('parametric', storage)
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    expect(within(requirement('Critical buckling load')).getByText('26.12 kN')).toBeTruthy()
  })

  it('imports a valid v2 design file and rejects an invalid one with its reasons', async () => {
    renderColumn()
    const file = (text: string) => new File([text], 'design.json', { type: 'application/json' })
    const valid = columnModel.exportDesign(column('imported', tube(0.05, 0.0025)), ch)
    fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file(valid)] } })
    await waitFor(() => expect(value('Outer diameter')).toBe('50.0'))
    const invalid = JSON.parse(valid)
    invalid.design.section.wallThicknessM = 0.01
    fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file(JSON.stringify(invalid))] } })
    const dialog = await screen.findByRole('dialog', { name: 'Design could not be imported' })
    expect(within(dialog).getByText(/Wall thickness must be at most 6 mm/)).toBeTruthy()
  })

  it('labels the three stored margins', () => {
    const init = columnRuntime.init(ch, clock(), 'base')
    if (!init.ok) throw new Error('init')
    const e = init.value.history[0]!.evaluation.efficiency
    expect(columnUi.copy.efficiency(e)).toEqual([
      { label: 'Mass usage', value: e.massUsage },
      { label: 'Buckling margin', value: e.bucklingMargin },
      { label: 'Stress margin', value: e.stressMargin },
    ])
  })
})

describe('Column Buckling I design view: 3D with a 2D fallback', () => {
  afterEach(() => {
    scene.mode = 'ok'
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the lazy 3D scene when WebGL2 exists and swaps to the 2D view on context loss', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    renderColumn()
    const stub = await screen.findByRole('button', { name: /Stub 3D scene/ })
    expect(screen.queryByRole('img', { name: ELEVATION_LABEL })).toBeNull()
    fireEvent.click(stub)
    expect(screen.getByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
    await waitFor(() => expect(screen.getAllByText(COLUMN_FALLBACK_NOTICE).length).toBeGreaterThan(0))
  })

  it('shows the 2D view when the 3D scene fails to render', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    scene.mode = 'throw'
    renderColumn()
    expect(await screen.findByRole('img', { name: ELEVATION_LABEL })).toBeTruthy()
  })
})

describe('column display helpers and technical art', () => {
  it('the mode shape is half a sine wave between the pins, zero at both ends', () => {
    const pts = modeShapePoints(2, 0.18, 40)
    expect(pts).toHaveLength(41)
    expect(pts[0]).toEqual([0, 0])
    expect(pts[40]![0]).toBeCloseTo(0, 12)
    expect(pts[40]![1]).toBe(2)
    expect(pts[20]![0]).toBeCloseTo(0.18, 12)
  })

  it('TechnicalArt draws the column (FIG. 03) with its dashed mode shape and a load arrow', () => {
    const { container } = render(<TechnicalArt kind="column" />)
    expect(container.textContent).toContain('FIG. 03')
    expect(container.querySelectorAll('polyline[stroke-dasharray]')).toHaveLength(1)
    expect(container.querySelectorAll('path.art-accent')).toHaveLength(1)
    expect(container.querySelectorAll('polygon').length).toBeGreaterThan(50)
  })
})
