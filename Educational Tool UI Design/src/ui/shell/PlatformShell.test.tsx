import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { catalog } from '../../challenge/catalog'
import { bundledChallengeResult } from '../../challenge/content'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { useSession } from '../state/store'
import { DEFAULT_FILTERS, filterCatalog } from './LibraryPage'
import { stepStatus } from './LearningPathsPage'
import PlatformShell from './PlatformShell'

// Task 13.5 smoke tests for the platform shell (fuller component tests: task 13.6).

const clock = () => '2025-01-01T00:00:00.000Z'
const newId = () => 'baseline-id'

function ModeProbe() {
  return <output data-testid="mode">{useSession().mode}</output>
}

function renderShell() {
  const boot = bootstrap(bundledChallengeResult, clock, newId)
  if (!boot.ok) throw new Error(boot.error.message)
  return render(
    <StoreProvider challenge={boot.value.challenge} initialSession={boot.value.session} clock={clock} newId={newId}>
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
