import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { audit, readState, tabTo } from './helpers'

// Braced Frame I (task 49.3; braced-frame-1 BFR-16–BFR-18, MM-16, MM-22): chosen before entry
// from the library, diagonals toggled from the keyboard, a mechanism shown as unstable with a
// not-scorable prediction, then the full prediction/test loop to an Accepted reference frame,
// saved under its own key, isolated from Cantilever Beam I, axe-clean and free of 320 px
// overflow. Guided also asserts the 3D frame view (task 54.3) renders a canvas; Parametric runs
// with WebGL disabled and asserts the SVG elevation fallback with no canvas. The whole file is skipped while catalog card 005 is unavailable: activation needs
// explicit owner approval (BFR-18, OC-15).

test.skip(!catalog.find((e) => e.id === '005')?.available, 'Braced Frame I awaits owner-approved activation')

async function openFrame(page: Page, mode: 'Guided' | 'Parametric', keyboard: boolean) {
  const view = page.getByRole('button', { name: 'View Braced Frame I', exact: true })
  const drawer = page.getByRole('dialog', { name: 'Braced Frame I', exact: true })
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
  await expect.poll(async () => (await readState(page)).challengeId).toBe('braced-frame-1')
}

async function toggleDiagonal(page: Page, name: string, keyboard: boolean) {
  const button = page.getByRole('button', { name, exact: true })
  const before = await button.getAttribute('aria-pressed')
  if (keyboard) {
    await tabTo(page, button)
    await page.keyboard.press('Space')
  } else {
    await button.scrollIntoViewIfNeeded()
    await button.click()
  }
  await expect(button).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true')
}

async function setSection(page: Page, member: RegExp, sectionId: string) {
  const select = page.getByLabel(member)
  await select.scrollIntoViewIfNeeded()
  await select.selectOption(sectionId)
  await expect(select).toHaveValue(sectionId)
}

async function runWithPrediction(page: Page, direction: 'Increase' | 'Decrease' | 'Stay the same') {
  await page.getByRole('button', { name: 'Run Test', exact: true }).click()
  const prediction = page.getByRole('dialog', { name: 'Predict roof drift' })
  await expect(prediction).toBeVisible()
  await prediction.getByLabel(direction, { exact: true }).check()
  await prediction.getByRole('button', { name: 'Run structural test' }).click()
  await expect(prediction).toBeHidden()
}

async function noHorizontalOverflow(page: Page) {
  const original = page.viewportSize()!
  await page.setViewportSize({ width: 320, height: 800 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.setViewportSize(original)
}

for (const mode of ['Guided', 'Parametric'] as const) {
  test(`Braced Frame I ${mode}: see a mechanism, test an Accepted frame, persist it and keep it isolated`, async ({ page }) => {
    test.setTimeout(120_000) // Keyboard entry, two predictions, reload, cross-challenge check and axe.
    const keyboard = mode === 'Guided'
    // Task 54.3: Guided runs the 3D view; Parametric runs with WebGL disabled (the beam's pattern)
    // and must show the main-bundle SVG elevation instead, with no canvas.
    if (mode === 'Parametric') {
      await page.addInitScript(() => { Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: undefined }) })
    }
    await page.goto('/#challenges')
    await openFrame(page, mode, keyboard)
    const initial = await readState(page)
    expect(initial.challengeId).toBe('braced-frame-1')
    expect(initial.mode).toBe(mode.toLowerCase())
    const requirements = page.getByRole('list', { name: 'Design requirements' })
    await expect(requirements.getByText('337.2%', { exact: true })).toBeVisible()
    await expect(page.getByText('Idealized pin-jointed frame, not a structural certification')).toBeVisible()
    const canvas = page.getByRole('img', { name: '3D braced frame view', exact: true })
    const elevation = page.getByRole('img', { name: /Two-storey braced frame elevation/ })
    if (mode === 'Guided') {
      // The canvas is named in R3F's onCreated, after software-WebGL context setup.
      await expect(canvas).toBeVisible({ timeout: 20_000 })
      await expect(page.locator('canvas')).toHaveCount(1)
      const box = (await canvas.boundingBox())!
      expect(box.width).toBeGreaterThan(200)
      expect(box.height).toBeGreaterThan(200)
      await expect(page.getByRole('list', { name: '3D pattern key' })).toContainText('Striped tube: compression')
      await expect(elevation).toHaveCount(0)
    } else {
      await expect(elevation).toBeVisible()
      await expect(page.getByText('3D view is unavailable. Use the 2D elevation and the member force table instead.', { exact: true }).first()).toBeVisible()
      await expect(page.locator('canvas')).toHaveCount(0)
    }
    await expect(page.getByRole('table', { name: 'Latest tested member forces' })).toBeVisible()
    if (mode === 'Guided') {
      await expect(page.getByRole('region', { name: 'Guided instructions' }).getByRole('heading', { name: 'Inspect', exact: true })).toBeVisible()
    } else {
      await expect(page.getByRole('region', { name: 'Guided instructions' })).toHaveCount(0)
      await expect(page.getByText('Direct bracing and member section editing', { exact: true })).toBeVisible()
    }
    await audit(page)

    // Iteration 1: remove the upper diagonal. The frame is a mechanism; nothing numeric is shown
    // for its drift or forces and the prediction is not scorable.
    await toggleDiagonal(page, 'Storey 2 diagonal, bottom right to top left', keyboard)
    await runWithPrediction(page, 'Decrease')
    await expect(requirements.getByText('Unstable mechanism', { exact: true })).toBeVisible()
    await expect(requirements.getByText('Not applicable', { exact: true })).toHaveCount(2)
    await expect(page.getByText(/Unstable: storey 2 has no diagonal/).first()).toBeVisible()
    await expect(page.getByRole('table', { name: 'Latest tested member forces' })).toHaveCount(0)
    if (mode === 'Guided') {
      // The 3D frame stays drawn for a mechanism, with no force patterns.
      await expect(canvas).toBeVisible()
      await expect(page.locator('#frame-scene-description')).toContainText('no force patterns are drawn')
    } else {
      await expect(elevation).toBeVisible()
      await expect(page.locator('canvas')).toHaveCount(0)
    }
    const mechanism = await readState(page)
    expect(mechanism.history).toHaveLength(2)
    expect(mechanism.history[1].evaluation.status).toBe('modelNotApplicable')
    expect(mechanism.history[1].predictionOutcome).toMatchObject({ scorable: false })
    await audit(page)

    // Iteration 2: the reference frame (BFR-05): tension diagonals and resized members.
    await toggleDiagonal(page, 'Storey 1 diagonal, bottom right to top left', keyboard)
    await toggleDiagonal(page, 'Storey 1 diagonal, bottom left to top right', keyboard)
    await toggleDiagonal(page, 'Storey 2 diagonal, bottom left to top right', keyboard)
    await setSection(page, /^Lower left column/, 'CHS48.3x3.2')
    await setSection(page, /^Lower right column/, 'CHS88.9x5.0')
    await setSection(page, /^Upper right column/, 'CHS76.1x4.0')
    await setSection(page, /^Floor beam/, 'CHS76.1x4.0')
    await setSection(page, /^Roof beam/, 'CHS76.1x4.0')
    await setSection(page, /^Lower diagonal \(bottom left to top right\)/, 'CHS76.1x4.0')
    await setSection(page, /^Upper diagonal \(bottom left to top right\)/, 'CHS48.3x3.2')
    await page.getByRole('button', { name: 'Run Test', exact: true }).click()
    const tested = await readState(page)
    expect(tested.history).toHaveLength(3)
    expect(tested.history[2].evaluation.status).toBe('accepted')
    await expect(requirements.getByText('10.38 mm', { exact: true })).toBeVisible()

    // Iteration 3 is a checkpoint: a lighter roof beam barely changes the roof drift (worksheet
    // ratio 1.012, within the 0.98–1.02 band) but overloads that beam in buckling.
    await setSection(page, /^Roof beam/, 'CHS60.3x4.0')
    await runWithPrediction(page, 'Stay the same')
    const third = await readState(page)
    expect(third.history).toHaveLength(4)
    expect(third.history[3].predictionOutcome).toMatchObject({ scorable: true, actual: 'same', matched: true })
    expect(third.history[3].evaluation.status).toBe('notAccepted')
    await audit(page)
    await noHorizontalOverflow(page)

    await page.reload()
    await openFrame(page, mode, false)
    const restored = await readState(page)
    expect(restored.challengeId).toBe('braced-frame-1')
    expect(restored.history).toHaveLength(4)
    expect(restored.history[1].evaluation.status).toBe('modelNotApplicable')
    expect(restored.history[2].evaluation.status).toBe('accepted')

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
