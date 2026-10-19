import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { catalog } from '../../challenge/catalog'
import { bundledChallengeResult } from '../../challenge/content'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { useSession, useDispatch } from '../state/store'
import type { SessionState } from '../../state/session'
import type { InteractionMode } from '../../challenge/types'
import { DEFAULT_FILTERS, filterCatalog } from './LibraryPage'
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
    // This harness mounts one store without the host's other challenges, so only its own
    // available entry is runnable; CatalogHost supplies the others in the app.
    const notRunnableHere = catalog.filter((c) => !(c.available && c.challengeId === 'cantilever-beam-1')).length
    expect(screen.getAllByText('Planned challenge')).toHaveLength(notRunnableHere)
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

  it('My designs shows a workspace card without a results table', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: /Open challenge/ }))
    fireEvent.click(screen.getAllByRole('button', { name: /My designs/ })[0]!)
    expect(screen.queryByRole('table', { name: 'Session test results' })).toBeNull()
    expect(screen.getByRole('button', { name: /Return to workbench/ })).toBeTruthy()
  })

  it('filters the catalog', () => {
    expect(filterCatalog(catalog, { ...DEFAULT_FILTERS, discipline: 'Thermal' }, [])).toHaveLength(1)
    expect(filterCatalog(catalog, { ...DEFAULT_FILTERS, search: 'TORSION' }, []).map((c) => c.id)).toEqual(['003'])
    expect(filterCatalog(catalog, { ...DEFAULT_FILTERS, view: 'Saved' }, ['005']).map((c) => c.id)).toEqual(['005'])
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
  // Each unavailable entry gets its own test budget under CI coverage. Keep all
  // disabled-action/session invariants without aggregating six UI flows into 5s.
  it.each(catalog.filter((entry) => !entry.available))(
    'prevents preview $title from opening or changing the session',
    (entry) => {
      renderShell()
      const before = latest
      fireEvent.click(screen.getByRole('button', { name: `View ${entry.title}` }))
      const drawer = screen.getByRole('dialog', { name: entry.title })
      const button = within(drawer).getByRole('button', { name: /Not available yet/ })
      expect((button as HTMLButtonElement).disabled).toBe(true)
      fireEvent.click(button)
      expect(host().hidden).toBe(true)
      expect(latest).toBe(before)
      fireEvent.click(within(drawer).getByRole('button', { name: 'Close challenge details' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(latest).toBe(before)
    },
  )

  it('prevents Freeform from opening or changing the session', () => {
    renderShell()
    const before = latest
    fireEvent.click(screen.getByRole('button', { name: 'View Cantilever Beam I' }))
    const drawer = screen.getByRole('dialog', { name: 'Cantilever Beam I' })
    fireEvent.click(within(drawer).getByRole('button', { name: /Freeform/ }))
    const button = within(drawer).getByRole('button', { name: /Not available yet/ })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(button)
    expect(host().hidden).toBe(true)
    expect(latest).toBe(before)
  })

  it('combines discipline, difficulty, text search, and saved filters through the UI', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Save Torsion Shaft I' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mechanics' }))
    expect(cards()).toEqual(['View Cantilever Beam I', 'View Torsion Shaft I', 'View Fatigue Analysis I'])
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
    openMode('Parametric') // free editing; Guided locks parameters by step (task 58)
    act(() => dispatch({ type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' }))
    const before = latest
    const workbench = host().querySelector('.workbench')
    for (const page of ['Notebook', 'Learn', 'My designs', 'Challenges']) {
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

  it('preserves the local draft and history while My designs hides results', () => {
    const boot = bootstrap(bundledChallengeResult, clock, newId)
    if (!boot.ok) throw new Error(boot.error.message)
    const baseline = boot.value.session.history[0]!
    renderShell({ ...boot.value.session, history: [baseline, { ...baseline, id: 'stored-1', iteration: 1, label: undefined }] })
    openMode('Parametric') // free editing; Guided locks parameters by step (task 58)
    act(() => dispatch({ type: 'setParam', param: 'diameterM', valueM: 0.08, mode: 'strict' }))
    navigate('My designs')
    const saved = latest
    expect(screen.queryByRole('table', { name: 'Session test results' })).toBeNull()
    expect(screen.queryByText('Test #1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Return to workbench/ }))
    expect(latest).toBe(saved)
    expect(latest.draft.section).toEqual({ kind: 'circle', diameterM: 0.08 })
    expect(latest.history).toHaveLength(2)
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
