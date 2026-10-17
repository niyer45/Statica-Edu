import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bundledChallengeResult, cantileverBeam1Json } from '../challenge/content'
import { loadChallenge } from '../challenge/loader'
import App from './App'

// Task 13.2: bootstrap and full-page error (Req 3.3).

const clock = () => '2025-01-01T00:00:00.000Z'
const newId = () => 'baseline-id'

afterEach(cleanup)

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
    const other = { ...bundledChallengeResult.value, model: { id: 'circularShaftTorsion', version: 1 } }
    render(<App loaded={{ ok: true, value: other }} clock={clock} newId={newId} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('analysis model that is not available')
    expect(alert.textContent).toContain('Model "circularShaftTorsion" version 1 is not registered.')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('mounts the platform shell when the bundled challenge loads', () => {
    render(<App clock={clock} newId={newId} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getAllByText('Cantilever Beam I').length).toBeGreaterThan(0)
  })
})
