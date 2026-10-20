import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { audit, expectGuidedStep, readState, runAnyTest, tabTo } from './helpers'

// Pressure Vessel I (task 69, D-59; PVS-14–PVS-17, MM-16, MM-22): chosen before entry from the
// library, full prediction/test loop from a baseline that fails hoop stress, head stress, volume
// and overall length to the Accepted internal reference, saved under its own key in the v2
// envelope, isolated from Cantilever Beam I, keyboard-reachable, axe-clean and free of 320 px
// overflow, on desktop and Pixel 7. Guided walks the five experiments; Parametric is open design
// and exercises the 2D fallback.

test.skip(!catalog.find((e) => e.id === '007')?.available, 'Pressure Vessel I is not active')

async function openVessel(page: Page, mode: 'Guided' | 'Parametric', keyboard: boolean) {
  const view = page.getByRole('button', { name: 'View Pressure Vessel I', exact: true })
  const drawer = page.getByRole('dialog', { name: 'Pressure Vessel I', exact: true })
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
  await expect.poll(async () => (await readState(page)).challengeId).toBe('pressure-vessel-1')
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

test('Pressure Vessel I card is available in the library with its own drawing', async ({ page }) => {
  await page.goto('/#challenges')
  const card = page.locator('.challenge-card').filter({ hasText: 'Pressure Vessel I' })
  await expect(card).toHaveCount(1)
  await expect(card).toHaveClass(/theme-vessel/)
  await expect(card.getByText('FIG. 07')).toBeVisible()
  await expect(card.getByText('Intermediate')).toBeVisible()
  await expect(card.getByText('Concept preview')).toHaveCount(0)
})

for (const mode of ['Guided', 'Parametric'] as const) {
  test(`Pressure Vessel I ${mode}: test an Accepted vessel, persist it and keep it isolated`, async ({ page }) => {
    // Guided adds its four experiment steps before the final test.
    test.setTimeout(mode === 'Guided' ? 150_000 : 90_000)
    const keyboard = mode === 'Guided'
    // Guided exercises the lazy 3D cutaway; Parametric hides WebGL2 to exercise the 2D section.
    if (mode === 'Parametric') {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: undefined })
      })
    }
    await page.goto('/#challenges')
    await openVessel(page, mode, keyboard)
    const initial = await readState(page)
    expect(initial.mode).toBe(mode.toLowerCase())
    const requirements = page.getByRole('list', { name: 'Design requirements' })
    // The baseline fails hoop stress, head stress, volume and overall length; the longitudinal
    // stress passes at half the hoop stress.
    await expect(requirements.getByText('192.0 MPa', { exact: true })).toBeVisible()
    await expect(requirements.getByText('96.0 MPa', { exact: true })).toBeVisible()
    await expect(requirements.getByText('160.0 MPa', { exact: true })).toBeVisible()
    await expect(requirements.getByText('61.5 L', { exact: true })).toBeVisible()
    await expect(requirements.getByText('at least 100.0 L', { exact: true })).toBeVisible()
    await expect(requirements.getByText('1443 mm', { exact: true })).toBeVisible()
    await expect(requirements.getByText('✗ Fail')).toHaveCount(4)
    if (mode === 'Guided') {
      await expect(page.getByRole('img', { name: /^3D cutaway of the pressure vessel/ })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('img', { name: /^Section through the vessel/ })).toHaveCount(0)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    } else {
      await expect(page.getByRole('img', { name: /^Section through the vessel/ })).toBeVisible()
      await expect(page.getByText('3D view is unavailable. Showing the 2D section of the vessel instead.').first()).toBeVisible()
      await expect(page.getByText(/wall thicknesses are drawn 6 times thicker/)).toBeVisible()
      await expect(page.locator('canvas')).toHaveCount(0)
    }
    await expect(page.getByText(/Idealized thin-walled vessel: membrane stresses/)).toBeVisible()
    const diameter = page.getByLabel('Inner diameter', { exact: true })
    if (mode === 'Guided') {
      await expectGuidedStep(page, 'Thicken the shell')
      await expect(diameter).toHaveAttribute('readonly', '')
    } else {
      await expect(page.getByRole('region', { name: 'Guided experiments' })).toHaveCount(0)
      await expect(diameter).not.toHaveAttribute('readonly', '')
    }
    await audit(page)

    // The internal reference (Ø400, L 530, shell 6.5, heads 3.5 mm).
    if (mode === 'Guided') {
      await setDimension(page, 'Shell thickness', '4', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Widen the vessel')
      await expect(page.getByLabel('Shell thickness', { exact: true })).toHaveAttribute('readonly', '')
      await setDimension(page, 'Inner diameter', '400', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Shorten the shell')
      await setDimension(page, 'Shell length', '530', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Size the heads')
      await setDimension(page, 'Head thickness', '3.5', keyboard)
      await runAnyTest(page, keyboard)
      await expectGuidedStep(page, 'Meet every check')
      await setDimension(page, 'Shell thickness', '6.5', keyboard)
      await runAnyTest(page, keyboard)
      await expect(page.getByRole('region', { name: 'Guided experiments' }).getByRole('heading', { name: 'All experiments complete' })).toBeVisible()
    } else {
      await setDimension(page, 'Inner diameter', '400', keyboard)
      await setDimension(page, 'Shell length', '530', keyboard)
      await setDimension(page, 'Shell thickness', '6.5', keyboard)
      await setDimension(page, 'Head thickness', '3.5', keyboard)
      await page.getByRole('button', { name: 'Run Test', exact: true }).click()
      const prediction = page.getByRole('dialog', { name: 'Predict hoop stress' })
      await expect(prediction).toBeVisible()
      await prediction.getByLabel('Decrease', { exact: true }).check()
      await prediction.getByRole('button', { name: 'Run structural test' }).click()
      await expect(prediction).toBeHidden()
    }
    const tests = mode === 'Guided' ? 6 : 2
    const tested = await readState(page)
    expect(tested.history).toHaveLength(tests)
    expect(tested.history[tests - 1].evaluation.status).toBe('accepted')
    await expect(requirements.getByText('123.1 MPa', { exact: true })).toBeVisible()
    await expect(requirements.getByText('100.1 L', { exact: true })).toBeVisible()
    await expect(requirements.getByText('✗ Fail')).toHaveCount(0)
    // Explain & submit records the Accepted design with a reflection.
    await page.getByRole('button', { name: 'Explain & submit', exact: true }).click()
    const submit = page.getByRole('dialog', { name: 'Explain & submit', exact: true })
    await expect(submit.getByText(/why the hoop stress governs the shell/)).toBeVisible()
    await submit.getByRole('textbox').fill('The hoop stress is twice the longitudinal stress, so the shell wall set the design; the heads needed about half of it.')
    await submit.getByRole('button', { name: 'Submit design & reflection' }).click()
    await page.keyboard.press('Escape')
    const submitted = (await readState(page)) as unknown as { submission?: { testResultId: string; status: string } }
    expect(submitted.submission).toMatchObject({ testResultId: tested.history[tests - 1].id, status: 'accepted' })
    const keys = await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('ei:session:pressure-vessel-1')))
    expect(keys).toEqual(['ei:session:pressure-vessel-1:v1'])
    const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ei:session:pressure-vessel-1:v1')!))
    expect(saved).toMatchObject({ schemaVersion: 2, model: { id: 'thinWallPressureVessel', version: 1 } })
    await audit(page)
    await noHorizontalOverflow(page)

    await page.reload()
    await openVessel(page, mode, false)
    const restored = await readState(page)
    expect(restored.mode).toBe(mode.toLowerCase())
    expect(restored.history).toHaveLength(tests)
    expect(restored.history[tests - 1].evaluation.status).toBe('accepted')

    // Back to the library: Cantilever Beam I keeps its own, untouched workspace.
    const library = page.locator('.platform-sidebar').getByRole('button', { name: 'Challenges' })
    if (await library.isVisible()) await library.click()
    else await page.getByLabel('Navigate workspace').selectOption('Challenges')
    await page.getByRole('button', { name: 'View Cantilever Beam I', exact: true }).click()
    await page.getByRole('dialog', { name: 'Cantilever Beam I', exact: true }).getByRole('button', { name: 'Open challenge', exact: true }).click()
    await expect.poll(async () => (await readState(page)).challengeId).toBe('cantilever-beam-1')
    const beam = await readState(page)
    expect(beam.history).toHaveLength(1)
  })
}

test('Pressure Vessel I reports thick walls as outside the thin-wall model', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: undefined })
  })
  await page.goto('/#challenges')
  await openVessel(page, 'Parametric', false)
  await setDimension(page, 'Inner diameter', '200', false)
  await setDimension(page, 'Shell length', '600', false)
  await setDimension(page, 'Shell thickness', '12', false)
  await setDimension(page, 'Head thickness', '12', false)
  await runAnyTest(page)
  const reasons = page.getByRole('list', { name: 'Model applicability reasons' })
  await expect(reasons.getByText(/Shell thickness divided by inner radius is 0\.12, above the model limit of 0\.1/)).toBeVisible()
  await expect(reasons.getByText(/r\/t of at least 10/).first()).toBeVisible()
  await expect(page.getByLabel('Result status').getByText(/Model not applicable/)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Design requirements' }).getByText('Outside model assumptions').first()).toBeVisible()
  expect((await readState(page)).history[1].evaluation.status).toBe('modelNotApplicable')
  await audit(page)
})
