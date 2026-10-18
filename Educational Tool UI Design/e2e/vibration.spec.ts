import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { audit, expectGuidedStep, readState, runAnyTest, tabTo } from './helpers'

// Vibration Isolation I (task 50.3; VIB-14–VIB-16, MM-16, MM-22): chosen before entry from the
// library, full prediction/test loop to an Accepted reference-class mount, saved under its own
// key, isolated from Cantilever Beam I, keyboard-reachable, axe-clean and free of 320 px overflow.
// The whole file is skipped while catalog card 006 is unavailable: activation needs explicit owner
// approval, and this spec becomes the browser gate once it is given.

test.skip(!catalog.find((e) => e.id === '006')?.available, 'Vibration Isolation I awaits owner-approved activation')

async function openVibration(page: Page, mode: 'Guided' | 'Parametric', keyboard: boolean) {
  const view = page.getByRole('button', { name: 'View Vibration Isolation I', exact: true })
  const drawer = page.getByRole('dialog', { name: 'Vibration Isolation I', exact: true })
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
  await expect.poll(async () => (await readState(page)).challengeId).toBe('vibration-isolation-1')
}

/** Reference-class mount: 85 kN/m on neoprene, entered by keyboard or pointer. */
async function setReferenceMount(page: Page, keyboard: boolean) {
  const field = page.getByLabel('Stiffness', { exact: true })
  await field.scrollIntoViewIfNeeded()
  if (keyboard) {
    await tabTo(page, field)
    await field.press('ControlOrMeta+A')
    await field.pressSequentially('85')
    await field.press('Enter')
  } else {
    await field.fill('85')
    await field.press('Enter')
  }
  await expect(field).not.toHaveAttribute('aria-invalid', 'true')
  await expect(field).toHaveValue('85.0')
  const neoprene = page.getByRole('radio', { name: /Neoprene/ })
  // A Guided damping experiment may already have chosen neoprene.
  if (await neoprene.isChecked()) return
  if (keyboard) {
    // Natural rubber (the baseline) is checked; the next radio in the group is Neoprene.
    await tabTo(page, page.getByRole('radio', { name: /Natural rubber/ }))
    await page.keyboard.press('ArrowDown')
  } else {
    await neoprene.check()
  }
  await expect(neoprene).toBeChecked()
}

async function noHorizontalOverflow(page: Page) {
  const original = page.viewportSize()!
  await page.setViewportSize({ width: 320, height: 800 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.setViewportSize(original)
}

for (const mode of ['Guided', 'Parametric'] as const) {
  test(`Vibration Isolation I ${mode}: test an Accepted mount, persist it and keep it isolated`, async ({ page }) => {
    // Guided adds its experiment steps (task 58): three or four more tests before the final one.
    test.setTimeout(mode === 'Guided' ? 150_000 : 90_000) // Keyboard entry, prediction, reload, cross-challenge check and axe.
    const keyboard = mode === 'Guided'
    await page.goto('/#challenges')
    await openVibration(page, mode, keyboard)
    const initial = await readState(page)
    expect(initial.challengeId).toBe('vibration-isolation-1')
    expect(initial.mode).toBe(mode.toLowerCase())
    // Task 56: the goal card at the top of the design view states the goal and the four checks.
    const goal = page.getByRole('region', { name: 'Goal', exact: true })
    await expect(goal.getByText('Choose a mount that passes every check.', { exact: true })).toBeVisible()
    await expect(goal.getByText(/^[0-4] of 4 pass$/)).toBeVisible()
    const requirements = goal.getByRole('list', { name: 'Design requirements' })
    await expect(requirements.getByText('10.1', { exact: true })).toHaveCount(2)
    await expect(page.getByText('Idealized steady-state vibration isolation, not an engineering certification')).toBeVisible()
    await expect(page.getByRole('img', { name: /Steady-state frequency response/ })).toBeVisible()
    // The full response table is collapsed by default (task 56).
    await expect(page.getByRole('table', { name: 'Frequency response values' })).toBeHidden()
    await page.getByText('All response values', { exact: true }).click()
    await expect(page.getByRole('table', { name: 'Frequency response values' }).getByText('30.20 Hz', { exact: true })).toBeVisible()
    const neoprene = page.getByRole('radio', { name: /Neoprene/ })
    if (mode === 'Guided') {
      // Task 58: structured experiments; the material stays locked until its step.
      await expectGuidedStep(page, 'Soften the mount')
      await expect(neoprene).toBeDisabled()
    } else {
      await expect(page.getByRole('region', { name: 'Guided experiments' })).toHaveCount(0)
      await expect(page.getByText(/Every parameter is editable from the start/)).toBeVisible()
      await expect(neoprene).toBeEnabled()
    }
    await audit(page)

    if (mode === 'Guided') {
      const stiffness = page.getByLabel('Stiffness', { exact: true })
      await stiffness.fill('1000')
      await stiffness.press('Enter')
      await runAnyTest(page)
      await expectGuidedStep(page, 'Change the damping')
      await expect(stiffness).toHaveAttribute('readonly', '')
      await neoprene.check()
      await runAnyTest(page)
      await expectGuidedStep(page, 'Meet every check')
    }
    await setReferenceMount(page, keyboard)
    const run = page.getByRole('button', { name: 'Run Test', exact: true })
    if (keyboard) {
      await tabTo(page, run)
      await run.press('Enter')
    } else {
      await run.click()
    }
    const prediction = page.getByRole('dialog', { name: 'Predict transmitted vibration' })
    await expect(prediction).toBeVisible()
    const decrease = prediction.getByLabel('Decrease', { exact: true })
    const confirm = prediction.getByRole('button', { name: 'Run structural test' })
    if (keyboard) {
      await tabTo(page, decrease)
      await decrease.press('Space')
      await tabTo(page, confirm)
      await confirm.press('Enter')
    } else {
      await decrease.check()
      await confirm.click()
    }
    await expect(prediction).toBeHidden()
    // Guided: the final experiment is iteration 3, which is also a prediction checkpoint.
    const tests = mode === 'Guided' ? 4 : 2
    const tested = await readState(page)
    expect(tested.history).toHaveLength(tests)
    expect(tested.history[tests - 1].evaluation.status).toBe('accepted')
    if (mode === 'Guided') await expect(page.getByRole('region', { name: 'Guided experiments' }).getByRole('heading', { name: 'All experiments complete' })).toBeVisible()
    await expect(requirements.getByText('0.0929', { exact: true })).toBeVisible()
    await audit(page)
    await noHorizontalOverflow(page)
    // The original viewport is restored after the narrow-width check.
    await expect(page.getByRole('button', { name: 'Run Test', exact: true })).toBeVisible()

    await page.reload()
    await openVibration(page, mode, false)
    const restored = await readState(page)
    expect(restored.challengeId).toBe('vibration-isolation-1')
    expect(restored.mode).toBe(mode.toLowerCase())
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
