import { webcrypto } from 'node:crypto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLocalAccountProvider } from '../../account/localProvider'
import type { CryptoLike } from '../../account/password'
import type { KeyValueStorage } from '../../account/types'
import { bundledChallengeResult } from '../../challenge/content'
import { serializeSession, sessionKey } from '../../state/persistence'
import { sessionReducer } from '../../state/reducer'
import { initSession } from '../../state/session'
import App from '../App'
import { hashFor, routeFromHash } from '../shell/routes'

// Task 38: homepage, account forms and per-account progress through the real App, with the
// browser-local provider over in-memory storage.

const clock = () => '2026-10-18T00:00:00.000Z'
const newId = () => 'baseline-id'

function memory(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k), keys: () => [...map.keys()] }
}

function setup(storage = memory()) {
  let n = 0
  const accounts = createLocalAccountProvider({ storage, crypto: webcrypto as unknown as CryptoLike, clock, newId: () => `user-000${++n}`, iterations: 1000 })
  render(<App clock={clock} newId={newId} accounts={accounts} />)
  return storage
}

function startedBeamSession(): [string, string] {
  if (!bundledChallengeResult.ok) throw new Error('bundled challenge must load')
  const ch = bundledChallengeResult.value
  const init = initSession(ch, clock(), 'b0')
  if (!init.ok) throw new Error('init')
  return [sessionKey(ch), serializeSession(sessionReducer(init.value, { type: 'setReflection', text: 'guest idea' }, ch))]
}

/** Home is the standalone landing page (task 63), reached from the brand; the rest via the page select. */
const goTo = (page: string) =>
  page === 'Home'
    ? fireEvent.click(screen.getAllByRole('button', { name: 'Statica home' })[0]!)
    : fireEvent.change(screen.getByLabelText('Navigate workspace'), { target: { value: page } })
/** Cantilever Beam I's progress text in My designs (task 62), then back to Home. */
function beamStatus(): string {
  goTo('My designs')
  const designs = screen.getByRole('heading', { level: 1, name: 'My designs' }).closest('.my-designs')!
  const text = within(designs as HTMLElement).getByRole('heading', { name: 'Cantilever Beam I' }).closest('article, li')!.textContent!
  goTo('Home')
  return text
}
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

async function signUp(name: string, id: string, password: string) {
  if (screen.queryByRole('heading', { level: 1, name: 'Create an account' }) === null) fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  fill('Display name', name)
  fill('Email or username', id)
  fill('Password', password)
  fill('Confirm password', password)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  })
  await screen.findByRole('heading', { level: 1, name: `Welcome back, ${name}` })
}

beforeEach(() => window.history.replaceState(null, '', '/'))
afterEach(cleanup)

describe('routes', () => {
  it('maps fragments to pages and defaults to Home', () => {
    expect(routeFromHash('')).toEqual({ page: 'Home', view: 'sign-up' })
    expect(routeFromHash('#challenges').page).toBe('Challenges')
    expect(routeFromHash('#/my-designs').page).toBe('My designs')
    expect(routeFromHash('#sign-in')).toEqual({ page: 'Account', view: 'sign-in' })
    expect(routeFromHash('#nonsense').page).toBe('Home')
    expect(hashFor('Learning paths')).toBe('#learning-paths')
    expect(hashFor('Account', 'sign-in')).toBe('#sign-in')
  })
})

describe('homepage and accounts', () => {
  it('starts on Home with guest actions, an on-device storage statement and six challenges', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Statica' })).toBeTruthy()
    for (const name of ['Create account', 'Sign in', 'Continue as guest']) expect(screen.getByRole('button', { name })).toBeTruthy()
    expect(screen.getByText(/saved in this browser on this device only/)).toBeTruthy()
    // Task 62: Home is the outlook page; per-challenge progress lives in My designs.
    expect(screen.getByRole('heading', { level: 2, name: 'How students learn with Statica' })).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Challenges available now' })).getAllByRole('listitem')).toHaveLength(6)
    expect(screen.queryByRole('list', { name: 'Progress on this device' })).toBeNull()
    goTo('My designs')
    expect(screen.getByLabelText('Progress summary').textContent).toBe('0 of 6 challenges completed · 0 started')
    const rows = within(screen.getByRole('list', { name: 'Not started yet' })).getAllByRole('listitem')
    expect(rows).toHaveLength(6)
    for (const row of rows) expect(within(row).getByText('Not started')).toBeTruthy()
    goTo('Home')
    // Task 63: Home is a standalone page: its own header and footer, no workspace sidebar or top bar,
    // and no Home entry in the workspace navigation; the brand returns to it.
    expect(screen.getByRole('navigation', { name: 'Page sections' })).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
    expect(document.querySelector('.platform-sidebar')!.hasAttribute('hidden')).toBe(true)
    expect(document.querySelector('.platform-topbar')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Continue as guest' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Challenges' })).toBeTruthy()
    expect(window.location.hash).toBe('#challenges')
    expect(within(screen.getByRole('navigation', { name: 'Platform' })).queryByRole('button', { name: 'Home' })).toBeNull()
    expect([...(screen.getByLabelText('Navigate workspace') as HTMLSelectElement).options].map((o) => o.value)).not.toContain('Home')
    goTo('Home')
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Statica' })).toBeTruthy()
    expect(window.location.hash).toBe('#home')
    fireEvent.click(screen.getByRole('button', { name: /^Open Statica/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Challenges' })).toBeTruthy()
  })

  it('reports invalid sign-up fields accessibly and focuses the first one', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Create an account' })).toBeTruthy()
    expect(screen.getByText(/There is no cloud sync yet/)).toBeTruthy()
    fill('Password', 'longenough')
    fill('Confirm password', 'different!')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    })
    expect(screen.getByRole('alert').textContent).toBe('Check the form: 3 fields need attention.')
    const name = screen.getByLabelText('Display name')
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(name)
    expect(screen.getByLabelText('Confirm password').getAttribute('aria-invalid')).toBe('true')
    const describedBy = name.getAttribute('aria-describedby')!
    expect(document.getElementById(describedBy)!.textContent).toBe('Enter a display name.')
  })

  it('keeps progress per account: guest work moves on sign-up, sign-out shows a fresh guest, sign-in restores it', async () => {
    const storage = memory()
    const [key, value] = startedBeamSession()
    storage.setItem(key, value)
    setup(storage)
    expect(beamStatus()).toContain('In progress')

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    const migrate = screen.getByRole('group', { name: 'Guest progress on this device' })
    expect(within(migrate).getByText('Cantilever Beam I')).toBeTruthy()
    expect((within(migrate).getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    // The two forms switch in place; the guest preview is still offered after switching back.
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy()
    expect(window.location.hash).toBe('#sign-in')
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(screen.getByRole('group', { name: 'Guest progress on this device' })).toBeTruthy()
    await signUp('Ana', 'ana@example.com', 'correct horse')

    expect(screen.getByRole('status').textContent).toContain('Guest progress for 1 challenge moved into your account.')
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
    expect(window.location.hash).toBe('#home')
    expect(beamStatus()).toContain('In progress')
    expect(storage.map.has(key)).toBe(false)
    expect(storage.map.has(`ei:user:user-0001:${key.slice(3)}`)).toBe(true)
    goTo('Challenges') // the workspace sidebar names the signed-in account (Home has no sidebar)
    expect(screen.getByRole('button', { name: 'Account: Ana' })).toBeTruthy()
    goTo('Home')

    fireEvent.click(screen.getByRole('button', { name: 'Account settings' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Your account' })).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    })
    await screen.findByRole('heading', { level: 1, name: 'Welcome to Statica' })
    expect(beamStatus()).toContain('Not started')

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    fill('Email or username', 'ANA@example.com')
    fill('Password', 'wrong password')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    })
    expect((await screen.findByRole('alert')).textContent).toMatch(/do not match an account on this device/)
    expect(document.activeElement).toBe(screen.getByLabelText('Password'))
    fill('Password', 'correct horse')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    })
    await screen.findByRole('heading', { level: 1, name: 'Welcome back, Ana' })
    expect(beamStatus()).toContain('In progress')
    // Many full-App page renders (Home and My designs draw every challenge's illustration).
  }, 20_000)

  it('deletes the account and its progress after the password is confirmed', async () => {
    const storage = setup()
    await signUp('Ben', 'ben', 'battery staple')
    storage.setItem('ei:user:user-0001:session:torsion-shaft-1:v1', 'x')
    fireEvent.click(screen.getByRole('button', { name: 'Account settings' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete account and progress' }))
    })
    expect(screen.getByRole('alert').textContent).toBe('Enter your password to confirm deletion.')
    fill('Password to confirm deletion', 'battery staple')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete account and progress' }))
    })
    await screen.findByRole('heading', { level: 1, name: 'Welcome to Statica' })
    expect(screen.getByRole('status').textContent).toContain('Account deleted')
    expect([...storage.map.keys()].filter((k) => k.startsWith('ei:user:'))).toEqual([])
  })
})
