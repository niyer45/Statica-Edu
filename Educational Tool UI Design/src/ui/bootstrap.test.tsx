import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { cantileverBeam1Json } from '../challenge/content'
import { loadChallenge } from '../challenge/loader'
import type { SchemaIssue } from '../challenge/types'
import App, { BootErrorPage } from './App'
import { bootstrap } from './state/bootstrap'

// Task 13.4: bootstrap component tests (Req 3.3). Extends the smoke tests in App.test.tsx:
// every issue is listed without truncation, issue text is complete, and nothing from the
// Workbench (controls, stepper, footer, viewport, live region) renders on failure.

const clock = () => '2025-01-01T00:00:00.000Z'
const newId = () => 'baseline-id'

afterEach(cleanup)

function issueItems() {
  return within(screen.getByRole('list', { name: 'Challenge problems' })).getAllByRole('listitem')
}

function expectNoChallengeUi() {
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
  expect(screen.queryAllByRole('radio')).toHaveLength(0)
  expect(screen.queryByRole('list', { name: 'Workflow' })).toBeNull()
  expect(document.querySelector('.workbench, .design-panel, .viewport, .page-footer, canvas, svg')).toBeNull()
  expect(document.querySelector('[aria-live]')).toBeNull()
  expect(document.querySelector('.platform')).toBeNull()
  expect(document.body.textContent).not.toContain('Cantilever Beam I')
}

describe('bootstrap error page', () => {
  it('lists every one of many issues with path, rule, and message, untruncated', () => {
    const issues: SchemaIssue[] = Array.from({ length: 40 }, (_, i) => ({
      path: `constraints.${i}.limit`,
      rule: 'positive',
      message: `Limit ${i} must be greater than zero.`,
    }))
    const boot = bootstrap({ ok: false, error: issues }, clock, newId)
    expect(boot.ok).toBe(false)
    if (boot.ok) return
    expect(boot.error.message).toContain('40 issues')

    render(<BootErrorPage failure={boot.error} />)
    const items = issueItems()
    expect(items).toHaveLength(40)
    issues.forEach((issue, i) => {
      const text = items[i]?.textContent ?? ''
      expect(text).toContain(issue.path)
      expect(text).toContain(issue.rule)
      expect(text).toContain(issue.message)
    })
    expectNoChallengeUi()
  })

  it('uses the singular count and omits empty path/rule decorations', () => {
    const boot = bootstrap({ ok: false, error: [{ path: '', rule: '', message: 'Not an object.' }] }, clock, newId)
    if (boot.ok) throw new Error('expected failure')
    expect(boot.error.message).toContain('(1 issue)')
    render(<BootErrorPage failure={boot.error} />)
    const items = issueItems()
    expect(items).toHaveLength(1)
    expect(items[0]?.textContent).toBe('Not an object.')
    expect(items[0]?.querySelector('code')).toBeNull()
  })

  it('renders only the error page for an invalid bundled challenge, with no Workbench UI', () => {
    const bad = structuredClone(cantileverBeam1Json) as Record<string, unknown>
    delete bad.title
    bad.allowedSections = ['triangle']
    const loaded = loadChallenge(bad)
    if (loaded.ok) throw new Error('expected loader failure')

    render(<App loaded={loaded} clock={clock} newId={newId} />)
    const alert = screen.getByRole('alert')
    expect(within(alert).getByRole('heading', { level: 1 }).textContent).toContain('could not load')
    expect(issueItems()).toHaveLength(loaded.error.length)
    expectNoChallengeUi()
    expect(window.__EI_STATE__).toBeUndefined()
  })

  it('mounts the shell (not the error page) when the challenge loads', () => {
    render(<App loaded={loadChallenge(structuredClone(cantileverBeam1Json))} clock={clock} newId={newId} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Statica home' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 1, name: 'Challenges' })).toBeTruthy()
  })
})
