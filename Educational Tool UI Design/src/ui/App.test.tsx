import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bundledChallengeResult, cantileverBeam1Json } from '../challenge/content'
import { loadChallenge } from '../challenge/loader'
import App, { bootCatalog } from './App'
import { catalog } from '../challenge/catalog'

// Task 13.2: bootstrap and full-page error (Req 3.3).

const clock = () => '2025-01-01T00:00:00.000Z'
const newId = () => 'baseline-id'

afterEach(cleanup)

describe('bootCatalog (task 34.1 step 2; MM-06)', () => {
  it('boots only available entries, in catalog order', () => {
    const r = bootCatalog(catalog, clock, newId)
    if (!r.ok) throw new Error(r.error.message)
    expect(r.value.map((x) => x.challenge.id)).toEqual(['cantilever-beam-1', 'mounting-bracket-1', 'torsion-shaft-1', 'heat-sink-1', 'braced-frame-1', 'vibration-isolation-1', 'pressure-vessel-1', 'fatigue-analysis-1', 'stress-strain-1'])
  })

  it('fails when an available entry has no loadable bundled challenge', () => {
    const r = bootCatalog([{ ...catalog[0]!, available: true, challengeId: 'missing-challenge' }], clock, newId)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.source).toBe('challenge')
  })

  it('fails when no entry is available', () => {
    const r = bootCatalog(catalog.filter((e) => !e.available), clock, newId)
    expect(r).toEqual({ ok: false, error: { source: 'challenge', message: 'No challenge is available.', issues: [] } })
  })
})

describe('ui/App bootstrap', () => {
  it('renders a full-page error listing every loader issue and no controls', () => {
    const bad = structuredClone(cantileverBeam1Json) as Record<string, unknown>
    bad.version = -1
    bad.allowedModes = []
    bad.unexpectedKey = true
    const loaded = loadChallenge(bad)
    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.error.length).toBeGreaterThanOrEqual(3)

    render(<App loaded={loaded} clock={clock} newId={newId} />)

    expect(screen.getByRole('alert')).toBeTruthy()
    const items = within(screen.getByRole('list', { name: 'Challenge problems' })).getAllByRole('listitem')
    expect(items).toHaveLength(loaded.error.length)
    loaded.error.forEach((issue, i) => {
      expect(items[i]?.textContent).toContain(issue.message)
      if (issue.path !== '') expect(items[i]?.textContent).toContain(issue.path)
    })
    // No challenge content, controls, or simulation.
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryByText('Cantilever Beam I')).toBeNull()
    expect(document.querySelector('canvas, svg')).toBeNull()
  })

  it('reports an invalid initial design on the error page', () => {
    if (!bundledChallengeResult.ok) throw new Error('bundled challenge must load')
    const ch = bundledChallengeResult.value
    // Same challenge but the initial design's section kind is no longer allowed.
    const kind = ch.initialDesign.section.kind
    const broken = { ...ch, allowedSections: ch.allowedSections.filter((k) => k !== kind) }
    render(<App loaded={{ ok: true, value: broken }} clock={clock} newId={newId} />)
    expect(screen.getByRole('alert').textContent).toContain('initial design is invalid')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('refuses a challenge whose analysis model is not registered (MM-07)', () => {
    if (!bundledChallengeResult.ok) throw new Error('bundled challenge must load')
    const other = { ...bundledChallengeResult.value, model: { id: 'sdofBaseIsolation', version: 2 } }
    render(<App loaded={{ ok: true, value: other }} clock={clock} newId={newId} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('analysis model that is not available')
    expect(alert.textContent).toContain('Model "sdofBaseIsolation" version 2 is not registered.')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('refuses a registered model whose workbench is not integrated yet', () => {
    if (!bundledChallengeResult.ok) throw new Error('bundled challenge must load')
    const other = { ...bundledChallengeResult.value, model: { id: 'circularShaftTorsion', version: 1 } }
    render(<App loaded={{ ok: true, value: other }} clock={clock} newId={newId} />)
    expect(screen.getByRole('alert').textContent).toContain('Model "circularShaftTorsion" version 1 has no integrated workbench yet.')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('mounts the platform shell when the bundled challenge loads', () => {
    render(<App clock={clock} newId={newId} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getAllByText('Cantilever Beam I').length).toBeGreaterThan(0)
  })
})
