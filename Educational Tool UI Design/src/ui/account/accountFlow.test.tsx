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

const beamRow = () => screen.getByRole('heading', { level: 3, name: 'Cantilever Beam I' }).closest('li')!
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
    const rows = within(screen.getByRole('list', { name: 'Progress on this device' })).getAllByRole('listitem')
    expect(rows).toHaveLength(6)
    for (const row of rows) expect(within(row).getByText('Not started')).toBeTruthy()
    expect(screen.getByText('0 of 6 challenges completed')).toBeTruthy()
    // Navigation reaches Home again from the sidebar and the mobile select.
    fireEvent.click(screen.getByRole('button', { name: 'Continue as guest' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Challenges' })).toBeTruthy()
    expect(window.location.hash).toBe('#challenges')
    fireEvent.change(screen.getByLabelText('Navigate workspace'), { target: { value: 'Home' } })
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Statica' })).toBeTruthy()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Platform' })).getByRole('button', { name: 'Challenges' }))
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Platform' })).getByRole('button', { name: 'Home' }))
    expect(window.location.hash).toBe('#home')
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
    expect(within(beamRow()).getByText('In progress')).toBeTruthy()

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
    expect(within(beamRow()).getByText('In progress')).toBeTruthy()
    expect(storage.map.has(key)).toBe(false)
    expect(storage.map.has(`ei:user:user-0001:${key.slice(3)}`)).toBe(true)
    expect(screen.getByRole('button', { name: 'Account: Ana' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Account settings' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Your account' })).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    })
    await screen.findByRole('heading', { level: 1, name: 'Welcome to Statica' })
    expect(within(beamRow()).getByText('Not started')).toBeTruthy()

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
    expect(within(beamRow()).getByText('In progress')).toBeTruthy()
  })

  it('deletes the account and its progress after the password is confirmed', async () => {
    const storage = setup()
    await signUp('Ben', 'ben', 'battery staple')
    storage.setItem('ei:user:user-0001:session:torsion-shaft-1:v1', 'x')
    fireEvent.click(screen.getByRole('button', { name: 'Account: Ben' }))
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
