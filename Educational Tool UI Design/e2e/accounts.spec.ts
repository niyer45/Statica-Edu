import { expect, test, type Page } from '@playwright/test'
import { audit, openWorkbench, readState, referenceDesign, runTest } from './helpers'

// Task 38: homepage, browser-local accounts and per-account progress on desktop and Pixel 7.
// Accounts live in this browser only; these cases check that the UI says so, that each
// account's work is namespaced, and that signing out never shows the previous user's work.

const ANA = { name: 'Ana', id: 'ana@example.com', password: 'correct horse battery' }
const BEAM = 'cantilever-beam-1'

async function navigate(page: Page, target: 'Home' | 'Challenges' | 'My designs' | 'Account') {
  // Home is the standalone landing page (task 63): the brand returns to it, Open Statica leaves it.
  if (target === 'Home') return page.getByRole('button', { name: 'Statica home' }).filter({ visible: true }).first().click()
  const open = page.getByRole('button', { name: /^Open Statica/ })
  if (await open.isVisible()) await open.click()
  const sidebar = page.locator('.platform-sidebar')
  if (await sidebar.isVisible()) {
    if (target === 'Account') await sidebar.getByRole('button', { name: /^Account: / }).click()
    else await sidebar.getByRole('navigation', { name: 'Platform' }).getByRole('button', { name: target, exact: true }).click()
  } else await page.getByLabel('Navigate workspace').selectOption(target)
}

// Per-challenge progress lives in My designs (task 62): a card once started, a row otherwise.
const row = (page: Page, title: string) => page.locator('.my-designs').locator('article, li').filter({ has: page.getByRole('heading', { name: title, exact: true }) })

async function expectNoHorizontalOverflow(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 })
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(width)
}

async function signUp(page: Page, moveGuest?: boolean) {
  await page.getByLabel('Display name').fill(ANA.name)
  await page.getByLabel('Email or username').fill(ANA.id)
  await page.getByLabel('Password', { exact: true }).fill(ANA.password)
  await page.getByLabel('Confirm password').fill(ANA.password)
  if (moveGuest !== undefined) await page.getByLabel('Move this guest progress into my new account').setChecked(moveGuest)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: `Welcome back, ${ANA.name}` })).toBeVisible({ timeout: 15_000 })
}

async function storageKeys(page: Page) {
  return page.evaluate(() => Object.keys(window.localStorage).sort())
}

test('the homepage explains Statica, offers account and guest entry, and fits 320 px', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Learn engineering by designing, testing and explaining.' })).toBeVisible()
  await expect(page.getByText('Statica is an interactive engineering education platform.', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'How students learn with Statica' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Challenges available now' }).getByRole('listitem')).toHaveCount(7)
  await expect(page.getByText('Planned', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/progress is saved in this browser on this device only/)).toBeVisible()
  for (const name of ['Create account', 'Sign in', 'Continue as guest']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
  // Task 63: a standalone page with its own header and footer, outside the workspace chrome.
  await expect(page.locator('.platform-sidebar')).toBeHidden()
  await expect(page.locator('.platform-topbar')).toHaveCount(0)
  await expect(page.getByRole('contentinfo')).toBeVisible()
  const sections = page.getByRole('navigation', { name: 'Page sections' }) // hidden below 860 px
  if (await sections.isVisible()) {
    await sections.getByRole('button', { name: 'Roadmap' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Where Statica is going' })).toBeFocused()
  }
  await audit(page)
  await expectNoHorizontalOverflow(page, 320)
  await audit(page)
  await page.getByRole('button', { name: 'Continue as guest', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Challenges' })).toBeVisible()
  await expect(page).toHaveURL(/#challenges$/)
  await navigate(page, 'Home')
  await expect(page.getByRole('heading', { level: 1, name: 'Learn engineering by designing, testing and explaining.' })).toBeVisible()
  // Browser Back returns to the previous shell page.
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Challenges' })).toBeVisible()
  await navigate(page, 'My designs')
  await expect(page.locator('.my-designs .progress-row')).toHaveCount(7)
  await expect(page.locator('.my-designs .progress-row').filter({ hasText: 'Not started' })).toHaveCount(7)
  await expect(page.getByLabel('Progress summary')).toHaveText('0 of 7 challenges completed · 0 started')
  await audit(page)
  await expectNoHorizontalOverflow(page, 320)
})

test('sign-up errors are announced, keyboard operable and fit 320 px', async ({ page }) => {
  await page.goto('/#sign-up')
  await expect(page.getByRole('heading', { level: 1, name: 'Create an account' })).toBeVisible()
  await expect(page.getByText(/There is no cloud sync yet/)).toBeVisible()
  await page.getByLabel('Password', { exact: true }).focus()
  await page.keyboard.type('short')
  await page.keyboard.press('Enter') // submits the form from the keyboard
  await expect(page.getByRole('alert')).toHaveText('Check the form: 3 fields need attention.')
  const name = page.getByLabel('Display name')
  await expect(name).toBeFocused()
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  await expect(name).toHaveAccessibleDescription('Error: Enter a display name.')
  await expect(page.getByLabel('Password', { exact: true })).toHaveAccessibleDescription(/At least 8 characters\. Error: Use at least 8 characters\./)
  await audit(page)
  await expectNoHorizontalOverflow(page, 320)
  await audit(page)
})

test('sign up, work, sign out, guest sees none of it, sign in restores it', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await signUp(page)
  await expect(page.getByRole('status')).toContainText(`Signed in as ${ANA.name}.`)
  await expect(page.getByText(/they do not sync to other devices or browsers yet/)).toBeVisible()
  await audit(page)

  const session = JSON.parse((await page.evaluate(() => window.localStorage.getItem('ei:account-session:v1')))!) as { userId: string }
  const userKey = `ei:user:${session.userId}:session:${BEAM}:v3` // content version 3 since the D-47 amendment
  // The password is never stored in plain text.
  const stored = await page.evaluate(() => Object.values(window.localStorage).join('\n'))
  expect(stored).not.toContain(ANA.password)

  await page.getByRole('button', { name: 'Browse challenges' }).click()
  await openWorkbench(page, false, false, 'Parametric') // free editing (Guided locks by step, task 58)
  await referenceDesign(page)
  await runTest(page)
  const work = await readState(page)
  expect(work.history).toHaveLength(2)
  const keys = await storageKeys(page)
  expect(keys).toContain(userKey)
  expect(keys.filter((k) => k.startsWith('ei:session:'))).toEqual([]) // nothing written as guest

  await navigate(page, 'My designs')
  await expect(row(page, 'Cantilever Beam I')).toContainText('In progress')
  await expect(row(page, 'Cantilever Beam I')).toContainText('1 test run')
  await audit(page)

  await navigate(page, 'Account')
  await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible()
  await audit(page)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Learn engineering by designing, testing and explaining.' })).toBeVisible()
  await navigate(page, 'My designs')
  await expect(row(page, 'Cantilever Beam I')).toContainText('Not started')
  await navigate(page, 'Home')
  await page.getByRole('button', { name: 'Continue as guest', exact: true }).click()
  await openWorkbench(page, false)
  const guest = await readState(page)
  expect(guest.history).toHaveLength(1)
  expect(guest.draft).not.toEqual(work.draft)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Challenges' })).toBeVisible()
  await navigate(page, 'My designs')
  await expect(row(page, 'Cantilever Beam I')).toContainText('Not started')

  await navigate(page, 'Home')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email or username').fill(ANA.id)
  await page.getByLabel('Password', { exact: true }).fill('not the password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('do not match an account on this device', { timeout: 15_000 })
  await page.getByLabel('Password', { exact: true }).fill(ANA.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: `Welcome back, ${ANA.name}` })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('You have 1 challenge started on this device.')).toBeVisible()
  await page.getByRole('button', { name: 'Open My designs', exact: true }).click()
  await expect(row(page, 'Cantilever Beam I')).toContainText('In progress')
  await row(page, 'Cantilever Beam I').getByRole('button').click()
  await expect(page.getByRole('button', { name: 'Run Test', exact: true })).toBeVisible()
  const restored = await readState(page)
  expect({ draft: restored.draft, history: restored.history }).toEqual({ draft: work.draft, history: work.history })

  // A reload keeps the session on this device.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'My designs' })).toBeVisible()
  await navigate(page, 'Home')
  await expect(page.getByRole('heading', { level: 1, name: `Welcome back, ${ANA.name}` })).toBeVisible()
})

test('guest work can move into a new account, and deleting the account removes it', async ({ page }) => {
  test.setTimeout(120_000)
  await openWorkbench(page)
  await referenceDesign(page)
  await runTest(page)
  const work = await readState(page)
  expect(await storageKeys(page)).toContain(`ei:session:${BEAM}:v3`)

  await navigate(page, 'My designs')
  await expect(row(page, 'Cantilever Beam I')).toContainText('In progress')
  await navigate(page, 'Home')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  const preview = page.getByRole('group', { name: 'Guest progress on this device' })
  await expect(preview.getByRole('listitem')).toHaveText(['Cantilever Beam I'])
  await audit(page)
  await signUp(page, true)
  await expect(page.getByRole('status')).toContainText('Guest progress for 1 challenge moved into your account.')
  await navigate(page, 'My designs')
  await expect(row(page, 'Cantilever Beam I')).toContainText('In progress')
  const keys = await storageKeys(page)
  expect(keys.filter((k) => k.startsWith('ei:session:'))).toEqual([])
  expect(keys.some((k) => /^ei:user:[^:]+:session:cantilever-beam-1:v3$/.test(k))).toBe(true)
  await row(page, 'Cantilever Beam I').getByRole('button').click()
  expect((await readState(page)).history).toEqual(work.history)

  await navigate(page, 'Account')
  await page.getByLabel('Password to confirm deletion').fill(ANA.password)
  await page.getByRole('button', { name: 'Delete account and progress' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Learn engineering by designing, testing and explaining.' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('status')).toContainText('Account deleted')
  const after = await storageKeys(page)
  expect(after.filter((k) => k.startsWith('ei:user:') || k === 'ei:account-session:v1')).toEqual([])
  expect(JSON.parse((await page.evaluate(() => window.localStorage.getItem('ei:accounts:v1')))!).accounts).toEqual([])
  await navigate(page, 'My designs')
  await expect(row(page, 'Cantilever Beam I')).toContainText('Not started')
})
