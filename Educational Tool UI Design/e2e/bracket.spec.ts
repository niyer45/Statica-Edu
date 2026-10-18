import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { audit, readState, tabTo } from './helpers'

// Mounting Bracket I (tasks 46.3, 55; MM-16, MM-22): the bolted L-bracket, chosen before entry
// from the library, full prediction/test loop from a baseline that fails all four checks to the
// Accepted internal reference, saved under its own version-2 key, isolated from Cantilever Beam I,
// keyboard-reachable, axe-clean and free of 320 px overflow, on desktop and Pixel 7.

test.skip(!catalog.find((e) => e.id === '002')?.available, 'Mounting Bracket I awaits owner-approved activation')

async function openBracket(page: Page, mode: 'Guided' | 'Parametric', keyboard: boolean) {
  const view = page.getByRole('button', { name: 'View Mounting Bracket I', exact: true })
  const drawer = page.getByRole('dialog', { name: 'Mounting Bracket I', exact: true })
  if (keyboard) {
    await tabTo(page, view)
    await page.keyboard.press('Enter')
    await tabTo(page, drawer.getByRole('button', { name: new RegExp(`^${mode}`) }))
    await page.keyboard.press('Enter')
    await tabTo(page, drawer.getByRole('button', { name: 'Open challenge', exact: true }))
    await page.keyboard.press('Enter')
  } else {
    await view.click()
    await drawer.getByRole('button', { name: new RegExp(`^${mode}`) }).click()
    await drawer.getByRole('button', { name: 'Open challenge', exact: true }).click()
  }
  await expect(page.getByRole('button', { name: 'Run Test', exact: true })).toBeVisible()
  // The dev snapshot follows the newly mounted store after the switch; wait for it.
  await expect.poll(async () => (await readState(page)).challengeId).toBe('mounting-bracket-1')
}

async function setDimension(page: Page, label: string, value: string, keyboard: boolean) {
  const field = page.getByLabel(label, { exact: true })
  await field.scrollIntoViewIfNeeded()
  if (keyboard) {
    await tabTo(page, field)
    await field.press('ControlOrMeta+A')
    await field.pressSequentially(value)
  } else {
    await field.fill(value)
  }
  await field.press('Enter')
  await expect(field).not.toHaveAttribute('aria-invalid', 'true')
}

async function noHorizontalOverflow(page: Page) {
  const original = page.viewportSize()!
  await page.setViewportSize({ width: 320, height: 800 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.setViewportSize(original)
}

for (const mode of ['Guided', 'Parametric'] as const) {
  test(`Mounting Bracket I ${mode}: test an Accepted bracket, persist it and keep it isolated`, async ({ page }) => {
    test.setTimeout(90_000) // Keyboard entry, prediction, reload, cross-challenge check and axe.
    const keyboard = mode === 'Guided'
    // Task 54.1: Guided exercises the 3D scene; Parametric hides WebGL2 to exercise the 2D fallback.
    if (mode === 'Parametric') {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: undefined })
      })
    }
    await page.goto('/#challenges')
    await openBracket(page, mode, keyboard)
    const initial = await readState(page)
    expect(initial.challengeId).toBe('mounting-bracket-1')
    expect(initial.mode).toBe(mode.toLowerCase())
    const requirements = page.getByRole('list', { name: 'Design requirements' })
    // The baseline fails bend stress, deflection, bolt tension and mass.
    await expect(requirements.getByText('231.0 MPa', { exact: true })).toBeVisible()
    await expect(requirements.getByText('8.04 mm', { exact: true })).toBeVisible()
    await expect(requirements.getByText('333 N', { exact: true })).toBeVisible()
    await expect(requirements.getByText('180.7 g', { exact: true })).toBeVisible()
    await expect(requirements.getByText('✗ Fail')).toHaveCount(4)
    if (mode === 'Guided') {
      // Lazy chunk plus software WebGL can exceed the default 5 s when workers run in parallel.
      await expect(page.getByRole('img', { name: /^3D view of the L-bracket/ })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('img', { name: /^Side view of the L-bracket/ })).toHaveCount(0)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    } else {
      await expect(page.getByRole('img', { name: /^Side view of the L-bracket/ })).toBeVisible()
      await expect(page.getByText('3D view is unavailable. Showing the 2D side view of the bracket instead.').first()).toBeVisible()
      await expect(page.locator('canvas')).toHaveCount(0)
    }
    await expect(page.getByRole('img', { name: /^Bending-moment path of the latest tested design/ })).toBeVisible()
    await expect(page.getByText(/Idealized bolted L-bracket: statics, Winkler–Bach curved-beam bend stress/)).toBeVisible()
    if (mode === 'Guided') {
      await expect(page.getByRole('region', { name: 'Guided instructions' }).getByRole('heading', { name: 'Inspect', exact: true })).toBeVisible()
    } else {
      await expect(page.getByRole('region', { name: 'Guided instructions' })).toHaveCount(0)
      await expect(page.getByText('Direct thickness, width, flange and bend radius editing')).toBeVisible()
    }
    await audit(page)

    // The internal reference (t 7, w 40, flange 80, r 6 mm): every dimension changes.
    await setDimension(page, 'Thickness', '7', keyboard)
    await setDimension(page, 'Width', '40', keyboard)
    await setDimension(page, 'Flange height', '80', keyboard)
    await setDimension(page, 'Inner bend radius', '6', keyboard)
    await page.getByRole('button', { name: 'Run Test', exact: true }).click()
    const prediction = page.getByRole('dialog', { name: 'Predict bend stress' })
    await expect(prediction).toBeVisible()
    await prediction.getByLabel('Decrease', { exact: true }).check()
    await prediction.getByRole('button', { name: 'Run structural test' }).click()
    await expect(prediction).toBeHidden()
    const tested = await readState(page)
    expect(tested.history).toHaveLength(2)
    expect(tested.history[1].evaluation.status).toBe('accepted')
    await expect(requirements.getByText('97.7 MPa', { exact: true })).toBeVisible()
    await expect(requirements.getByText('✗ Fail')).toHaveCount(0)
    const keys = await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('ei:session:mounting-bracket-1')))
    expect(keys).toEqual(['ei:session:mounting-bracket-1:v2'])
    await audit(page)
    await noHorizontalOverflow(page)

    await page.reload()
    await openBracket(page, mode, false)
    const restored = await readState(page)
    expect(restored.challengeId).toBe('mounting-bracket-1')
    expect(restored.history).toHaveLength(2)
    expect(restored.history[1].evaluation.status).toBe('accepted')

    // Back to the library: sidebar navigation on desktop, the workspace menu on narrow screens.
    const library = page.locator('.platform-sidebar').getByRole('button', { name: 'Challenges' })
    if (await library.isVisible()) await library.click()
    else await page.getByLabel('Navigate workspace').selectOption('Challenges')
    await page.getByRole('button', { name: 'View Cantilever Beam I', exact: true }).click()
    await page.getByRole('dialog', { name: 'Cantilever Beam I', exact: true }).getByRole('button', { name: 'Open challenge', exact: true }).click()
    await expect.poll(async () => (await readState(page)).challengeId).toBe('cantilever-beam-1')
    const beam = await readState(page)
    expect(beam.challengeId).toBe('cantilever-beam-1')
    expect(beam.history).toHaveLength(1)
  })
}
