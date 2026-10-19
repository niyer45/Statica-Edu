import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { audit, expectGuidedStep, readState, runAnyTest, tabTo } from './helpers'

// Stress and Strain I (task 72, D-62; SSR-15–SSR-19, MM-16, MM-22): chosen before entry from the
// library, the full prediction/test loop from a steel baseline failing stress and mass to the
// Accepted internal reference (aluminium, 20 mm), saved under its own key, isolated from Cantilever
// Beam I, keyboard-reachable, axe-clean and free of 320 px overflow, on desktop and Pixel 7. Guided
// walks the three experiments with the 3D view; Parametric hides WebGL2 to use the 2D view.

test.skip(!catalog.find((e) => e.id === '010')?.available, 'Stress and Strain I is not active')

async function openRod(page: Page, mode: 'Guided' | 'Parametric', keyboard: boolean) {
  const view = page.getByRole('button', { name: 'View Stress and Strain I', exact: true })
  const drawer = page.getByRole('dialog', { name: 'Stress and Strain I', exact: true })
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
  await expect.poll(async () => (await readState(page)).challengeId).toBe('stress-strain-1')
}

async function setDiameter(page: Page, value: string, keyboard: boolean) {
  const field = page.getByLabel('Diameter', { exact: true })
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

async function chooseMaterial(page: Page, name: RegExp, keyboard: boolean) {
  const radio = page.getByRole('radio', { name })
  await radio.scrollIntoViewIfNeeded()
  if (keyboard) {
    // A radio group is one Tab stop (the checked radio); arrow keys move the choice within it.
    await tabTo(page, page.getByRole('radio', { checked: true }).and(page.locator('input[name="rod-material"]')))
    for (let i = 0; i < 3 && !(await radio.isChecked()); i++) await page.keyboard.press('ArrowDown')
  } else {
    await radio.check()
  }
  await expect(radio).toBeChecked()
}

async function noHorizontalOverflow(page: Page) {
  const original = page.viewportSize()!
  await page.setViewportSize({ width: 320, height: 800 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.setViewportSize(original)
}

for (const mode of ['Guided', 'Parametric'] as const) {
  test(`Stress and Strain I ${mode}: test an Accepted rod, persist it and keep it isolated`, async ({ page }) => {
    test.setTimeout(150_000) // Keyboard entry or experiments, the KaTeX reference, reload, isolation and three axe audits.
    const keyboard = mode === 'Guided'
    if (mode === 'Parametric') {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: undefined })
      })
    }
    await page.goto('/#challenges')
    await openRod(page, mode, keyboard)
    const initial = await readState(page)
    expect(initial.mode).toBe(mode.toLowerCase())
    const requirements = page.getByRole('list', { name: 'Design requirements' })
    // The steel baseline fails stress and mass and passes stretch.
    await expect(requirements.getByText('150.7 MPa', { exact: true })).toBeVisible()
    await expect(requirements.getByText('125.0 MPa', { exact: true })).toBeVisible()
    await expect(requirements.getByText('1.51 mm', { exact: true })).toBeVisible()
    await expect(requirements.getByText('2.084 kg', { exact: true })).toBeVisible()
    await expect(requirements.getByText('✗ Fail')).toHaveCount(2)
    if (mode === 'Guided') {
      await expect(page.getByRole('img', { name: /^3D view of the hanger rod/ })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('img', { name: /^Cross-section of the rod/ })).toHaveCount(0)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await page.getByRole('button', { name: 'Show stretch' }).click()
      await expect(page.getByRole('button', { name: 'Show stretch' })).toHaveAttribute('aria-pressed', 'false')
      await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    } else {
      await expect(page.getByRole('img', { name: /^Cross-section of the rod/ })).toBeVisible()
      await expect(page.getByText('3D view is unavailable. Showing the 2D view of the rod instead.').first()).toBeVisible()
      await expect(page.locator('canvas')).toHaveCount(0)
    }
    await expect(page.getByText(/Latest tested: elongation 1\.51 mm \(drawn ×100\), stress 150\.7 MPa/)).toBeVisible()
    await expect(page.getByText(/Idealized linear-elastic rod in axial tension/)).toBeVisible()
    const titanium = page.getByRole('radio', { name: /^Titanium alloy/ })
    if (mode === 'Guided') {
      await expectGuidedStep(page, 'Thicken the rod')
      await expect(titanium).toBeDisabled()
    } else {
      await expect(page.getByRole('region', { name: 'Guided experiments' })).toHaveCount(0)
      await expect(page.getByText(/Every parameter is editable from the start/)).toBeVisible()
      await expect(titanium).toBeEnabled()
    }
    await audit(page)

    if (mode === 'Guided') {
      await setDiameter(page, '14.5', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Change the material')
      await expect(page.getByLabel('Diameter', { exact: true })).toHaveAttribute('readonly', '')
      await chooseMaterial(page, /^Titanium alloy/, keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Meet every check')
      await setDiameter(page, '20', keyboard)
      await chooseMaterial(page, /^Aluminium alloy 6061-T6/, keyboard)
      await runAnyTest(page, keyboard)
      await expect(page.getByRole('region', { name: 'Guided experiments' }).getByRole('heading', { name: 'All experiments complete' })).toBeVisible()
    } else {
      await setDiameter(page, '20', keyboard)
      await chooseMaterial(page, /^Aluminium alloy 6061-T6/, keyboard)
      await page.getByRole('button', { name: 'Run Test', exact: true }).click()
      const prediction = page.getByRole('dialog', { name: 'Predict elongation' })
      await expect(prediction).toBeVisible()
      await prediction.getByLabel('Increase', { exact: true }).check()
      await prediction.getByRole('button', { name: 'Run structural test' }).click()
      await expect(prediction).toBeHidden()
    }
    const tests = mode === 'Guided' ? 4 : 2
    const tested = await readState(page)
    expect(tested.history).toHaveLength(tests)
    expect(tested.history[tests - 1]!.evaluation.status).toBe('accepted')
    await expect(requirements.getByText('63.7 MPa', { exact: true })).toBeVisible()
    await expect(requirements.getByText('138.0 MPa', { exact: true })).toBeVisible()
    await expect(requirements.getByText('✗ Fail')).toHaveCount(0)
    const keys = await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('ei:session:stress-strain-1')))
    expect(keys).toEqual(['ei:session:stress-strain-1:v1'])
    await page.getByRole('button', { name: /Stress and strain reference/ }).click()
    const reference = page.getByRole('dialog', { name: 'Stress and strain' })
    await expect(reference.locator('.katex .mfrac').first()).toBeVisible()
    await audit(page)
    await reference.getByRole('button', { name: /Close/ }).first().click()
    await noHorizontalOverflow(page)

    await page.reload()
    await openRod(page, mode, false)
    const restored = await readState(page)
    expect(restored.history).toHaveLength(tests)
    expect(restored.history[tests - 1]!.evaluation.status).toBe('accepted')
    expect(restored.mode).toBe(mode.toLowerCase())

    const library = page.locator('.platform-sidebar').getByRole('button', { name: 'Challenges' })
    if (await library.isVisible()) await library.click()
    else await page.getByLabel('Navigate workspace').selectOption('Challenges')
    await page.getByRole('button', { name: 'View Cantilever Beam I', exact: true }).click()
    await page.getByRole('dialog', { name: 'Cantilever Beam I', exact: true }).getByRole('button', { name: 'Open challenge', exact: true }).click()
    await expect.poll(async () => (await readState(page)).challengeId).toBe('cantilever-beam-1')
    expect((await readState(page)).history).toHaveLength(1)
  })
}

test('Stress and Strain I card shows its own rod drawing in the library', async ({ page }) => {
  await page.goto('/#challenges')
  const card = page.locator('.challenge-card').filter({ hasText: 'Stress and Strain I' })
  await expect(card).toBeVisible()
  await expect(card.getByText('Introductory')).toBeVisible()
  await expect(card.locator('svg.technical-art')).toHaveCount(1)
  await expect(card.locator('svg.technical-art text').first()).toHaveText('FIG. 10')
})
