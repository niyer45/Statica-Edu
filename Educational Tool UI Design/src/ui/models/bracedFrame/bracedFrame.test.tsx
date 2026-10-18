import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { bracedFrameChallenge } from '../../../../test/fixtures/bracedFrame'
import { bracedFrameRuntime, type ModelRuntime } from '../../../state/runtimes'
import type { SessionStorage } from '../../../state/persistence'
import StoreProvider from '../../state/StoreProvider'
import Workbench from '../../workbench/Workbench'
import { modelUiFor } from '../registry'
import { bracedFrameUi, BRACED_FRAME_LIMITS_NOTICE } from '.'
import { FRAME_CHANGE, FRAME_GOAL } from './BracedFrameGoal'

// Braced Frame I workbench (task 49.3) through the PRODUCTION model UI registry. The challenge
// is booted directly here; card activation is a separate, explicitly approved step. Expected
// numbers are the braced-frame-1 worksheet values (design.md) at display precision.

const clock = () => '2026-10-17T00:00:00.000Z'
let n = 0
const newId = () => `f-${++n}`
const ch = bracedFrameChallenge()

function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) }
  return { values, storage }
}

function renderFrame(mode: 'guided' | 'parametric' = 'guided', storage?: SessionStorage) {
  const init = bracedFrameRuntime.init(ch, clock(), 'base', mode)
  if (!init.ok) throw new Error('braced frame challenge must initialize')
  return render(
    <StoreProvider challenge={ch} initialSession={init.value} runtime={bracedFrameRuntime as unknown as ModelRuntime} storage={storage ?? null} clock={clock} newId={newId}>
      <Workbench onExit={() => {}} />
    </StoreProvider>,
  )
}

const toggle = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const section = (member: RegExp, id: string) => fireEvent.change(screen.getByLabelText(member), { target: { value: id } })

function runWithPrediction(direction: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: 'Run Test' }))
  const dialog = screen.getByRole('dialog', { name: 'Predict roof drift' })
  expect(within(dialog).getByText('Compared with the Baseline, how will your new frame change its roof drift?')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('radio', { name: direction }))
  fireEvent.click(within(dialog).getByRole('button', { name: /Run structural test/ }))
}

/** Baseline → the spec reference design (BFR-05) with the iteration-1 prediction. */
function testReference() {
  toggle('Storey 1 diagonal, bottom right to top left')
  toggle('Storey 2 diagonal, bottom right to top left')
  toggle('Storey 1 diagonal, bottom left to top right')
  toggle('Storey 2 diagonal, bottom left to top right')
  section(/^Lower left column/, 'CHS48.3x3.2')
  section(/^Lower right column/, 'CHS88.9x5.0')
  section(/^Upper right column/, 'CHS76.1x4.0')
  section(/^Floor beam/, 'CHS76.1x4.0')
  section(/^Roof beam/, 'CHS76.1x4.0')
  section(/^Lower diagonal \(bottom left to top right\)/, 'CHS76.1x4.0')
  section(/^Upper diagonal \(bottom left to top right\)/, 'CHS48.3x3.2')
  // The worksheet ratio baseline → reference is 1.19: roof drift increases.
  runWithPrediction(/Increase/)
}

const requirements = () => screen.getByRole('list', { name: 'Design requirements' })
const forceTable = () => screen.queryByRole('table', { name: 'Latest tested member forces' })

afterEach(cleanup)
// Load the lazy 3D view chunk once up front so later renders resolve it without delay.
beforeAll(() => import('./BracedFrameViewport3D'), 30_000)

describe('Braced Frame I workbench', () => {
  it('is registered in the production model UI registry', () => {
    expect(modelUiFor(ch.model)).toBe(bracedFrameUi)
  })

  it('shows the baseline utilization failure with frame wording and no beam or torsion wording', async () => {
    renderFrame()
    // The drawing is the lazy 3D chunk; jsdom has no WebGL2, so it resolves to the SVG fallback.
    await screen.findByRole('img', { name: /Two-storey braced frame elevation/ }, { timeout: 5000 })
    const list = requirements()
    expect(within(list).getByText('Stable')).toBeTruthy()
    expect(within(list).getByText('8.72 mm')).toBeTruthy()
    expect(within(list).getByText('337.2%')).toBeTruthy()
    expect(within(list).getByText('166.6 kg')).toBeTruthy()
    expect(within(list).getAllByText('✗ Fail')).toHaveLength(1)
    // Task 56 goal card: one goal, what to change, short check labels and a pass count.
    const goal = screen.getByRole('region', { name: 'Goal' })
    expect(within(goal).getByText(FRAME_GOAL)).toBeTruthy()
    expect(within(goal).getByText(FRAME_CHANGE)).toBeTruthy()
    expect(within(goal).getByText('3 of 4 pass')).toBeTruthy()
    expect(within(list).getAllByRole('listitem').map((li) => li.querySelector('.goal-label')!.textContent)).toEqual(['Stability', 'Roof drift', 'Member utilization', 'Mass'])
    expect(within(goal).getByText('Governing member: Lower diagonal (bottom right to top left), compression, Euler buckling.')).toBeTruthy()
    // The full statement with the pin-jointed idealization is kept behind a disclosure.
    const brief = screen.getByText('Full brief and model assumptions').closest('details')!
    expect(brief.open).toBe(false)
    expect(within(brief).getByText(/This frame is modeled as pin-jointed: every joint is a hinge/)).toBeTruthy()
    // Full constraint labels stay in the Test details table.
    expect(within(screen.getByRole('table', { name: 'Latest tested results' })).getByText('Maximum member utilization')).toBeTruthy()
    expect(screen.getByText(BRACED_FRAME_LIMITS_NOTICE)).toBeTruthy()
    expect(screen.getByText('Direct stiffness · Pin-jointed frame')).toBeTruthy()
    expect(screen.getByRole('img', { name: /Two-storey braced frame elevation; diagonals not present/ })).toBeTruthy()
    // Member forces: pattern key text plus the table equivalent of the drawing.
    expect(screen.getByRole('list', { name: 'Line pattern key' }).textContent).toContain('Double: compression (C)')
    // Key and member force table are collapsed by default (task 56).
    expect(screen.getByRole('list', { name: 'Line pattern key' }).closest('details')!.open).toBe(false)
    expect(forceTable()!.closest('details')!.open).toBe(false)
    const table = forceTable()!
    const diag = within(table).getByRole('row', { name: /Lower diagonal \(bottom right to top left\)/ })
    expect(within(diag).getByText('75.0 kN compression')).toBeTruthy()
    expect(within(diag).getByText('Euler buckling')).toBeTruthy()
    expect(within(within(table).getByRole('row', { name: /^Roof beam/ })).getByText('≈ 0')).toBeTruthy()
    expect(within(table).getByRole('row', { name: /^Upper diagonal \(bottom left to top right\)/ }).textContent).toContain('Not present')
    expect(document.querySelectorAll('.frame-label').length).toBe(8)
    // No beam-solver or torsion wording (floor/roof "beam" are frame member names, and "bending" appears only in the idealization sentence).
    expect(screen.queryByText(/deflection|cantilever|euler.bernoulli|twist|torsion|shaft/i)).toBeNull()
  })

  it('runs the learning loop to an Accepted reference frame with a scored roof-drift prediction', () => {
    renderFrame()
    testReference()
    const list = requirements()
    expect(within(list).getByText('10.38 mm')).toBeTruthy()
    expect(within(list).getByText('82.4%')).toBeTruthy()
    expect(within(list).getByText('190.0 kg')).toBeTruthy()
    expect(within(list).queryByText('✗ Fail')).toBeNull()
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    expect(screen.getAllByText('✓ Accepted').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByText('Test details').at(-1)!)
    expect(screen.getByText(/Prediction: increase · Actual: increase · Matched/)).toBeTruthy()
    expect(within(forceTable()!).getByRole('row', { name: /^Lower diagonal \(bottom right to top left\)/ }).textContent).toContain('Not present')
  })

  it('shows a mechanism as unstable with no drift or force numbers and a not-scorable prediction', () => {
    renderFrame()
    toggle('Storey 2 diagonal, bottom right to top left')
    runWithPrediction(/Decrease/)
    const list = requirements()
    expect(within(list).getByText('Unstable mechanism')).toBeTruthy()
    expect(within(list).getAllByText('Not applicable')).toHaveLength(2)
    expect(within(list).queryByText(/mm$|%$/)).toBeNull()
    expect(within(list).getByText('138.8 kg')).toBeTruthy()
    expect(screen.getByText(/Unstable mechanism\. Unstable: storey 2 has no diagonal\. Member forces and drift are not defined/)).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Goal' })).getByText('Unstable: storey 2 has no diagonal.')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Goal' })).getByText('1 of 4 pass')).toBeTruthy()
    expect(forceTable()).toBeNull()
    expect(document.querySelectorAll('.frame-label')).toHaveLength(0)
    expect(screen.getByRole('list', { name: 'Model applicability reasons' }).textContent).toMatch(/mechanism/)
    expect(screen.getAllByText('! Model not applicable').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByText('Test details').at(-1)!)
    expect(screen.getByText('Prediction: decrease · Not scorable: roof drift is not defined for a mechanism')).toBeTruthy()
    // Compare shows the mechanism's drift as not applicable, never as a number.
    fireEvent.click(screen.getByRole('tab', { name: 'Compare results' }))
    const row = within(screen.getByRole('table', { name: 'Iteration 1 differences' })).getByRole('row', { name: /^roof drift/ })
    expect(within(row).getAllByText('Not applicable').length).toBeGreaterThanOrEqual(2)
  })

  it('toggles diagonals from the keyboard with aria-pressed and a visible state', async () => {
    const user = userEvent.setup()
    renderFrame()
    const upper = screen.getByRole('button', { name: 'Storey 2 diagonal, bottom left to top right' })
    expect(upper.getAttribute('aria-pressed')).toBe('false')
    expect(upper.textContent).toContain('Off')
    upper.focus()
    await user.keyboard('{Enter}')
    expect(upper.getAttribute('aria-pressed')).toBe('true')
    expect(upper.textContent).toContain('✓ On')
    await user.keyboard(' ')
    expect(upper.getAttribute('aria-pressed')).toBe('false')
    // Tab reaches the next diagonal toggle in document order.
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Storey 2 diagonal, bottom right to top left' }))
    await user.keyboard('{Enter}')
    expect(document.activeElement!.getAttribute('aria-pressed')).toBe('false')
    // The absent diagonal keeps its section select, named as not present and marked "off".
    const absentSelect = screen.getByLabelText('Upper diagonal (bottom right to top left), not present (choice kept)')
    expect(absentSelect.closest('div')!.querySelector('label small')!.textContent).toBe('off')
  })

  it('compares, restores and deletes with the shared semantics', () => {
    renderFrame()
    testReference()
    fireEvent.click(screen.getByRole('tab', { name: 'Compare results' }))
    const table = screen.getByRole('table', { name: 'Iteration 1 differences' })
    const drift = within(table).getByRole('row', { name: /^roof drift/ })
    expect(within(drift).getByText('10.38 mm')).toBeTruthy()
    expect(within(drift).getAllByText('+1.66 mm').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Design history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore Baseline' }))
    expect(screen.getByRole('button', { name: 'Storey 1 diagonal, bottom right to top left' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText(/^Lower right column/) as HTMLSelectElement).value).toBe('CHS60.3x4.0')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Iteration 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Iteration 1?' })).getByRole('button', { name: 'Delete iteration' }))
    expect(screen.queryByRole('button', { name: /^Iteration 1/ })).toBeNull()
  })

  it('opens the pin-jointed frame reference from the challenge panel', () => {
    renderFrame()
    fireEvent.click(screen.getByRole('button', { name: /Pin-jointed frame reference/ }))
    const dialog = screen.getByRole('dialog', { name: 'Pin-jointed frame' })
    expect(within(dialog).getByText(/every joint is a hinge, so members carry only tension or compression/)).toBeTruthy()
    expect(within(dialog).getByText(/does not include: rigid or semi-rigid joints/)).toBeTruthy()
  })

  it('Guided shows frame steps without reference values; Parametric omits guidance and shows the direct-edit label', () => {
    renderFrame()
    const guided = screen.getByRole('region', { name: 'Guided instructions' })
    expect(within(guided).getByRole('heading', { name: 'Inspect' })).toBeTruthy()
    const allGuidance = bracedFrameUi.guidance.steps.map((s) => `${s.instruction} ${s.hint}`).join(' ')
    expect(allGuidance).not.toMatch(/\d|CHS|always best/)
    cleanup()
    renderFrame('parametric')
    expect(screen.getByText('Direct bracing and member section editing')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Guided instructions' })).toBeNull()
  })

  it('persists the tested workspace under its own key in the v2 envelope', () => {
    const { values, storage } = memory()
    renderFrame('guided', storage)
    testReference()
    const saved = JSON.parse(values.get('ei:session:braced-frame-1:v1')!)
    expect(saved).toMatchObject({ schemaVersion: 2, model: { id: 'pinJointedBracedFrame', version: 1 } })
    cleanup()
    renderFrame('guided', storage)
    expect(screen.getByRole('button', { name: /^Iteration 1/ })).toBeTruthy()
    expect(within(requirements()).getByText('10.38 mm')).toBeTruthy()
  })
})
