import { expect, test, type Page } from '@playwright/test'
import { audit, readState, tabTo } from './helpers'

// Torsion Shaft I (task 47.3; TSH-14–TSH-16, MM-16, MM-22): chosen before entry from the
// library, full prediction/test loop to an Accepted hollow shaft, saved under its own key,
// isolated from Cantilever Beam I, keyboard-reachable, axe-clean and free of 320 px overflow.

async function openTorsion(page: Page, mode: 'Guided' | 'Parametric', keyboard: boolean) {
  const view = page.getByRole('button', { name: 'View Torsion Shaft I', exact: true })
  const drawer = page.getByRole('dialog', { name: 'Torsion Shaft I', exact: true })
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
  await expect.poll(async () => (await readState(page)).challengeId).toBe('torsion-shaft-1')
}

async function setShaft(page: Page, label: string, value: string) {
  const field = page.getByLabel(label, { exact: true })
  await field.scrollIntoViewIfNeeded()
  await field.fill(value)
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
  test(`Torsion Shaft I ${mode}: test an Accepted hollow shaft, persist it and keep it isolated`, async ({ page }) => {
    test.setTimeout(90_000) // Keyboard entry, prediction, reload, cross-challenge check and axe.
    await page.goto('/')
    await openTorsion(page, mode, mode === 'Guided')
    const initial = await readState(page)
    expect(initial.challengeId).toBe('torsion-shaft-1')
    expect(initial.mode).toBe(mode.toLowerCase())
    const requirements = page.getByRole('list', { name: 'Design requirements' })
    await expect(requirements.getByText('2.92°', { exact: true })).toBeVisible()
    await expect(page.getByText('Idealized circular-shaft torsion, not a structural certification')).toBeVisible()
    if (mode === 'Guided') {
      await expect(page.getByRole('region', { name: 'Guided instructions' }).getByRole('heading', { name: 'Inspect', exact: true })).toBeVisible()
    } else {
      await expect(page.getByRole('region', { name: 'Guided instructions' })).toHaveCount(0)
      await expect(page.getByText('Direct shaft diameter editing')).toBeVisible()
    }
    await audit(page)

    await page.getByRole('button', { name: /Hollow tube/ }).click()
    await setShaft(page, 'Outer diameter', '50')
    await setShaft(page, 'Inner diameter', '44')
    await page.getByRole('button', { name: 'Run Test', exact: true }).click()
    const prediction = page.getByRole('dialog', { name: 'Predict twist' })
    await expect(prediction).toBeVisible()
    await prediction.getByLabel('Decrease', { exact: true }).check()
    await prediction.getByRole('button', { name: 'Run structural test' }).click()
    await expect(prediction).toBeHidden()
    const tested = await readState(page)
    expect(tested.history).toHaveLength(2)
    expect(tested.history[1].evaluation.status).toBe('accepted')
    await expect(requirements.getByText('0.94°', { exact: true })).toBeVisible()
    await audit(page)
    await noHorizontalOverflow(page)

    await page.reload()
    await openTorsion(page, mode, false)
    const restored = await readState(page)
    expect(restored.challengeId).toBe('torsion-shaft-1')
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
