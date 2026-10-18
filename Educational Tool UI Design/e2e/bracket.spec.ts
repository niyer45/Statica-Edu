import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { audit, expectGuidedStep, readState, runAnyTest, tabTo } from './helpers'

// Mounting Bracket I (task 46.3; MBR-18–MBR-20, MM-16, MM-22): chosen before entry from the
// library, full prediction/test loop to the Accepted spec reference, saved under its own key,
// isolated from Cantilever Beam I, keyboard-reachable, axe-clean and free of 320 px overflow.
// The whole file is skipped until catalog card 002 is activated with owner approval; it then
// runs unchanged on desktop and Pixel 7.

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
    await page.goto('/')
    await openBracket(page, mode, keyboard)
    const initial = await readState(page)
    expect(initial.challengeId).toBe('mounting-bracket-1')
    expect(initial.mode).toBe(mode.toLowerCase())
    const requirements = page.getByRole('list', { name: 'Design requirements' })
    await expect(requirements.getByText('157.9 MPa', { exact: true })).toBeVisible()
    if (mode === 'Guided') {
      // Lazy chunk plus software WebGL can exceed the default 5 s when workers run in parallel.
      await expect(page.getByRole('img', { name: /^3D view of the wall-mounted bracket/ })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('img', { name: /^Side view of the wall-mounted bracket/ })).toHaveCount(0)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    } else {
      await expect(page.getByRole('img', { name: /^Side view of the wall-mounted bracket/ })).toBeVisible()
      await expect(page.getByText('3D view is unavailable. Showing the 2D side view of the bracket instead.').first()).toBeVisible()
      await expect(page.locator('canvas')).toHaveCount(0)
    }
    await expect(page.getByRole('img', { name: /^Bending-moment strip of the latest tested design/ })).toBeVisible()
    await expect(page.getByText(/fillet Kt coefficients from secondary copies, pending printed-edition verification/)).toBeVisible()
    const rootDepth = page.getByLabel('Root depth', { exact: true })
    if (mode === 'Guided') {
      // Task 58: structured experiments; only the first step's dimension is editable.
      await expectGuidedStep(page, 'Round the corner')
      await expect(rootDepth).toHaveAttribute('readonly', '')
    } else {
      await expect(page.getByRole('region', { name: 'Guided experiments' })).toHaveCount(0)
      await expect(page.getByText(/Every parameter is editable from the start/)).toBeVisible()
      await expect(rootDepth).not.toHaveAttribute('readonly', '')
    }
    await audit(page)

    // The internal spec reference (30/20/175/3 mm): only the step location and fillet change.
    if (mode === 'Guided') {
      await setDimension(page, 'Fillet radius', '3', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Arm depth')
      await setDimension(page, 'Arm depth', '21', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Move the step')
      await setDimension(page, 'Step location', '175', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Meet every check')
      await setDimension(page, 'Arm depth', '20', keyboard)
      await runAnyTest(page, keyboard)
      await expect(page.getByRole('region', { name: 'Guided experiments' }).getByRole('heading', { name: 'All experiments complete' })).toBeVisible()
    } else {
      await setDimension(page, 'Step location', '175', keyboard)
      await setDimension(page, 'Fillet radius', '3', keyboard)
      await page.getByRole('button', { name: 'Run Test', exact: true }).click()
      const prediction = page.getByRole('dialog', { name: 'Predict peak stress' })
      await expect(prediction).toBeVisible()
      await prediction.getByLabel('Decrease', { exact: true }).check()
      await prediction.getByRole('button', { name: 'Run structural test' }).click()
      await expect(prediction).toBeHidden()
    }
    const tests = mode === 'Guided' ? 5 : 2
    const tested = await readState(page)
    expect(tested.history).toHaveLength(tests)
    expect(tested.history[tests - 1].evaluation.status).toBe('accepted')
    await expect(requirements.getByText('90.8 MPa', { exact: true })).toBeVisible()
    await audit(page)
    await noHorizontalOverflow(page)

    await page.reload()
    await openBracket(page, mode, false)
    const restored = await readState(page)
    expect(restored.challengeId).toBe('mounting-bracket-1')
    expect(restored.history).toHaveLength(tests)
    expect(restored.history[tests - 1].evaluation.status).toBe('accepted')

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
