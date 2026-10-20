import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { audit, expectGuidedStep, readState, runAnyTest, tabTo } from './helpers'

// Fatigue Analysis I (task 70, D-60): the stepped stub-axle spindle, chosen before entry from the
// library, the full prediction/test loop from a Baseline that fails fatigue, yield and mass to the
// Accepted internal reference, saved under its own key in the v2 envelope, isolated from
// Cantilever Beam I, keyboard-reachable, axe-clean and free of 320 px overflow, on desktop and
// Pixel 7. Guided exercises the lazy 3D scene and keyboard entry; Parametric hides WebGL2 to
// exercise the 2D fallback.

test.skip(!catalog.find((e) => e.id === '010')?.available, 'Fatigue Analysis I is not available')

async function openFatigue(page: Page, mode: 'Guided' | 'Parametric', keyboard: boolean) {
  const view = page.getByRole('button', { name: 'View Fatigue Analysis I', exact: true })
  const drawer = page.getByRole('dialog', { name: 'Fatigue Analysis I', exact: true })
  if (keyboard) {
    await tabTo(page, view)
    await page.keyboard.press('Enter')
    await tabTo(page, drawer.getByRole('button', { name: new RegExp(`^${mode}`) }))
    await page.keyboard.press('Enter')
    await tabTo(page, drawer.getByRole('button', { name: /^(Open|Continue) challenge$/ }))
    await page.keyboard.press('Enter')
  } else {
    await view.click()
    await drawer.getByRole('button', { name: new RegExp(`^${mode}`) }).click()
    await drawer.getByRole('button', { name: /^(Open|Continue) challenge$/ }).click()
  }
  await expect(page.getByRole('button', { name: 'Run Test', exact: true })).toBeVisible()
  await expect.poll(async () => (await readState(page)).challengeId).toBe('fatigue-analysis-1')
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

/** Selects the machined finish: by click, or by keyboard from the checked as-forged radio (arrow keys move within a radio group). */
async function chooseMachined(page: Page, keyboard: boolean) {
  const machined = page.getByRole('radio', { name: 'Machined', exact: true })
  if (keyboard) {
    await tabTo(page, page.getByRole('radio', { name: 'As-forged', exact: true }))
    await page.keyboard.press('ArrowUp')
  } else {
    await machined.check()
  }
  await expect(machined).toBeChecked()
}

async function noHorizontalOverflow(page: Page) {
  const original = page.viewportSize()!
  await page.setViewportSize({ width: 320, height: 800 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.setViewportSize(original)
}

for (const mode of ['Guided', 'Parametric'] as const) {
  test(`Fatigue Analysis I ${mode}: test an Accepted spindle, persist it and keep it isolated`, async ({ page }) => {
    test.setTimeout(mode === 'Guided' ? 150_000 : 90_000)
    const keyboard = mode === 'Guided'
    if (mode === 'Parametric') {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: undefined })
      })
    }
    await page.goto('/#challenges')
    await expect(page.getByRole('button', { name: 'View Fatigue Analysis I', exact: true })).toBeVisible()
    await openFatigue(page, mode, keyboard)
    const initial = await readState(page)
    expect(initial.mode).toBe(mode.toLowerCase())
    const requirements = page.getByRole('list', { name: 'Design requirements' })
    // The Baseline fails fatigue (0.62 of min 1.30), yield (1.11 of min 1.50) and mass (678 g of max 520 g).
    await expect(requirements.getByText('0.62', { exact: true })).toBeVisible()
    await expect(requirements.getByText('1.11', { exact: true })).toBeVisible()
    await expect(requirements.getByText('678 g', { exact: true })).toBeVisible()
    await expect(requirements.getByText('✗ Fail')).toHaveCount(3)
    if (mode === 'Guided') {
      // Lazy chunk plus software WebGL can be slow while other workers render too.
      await expect(page.getByRole('img', { name: /^3D view of the stepped spindle/ })).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('img', { name: /^Side view of the stepped spindle/ })).toHaveCount(0)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    } else {
      await expect(page.getByRole('img', { name: /^Side view of the stepped spindle/ })).toBeVisible()
      await expect(page.getByText('3D view is unavailable. Showing the 2D side view of the spindle instead.').first()).toBeVisible()
      await expect(page.locator('canvas')).toHaveCount(0)
    }
    await expect(page.getByRole('img', { name: /^S-N diagram of the latest tested design/ })).toBeVisible()
    await expect(page.getByText(/Stress-life screening of a stepped spindle/)).toBeVisible()
    const collar = page.getByLabel('Collar diameter', { exact: true })
    if (mode === 'Guided') {
      await expectGuidedStep(page, 'Round the fillet')
      await expect(collar).toHaveAttribute('readonly', '')
      await expect(page.getByRole('radio', { name: 'Machined', exact: true })).toBeDisabled()
    } else {
      await expect(page.getByRole('region', { name: 'Guided experiments' })).toHaveCount(0)
      await expect(collar).not.toHaveAttribute('readonly', '')
    }
    await audit(page)

    // The internal reference: d 24.5, D 34, r 2 mm, machined.
    if (mode === 'Guided') {
      await setDimension(page, 'Fillet radius', '2', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Improve the surface')
      await chooseMachined(page, keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Thicken the neck')
      await setDimension(page, 'Neck diameter', '24.5', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Meet every check')
      await setDimension(page, 'Collar diameter', '34', keyboard)
      await runAnyTest(page, keyboard)
      await expect(page.getByRole('region', { name: 'Guided experiments' }).getByRole('heading', { name: 'All experiments complete' })).toBeVisible()
    } else {
      await setDimension(page, 'Collar diameter', '34', keyboard)
      await setDimension(page, 'Neck diameter', '24.5', keyboard)
      await setDimension(page, 'Fillet radius', '2', keyboard)
      await chooseMachined(page, keyboard)
      await page.getByRole('button', { name: 'Run Test', exact: true }).click()
      const prediction = page.getByRole('dialog', { name: 'Predict fatigue safety factor' })
      await expect(prediction).toBeVisible()
      await prediction.getByLabel('Increase', { exact: true }).check()
      await prediction.getByRole('button', { name: 'Run structural test' }).click()
      await expect(prediction).toBeHidden()
    }
    const tests = mode === 'Guided' ? 5 : 2
    const tested = await readState(page)
    expect(tested.history).toHaveLength(tests)
    expect(tested.history[tests - 1].evaluation.status).toBe('accepted')
    await expect(requirements.getByText('1.40', { exact: true })).toBeVisible()
    await expect(requirements.getByText('507 g', { exact: true })).toBeVisible()
    await expect(requirements.getByText('✗ Fail')).toHaveCount(0)
    const keys = await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('ei:session:fatigue-analysis-1')))
    expect(keys).toEqual(['ei:session:fatigue-analysis-1:v1'])
    const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ei:session:fatigue-analysis-1:v1')!))
    expect(saved).toMatchObject({ schemaVersion: 2, model: { id: 'steppedShaftFatigue', version: 1 } })
    await audit(page)
    await noHorizontalOverflow(page)

    await page.reload()
    await openFatigue(page, mode, false)
    const restored = await readState(page)
    expect(restored.history).toHaveLength(tests)
    expect(restored.history[tests - 1].evaluation.status).toBe('accepted')

    // Back to the library: sidebar navigation on desktop, the workspace menu on narrow screens.
    const library = page.locator('.platform-sidebar').getByRole('button', { name: 'Challenges' })
    if (await library.isVisible()) await library.click()
    else await page.getByLabel('Navigate workspace').selectOption('Challenges')
    await page.getByRole('button', { name: 'View Cantilever Beam I', exact: true }).click()
    await page.getByRole('dialog', { name: 'Cantilever Beam I', exact: true }).getByRole('button', { name: 'Open challenge', exact: true }).click()
    await expect.poll(async () => (await readState(page)).challengeId).toBe('cantilever-beam-1')
    expect((await readState(page)).history).toHaveLength(1)
  })
}

test('Fatigue Analysis I: the library card is available with its own drawing and details', async ({ page }) => {
  await page.goto('/#challenges')
  const card = page.locator('.challenge-card').filter({ hasText: 'Fatigue Analysis I' })
  await expect(card).toHaveCount(1)
  await expect(card.getByText('Advanced')).toBeVisible()
  await expect(card.locator('svg.technical-art')).toHaveCount(1)
  await expect(card.getByText('FIG. 10')).toBeAttached()
  await page.getByRole('button', { name: 'View Fatigue Analysis I', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Fatigue Analysis I', exact: true })
  await expect(drawer.getByText(/stress-life fatigue model of a stepped spindle/)).toBeVisible()
  await audit(page)
})
