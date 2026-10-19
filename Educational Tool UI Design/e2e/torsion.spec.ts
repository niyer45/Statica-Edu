import { expect, test, type Page } from '@playwright/test'
import { audit, expectGuidedStep, readState, runAnyTest, tabTo } from './helpers'

// Torsion Shaft I (task 47.3; TSH-14–TSH-16, MM-16, MM-22): chosen before entry from the
// library, full prediction/test loop to an Accepted hollow shaft, saved under its own key,
// isolated from Cantilever Beam I, keyboard-reachable, axe-clean and free of 320 px overflow.
// Task 54.2: Guided runs with WebGL and shows the lazy 3D shaft; Parametric runs with WebGL
// disabled and shows the main-bundle SVG fallback with no canvas.

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
    // Guided adds its experiment steps (task 58; two experiments since task 71, D-61) before the final test.
    test.setTimeout(mode === 'Guided' ? 150_000 : 90_000) // Keyboard entry, prediction, reload, cross-challenge check and axe.
    if (mode === 'Parametric') {
      await page.addInitScript(() => { Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: undefined }) })
    }
    await page.goto('/#challenges')
    await openTorsion(page, mode, mode === 'Guided')
    const shaftSvg = page.getByRole('img', { name: /cross-section and side view/ })
    if (mode === 'Guided') {
      // The lazy chunk loads, then software WebGL creates the renderer and names the canvas. Like
      // the beam helpers, scrolling to the named canvas waits for that before asserting it.
      const canvas = page.getByRole('img', { name: '3D shaft view', exact: true })
      await canvas.scrollIntoViewIfNeeded()
      await expect(canvas).toBeVisible()
      await expect(page.locator('canvas')).toHaveCount(1)
      await expect(shaftSvg).toHaveCount(0)
    } else {
      await expect(shaftSvg).toBeVisible()
      await expect(page.locator('canvas')).toHaveCount(0)
    }
    const initial = await readState(page)
    expect(initial.challengeId).toBe('torsion-shaft-1')
    expect(initial.mode).toBe(mode.toLowerCase())
    const requirements = page.getByRole('list', { name: 'Design requirements' })
    // Version 3 baseline (task 71, D-61): a solid shaft that twists too much and is too heavy.
    await expect(requirements.getByText('2.73°', { exact: true })).toBeVisible()
    await expect(requirements.getByText('4.588 kg', { exact: true })).toBeVisible()
    await expect(page.getByText('Idealized circular-shaft torsion, not a structural certification')).toBeVisible()
    const hollow = page.getByRole('button', { name: 'Hollow tube', exact: true })
    if (mode === 'Guided') {
      // Task 58: structured experiments; since task 71 (D-61) step 1 unlocks only the shaft type.
      await expectGuidedStep(page, 'Hollow it out')
      await expect(hollow).not.toHaveAttribute('aria-disabled', 'true')
      await expect(page.getByLabel('Diameter', { exact: true })).toHaveAttribute('readonly', '')
    } else {
      await expect(page.getByRole('region', { name: 'Guided experiments' })).toHaveCount(0)
      await expect(page.getByText(/Every parameter is editable from the start/)).toBeVisible()
      await expect(hollow).not.toHaveAttribute('aria-disabled', 'true')
    }
    await audit(page)

    if (mode === 'Guided') {
      await hollow.click()
      await runAnyTest(page)
      await expectGuidedStep(page, 'Move the material outward')
      await setShaft(page, 'Outer diameter', '45')
      await setShaft(page, 'Inner diameter', '37')
      await runAnyTest(page)
      await expectGuidedStep(page, 'Meet every check')
    }
    await hollow.click()
    await setShaft(page, 'Outer diameter', '50')
    await setShaft(page, 'Inner diameter', '44')
    if (mode === 'Guided') {
      await runAnyTest(page)
      await expect(page.getByRole('region', { name: 'Guided experiments' }).getByRole('heading', { name: 'All experiments complete' })).toBeVisible()
    } else {
      await page.getByRole('button', { name: 'Run Test', exact: true }).click()
      const prediction = page.getByRole('dialog', { name: 'Predict twist' })
      await expect(prediction).toBeVisible()
      await prediction.getByLabel('Decrease', { exact: true }).check()
      await prediction.getByRole('button', { name: 'Run structural test' }).click()
      await expect(prediction).toBeHidden()
    }
    const tests = mode === 'Guided' ? 4 : 2
    const tested = await readState(page)
    expect(tested.history).toHaveLength(tests)
    expect(tested.history[tests - 1].evaluation.status).toBe('accepted')
    await expect(requirements.getByText('0.94°', { exact: true })).toBeVisible()
    await audit(page)
    await noHorizontalOverflow(page)

    await page.reload()
    await openTorsion(page, mode, false)
    const restored = await readState(page)
    expect(restored.challengeId).toBe('torsion-shaft-1')
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
