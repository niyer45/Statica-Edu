import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { audit, expectGuidedStep, readState, runAnyTest, tabTo } from './helpers'

// Column Buckling I (task 68, D-58; CBK-18–CBK-20, MM-16, MM-22): the owner-requested introductory
// challenge, chosen before entry from the library; the full prediction/test loop from a solid bar
// that fails buckling and mass to the Accepted internal reference tube, saved under its own key,
// isolated from Cantilever Beam I, keyboard-reachable, axe-clean and free of 320 px overflow, on
// desktop and Pixel 7. Guided exercises the 3D view; Parametric hides WebGL2 for the 2D fallback.

test.skip(!catalog.find((e) => e.id === '007')?.available, 'Column Buckling I is not available')

async function openColumn(page: Page, mode: 'Guided' | 'Parametric', keyboard: boolean) {
  const view = page.getByRole('button', { name: 'View Column Buckling I', exact: true })
  const drawer = page.getByRole('dialog', { name: 'Column Buckling I', exact: true })
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
  await expect.poll(async () => (await readState(page)).challengeId).toBe('column-buckling-1')
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

async function chooseTube(page: Page, keyboard: boolean) {
  const tile = page.getByRole('button', { name: /Hollow tube/ })
  if (keyboard) {
    await tabTo(page, tile)
    await page.keyboard.press('Enter')
  } else {
    await tile.click()
  }
  await expect(tile).toHaveAttribute('aria-pressed', 'true')
}

async function noHorizontalOverflow(page: Page) {
  const original = page.viewportSize()!
  await page.setViewportSize({ width: 320, height: 800 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.setViewportSize(original)
}

for (const mode of ['Guided', 'Parametric'] as const) {
  test(`Column Buckling I ${mode}: test an Accepted column, persist it and keep it isolated`, async ({ page }) => {
    // Guided adds its experiment steps (D-49): four more tests before the final one.
    test.setTimeout(mode === 'Guided' ? 180_000 : 90_000)
    const keyboard = mode === 'Guided'
    if (mode === 'Parametric') {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: undefined })
      })
    }
    await page.goto('/#challenges')
    await openColumn(page, mode, keyboard)
    const initial = await readState(page)
    expect(initial.mode).toBe(mode.toLowerCase())
    const requirements = page.getByRole('list', { name: 'Design requirements' })
    // The solid baseline buckles and is too heavy, while its axial stress passes.
    await expect(requirements.getByText('3.01 kN', { exact: true })).toBeVisible()
    await expect(requirements.getByText('≥ 20.00 kN', { exact: true })).toBeVisible()
    await expect(requirements.getByText('21.2 MPa', { exact: true })).toBeVisible()
    await expect(requirements.getByText('2.55 kg', { exact: true })).toBeVisible()
    await expect(requirements.getByText('✗ Fail')).toHaveCount(2)
    if (mode === 'Guided') {
      // Lazy chunk plus software WebGL can exceed the default 5 s when workers run in parallel.
      await expect(page.getByRole('img', { name: /^3D view of the column/ })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('img', { name: /^Side view of the column/ })).toHaveCount(0)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await page.getByRole('button', { name: 'Show buckling mode' }).click()
      await expect(page.getByRole('button', { name: 'Show buckling mode' })).toHaveAttribute('aria-pressed', 'false')
      await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    } else {
      await expect(page.getByRole('img', { name: /^Side view of the column/ })).toBeVisible()
      await expect(page.getByText('3D view is unavailable. Showing the 2D side view of the column instead.').first()).toBeVisible()
      await expect(page.locator('canvas')).toHaveCount(0)
    }
    await expect(page.getByText(/Idealized pinned–pinned Euler column/)).toBeVisible()
    const tile = page.getByRole('button', { name: /Hollow tube/ })
    if (mode === 'Guided') {
      await expectGuidedStep(page, 'Thicken the solid bar')
      await expect(tile).toHaveAttribute('aria-disabled', 'true')
    } else {
      await expect(page.getByRole('region', { name: 'Guided experiments' })).toHaveCount(0)
      await expect(page.getByText(/Every parameter is editable from the start/)).toBeVisible()
    }
    await audit(page)

    // The internal reference: a tube 60 mm across with a 2 mm wall.
    if (mode === 'Guided') {
      await setDimension(page, 'Diameter', '30', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Hollow it out')
      await chooseTube(page, keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Change only the wall')
      await expect(page.getByLabel('Outer diameter', { exact: true })).toHaveAttribute('readonly', '')
      await setDimension(page, 'Wall thickness', '2', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Widen the tube')
      await setDimension(page, 'Outer diameter', '55', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Meet every check')
      await setDimension(page, 'Outer diameter', '60', keyboard)
      await runAnyTest(page, keyboard)
      await expect(page.getByRole('region', { name: 'Guided experiments' }).getByRole('heading', { name: 'All experiments complete' })).toBeVisible()
    } else {
      await chooseTube(page, keyboard)
      await setDimension(page, 'Outer diameter', '60', keyboard)
      await setDimension(page, 'Wall thickness', '2', keyboard)
      await page.getByRole('button', { name: 'Run Test', exact: true }).click()
      const prediction = page.getByRole('dialog', { name: 'Predict critical load' })
      await expect(prediction).toBeVisible()
      await prediction.getByLabel('Increase', { exact: true }).check()
      await prediction.getByRole('button', { name: 'Run structural test' }).click()
      await expect(prediction).toBeHidden()
    }
    const tests = mode === 'Guided' ? 6 : 2
    const tested = await readState(page)
    expect(tested.history).toHaveLength(tests)
    expect(tested.history[tests - 1].evaluation.status).toBe('accepted')
    await expect(requirements.getByText('26.12 kN', { exact: true })).toBeVisible()
    await expect(requirements.getByText('✗ Fail')).toHaveCount(0)
    const keys = await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('ei:session:column-buckling-1')))
    expect(keys).toEqual(['ei:session:column-buckling-1:v1'])
    await audit(page)
    await noHorizontalOverflow(page)

    await page.reload()
    await openColumn(page, mode, false)
    const restored = await readState(page)
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
    expect((await readState(page)).history).toHaveLength(1)
  })
}
