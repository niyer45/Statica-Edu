import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { catalog } from '../../challenge/catalog'
import { bundledChallengeResult } from '../../challenge/content'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { useSession, useDispatch } from '../state/store'
import type { SessionState } from '../../state/session'
import type { InteractionMode } from '../../challenge/types'
import { formatMm, paToMpa } from '../../units/units'
import { STATUS_LABELS } from './MyDesignsPage'
import { DEFAULT_FILTERS, filterCatalog } from './LibraryPage'
import { stepStatus } from './LearningPathsPage'
import PlatformShell from './PlatformShell'

// Tasks 13.5/13.6: shell interactions and preservation of the typed session.

const clock = () => '2025-01-01T00:00:00.000Z'
const newId = () => 'baseline-id'

let latest: SessionState
let dispatch: ReturnType<typeof useDispatch>
function ModeProbe() {
  latest = useSession()
  dispatch = useDispatch()
  return <output data-testid="mode">{useSession().mode}</output>
}

function renderShell(initialSession?: SessionState, allowedModes?: InteractionMode[]) {
  const boot = bootstrap(bundledChallengeResult, clock, newId)
  if (!boot.ok) throw new Error(boot.error.message)
  return render(
    <StoreProvider challenge={allowedModes ? { ...boot.value.challenge, allowedModes } : boot.value.challenge} initialSession={initialSession ?? boot.value.session} clock={clock} newId={newId}>
      <PlatformShell />
      <ModeProbe />
    </StoreProvider>,
  )
}

const host = () => screen.getByTestId('workbench-host')
const mode = () => screen.getByTestId('mode').textContent

afterEach(cleanup)

describe('PlatformShell', () => {
  it('renders the library from the catalog with Statica branding and preview labels', () => {
    renderShell()
    expect(document.title).toBe('Statica')
    expect(screen.getAllByRole('button', { name: 'Statica home' }).length).toBeGreaterThan(0)
    for (const c of catalog) expect(screen.getByRole('button', { name: `View ${c.title}` })).toBeTruthy()
    const previews = catalog.filter((c) => !c.available).length
    expect(screen.getAllByText('Planned challenge')).toHaveLength(previews)
    // Workbench is mounted but hidden on the library page.
    expect(host().hidden).toBe(true)
    expect(host().querySelector('.workbench')).not.toBeNull()
  })

  it('disables opening a preview challenge and Freeform', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'View Mounting Bracket I' }))
    const drawer = screen.getByRole('dialog', { name: 'Mounting Bracket I' })
    const open = within(drawer).getByRole('button', { name: /Not available yet/ })
    expect(open.hasAttribute('disabled')).toBe(true)
    fireEvent.click(within(drawer).getByRole('button', { name: 'Close challenge details' }))

    fireEvent.click(screen.getByRole('button', { name: 'View Cantilever Beam I' }))
    const beam = screen.getByRole('dialog', { name: 'Cantilever Beam I' })
    fireEvent.click(within(beam).getByRole('button', { name: /Freeform/ }))
    expect(within(beam).getByRole('button', { name: /Not available yet/ }).hasAttribute('disabled')).toBe(true)
    expect(host().hidden).toBe(true)
    expect(mode()).toBe('guided')
  })

  it('opens Parametric and Guided in the same mounted Workbench, keeping it across navigation', () => {
    renderShell()
    const workbench = host().querySelector('.workbench')
    fireEvent.click(screen.getByRole('button', { name: 'View Cantilever Beam I' }))
    const beam = screen.getByRole('dialog', { name: 'Cantilever Beam I' })
    fireEvent.click(within(beam).getByRole('button', { name: /Parametric/ }))
    fireEvent.click(within(beam).getByRole('button', { name: /Open challenge/ }))
    expect(host().hidden).toBe(false)
    expect(mode()).toBe('parametric')

    fireEvent.click(screen.getAllByRole('button', { name: 'Notebook' })[0]!)
    expect(host().hidden).toBe(true)
    expect(host().querySelector('.workbench')).toBe(workbench)

    fireEvent.click(screen.getByRole('button', { name: /Resume challenge/ }))
    expect(host().hidden).toBe(false)
    expect(mode()).toBe('parametric')
    expect(host().querySelector('.workbench')).toBe(workbench)
  })

  it('My designs lists the session Test_Results', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: /Open challenge/ }))
    fireEvent.click(screen.getAllByRole('button', { name: /My designs/ })[0]!)
    const table = screen.getByRole('table', { name: 'Session test results' })
    // Bootstrap history holds only the Baseline.
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    expect(within(table).getByText('Baseline')).toBeTruthy()
  })

  it('filters the catalog and labels non-first learning-path steps Planned', () => {
    expect(filterCatalog(catalog, { ...DEFAULT_FILTERS, discipline: 'Thermal' }, [])).toHaveLength(1)
    expect(filterCatalog(catalog, { ...DEFAULT_FILTERS, search: 'TORSION' }, []).map((c) => c.id)).toEqual(['003'])
    expect(filterCatalog(catalog, { ...DEFAULT_FILTERS, view: 'Saved' }, ['005']).map((c) => c.id)).toEqual(['005'])
    expect(stepStatus(0, 0, 0)).toBe('Available')
    expect(stepStatus(0, 0, 1)).toBe('Tested this session')
    expect(stepStatus(0, 1, 5)).toBe('Planned')
    expect(stepStatus(2, 0, 5)).toBe('Planned')
  })
})


const navigate = (name: string) => fireEvent.click(within(screen.getByRole('navigation', { name: 'Platform' })).getByRole('button', { name: new RegExp(name) }))
const cards = () => screen.queryAllByRole('button', { name: /^View / }).map((b) => b.getAttribute('aria-label'))
function openMode(name: 'Guided' | 'Parametric') {
  fireEvent.click(screen.getByRole('button', { name: 'View Cantilever Beam I' }))
  const drawer = screen.getByRole('dialog', { name: 'Cantilever Beam I' })
  fireEvent.click(within(drawer).getByRole('button', { name: new RegExp(name) }))
  fireEvent.click(within(drawer).getByRole('button', { name: 'Open challenge' }))
}

describe('platform shell component suite (13.6)', () => {
  it('prevents every preview and Freeform from opening or changing the session', () => {
    renderShell()
    const before = latest
    for (const entry of catalog.filter((c) => !c.available)) {
      fireEvent.click(screen.getByRole('button', { name: `View ${entry.title}` }))
      const drawer = screen.getByRole('dialog', { name: entry.title })
      const button = within(drawer).getByRole('button', { name: /Not available yet/ })
      expect((button as HTMLButtonElement).disabled).toBe(true)
      fireEvent.click(button)
      expect(host().hidden).toBe(true)
      expect(latest).toBe(before)
      fireEvent.click(within(drawer).getByRole('button', { name: 'Close challenge details' }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'View Cantilever Beam I' }))
    const drawer = screen.getByRole('dialog', { name: 'Cantilever Beam I' })
    fireEvent.click(within(drawer).getByRole('button', { name: /Freeform/ }))
    fireEvent.click(within(drawer).getByRole('button', { name: /Not available yet/ }))
    expect(host().hidden).toBe(true)
    expect(latest).toBe(before)
  })

  it('combines discipline, difficulty, text search, and saved filters through the UI', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Save Torsion Shaft I' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mechanics' }))
    expect(cards()).toEqual(['View Cantilever Beam I', 'View Torsion Shaft I'])
    fireEvent.change(screen.getByLabelText('Filter difficulty'), { target: { value: 'intermediate' } })
    expect(cards()).toEqual(['View Torsion Shaft I'])
    fireEvent.change(screen.getByLabelText('Search challenges'), { target: { value: 'TORSION' } })
    fireEvent.click(screen.getByRole('button', { name: /Saved for later/ }))
    expect(cards()).toEqual(['View Torsion Shaft I'])
    fireEvent.click(screen.getByRole('button', { name: 'Unsave Torsion Shaft I' }))
    expect(cards()).toEqual([])
    expect(screen.getByText('No saved challenges')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Explore all challenges' }))
    expect(cards()).toHaveLength(catalog.length)
  })

  it('preserves edited draft, stored history, comparison, reflection and submission across every page', () => {
    const boot = bootstrap(bundledChallengeResult, clock, newId)
    if (!boot.ok) throw new Error(boot.error.message)
    const baseline = boot.value.session.history[0]!
    const stored = { ...baseline, id: 'stored-1', iteration: 1, label: undefined }
    const seeded: SessionState = {
      ...boot.value.session,
      history: [baseline, stored], compareSelection: [stored.id], reflectionAnswer: 'A stored reflection.',
      submission: { testResultId: stored.id, status: stored.evaluation.status, reflection: 'A stored reflection.', efficiency: stored.evaluation.efficiency, submittedAt: clock() },
    }
    renderShell(seeded)
    openMode('Guided')
    act(() => dispatch({ type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' }))
    const before = latest
    const workbench = host().querySelector('.workbench')
    for (const page of ['Notebook', 'Learning paths', 'My designs', 'Challenges']) {
      navigate(page)
      expect(host().hidden).toBe(true)
      expect(latest).toBe(before)
      fireEvent.click(screen.getByRole('button', { name: /Resume challenge/ }))
      expect(host().hidden).toBe(false)
      expect(host().querySelector('.workbench')).toBe(workbench)
      expect(latest).toBe(before)
      expect((screen.getByRole('spinbutton', { name: /Diameter/ }) as HTMLInputElement).value).toBe('40.00')
    }
  })

  it('shows only stored results and their metrics even after an untested draft edit', () => {
    const boot = bootstrap(bundledChallengeResult, clock, newId)
    if (!boot.ok) throw new Error(boot.error.message)
    const baseline = boot.value.session.history[0]!
    renderShell({ ...boot.value.session, history: [baseline, { ...baseline, id: 'stored-1', iteration: 1, label: undefined }] })
    openMode('Guided')
    act(() => dispatch({ type: 'setParam', param: 'diameterM', valueM: 0.08, mode: 'strict' }))
    navigate('My designs')
    const table = screen.getByRole('table', { name: 'Session test results' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(latest.history.length)
    rows.forEach((row, i) => {
      const result = latest.history[i]!
      expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual([
        `${formatMm(result.analysis.tipDeflectionM)} mm`, `${result.analysis.massKg.toFixed(3)} kg`,
        `${paToMpa(result.analysis.nominalMaxStressPa).toFixed(1)} MPa`, STATUS_LABELS[result.evaluation.status],
      ])
    })
  })

  it.each(['Guided', 'Parametric'] as const)('opens the same challenge with all fields locked in %s', (modeName) => {
    renderShell()
    const original = latest
    openMode(modeName)
    expect(latest.challengeId).toBe(original.challengeId)
    expect(latest.draft).toEqual(original.draft)
    expect(latest.history).toBe(original.history)
    expect(latest.mode).toBe(modeName.toLowerCase())
    fireEvent.click(screen.getByText('Some things are fixed.'))
    for (const label of ['Span', 'Material', 'Load', 'Support']) {
      const input = screen.getByRole('textbox', { name: label }) as HTMLInputElement
      expect(input.readOnly).toBe(true)
      expect(input.getAttribute('aria-readonly')).toBe('true')
      expect(screen.getByRole('img', { name: `${label} is fixed by the challenge` })).toBeTruthy()
    }
  })

  it('rejects a requested mode outside the challenge allowedModes without opening a Workbench', () => {
    renderShell(undefined, ['guided'])
    const before = latest
    fireEvent.click(screen.getByRole('button', { name: 'View Cantilever Beam I' }))
    const drawer = screen.getByRole('dialog', { name: 'Cantilever Beam I' })
    fireEvent.click(within(drawer).getByRole('button', { name: /Parametric/ }))
    expect((within(drawer).getByRole('button', { name: /Not available yet/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(latest).toBe(before)
    expect(host().hidden).toBe(true)
  })
})
