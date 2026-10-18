import { expect, test } from '@playwright/test'
import { audit, expectGuidedStep, normalizeState, openWorkbench, readState, referenceDesign, runAnyTest, setDimension, tabTo } from './helpers'

// Task 58: Guided = structured experiments (one variable per step, the rest locked, progress from
// tested results); Parametric = open design (everything editable, no steps). Both are chosen in
// the challenge drawer before entry, fixed in the workbench and retained after reload (D-37).

for (const mode of ['Guided', 'Parametric'] as const) {
  test(`${mode} is selected before entry, fixed in the workbench and retained after reload`, async ({ page }) => {
    test.setTimeout(120_000) // Entry keyboard traversal, the Guided step walk, submission, reload and axe.
    if (mode === 'Parametric') {
      await page.addInitScript(() => { Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: undefined }) })
    }
    await page.goto('/')
    const view = page.getByRole('button', { name: 'View Cantilever Beam I', exact: true })
    await tabTo(page, view)
    await page.keyboard.press('Enter')
    const drawer = page.getByRole('dialog', { name: 'Cantilever Beam I', exact: true })
    await expect(drawer.getByRole('button', { name: /^Guided/ })).toContainText('Structured experiments')
    await expect(drawer.getByRole('button', { name: /^Parametric/ })).toContainText('Open design')
    const choice = drawer.getByRole('button', { name: new RegExp(`^${mode}`) })
    await tabTo(page, choice)
    await page.keyboard.press('Enter')
    const open = drawer.getByRole('button', { name: 'Open challenge', exact: true })
    await tabTo(page, open)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible()
    expect((await readState(page)).mode).toBe(mode.toLowerCase())
    await expect(page.getByRole('combobox', { name: 'Interaction mode' })).toHaveCount(0)
    await expect(page.getByLabel('Design mode')).toContainText(`${mode} mode`)
    const guide = page.getByRole('region', { name: 'Guided experiments' })
    const iSection = page.getByRole('button', { name: /I-section/ }).filter({ has: page.locator('svg') }).first()
    const diameter = page.locator('#dim-diameterM')
    if (mode === 'Guided') {
      // Step 1: only the depth is editable; the section shape is locked with a visible reason.
      await expectGuidedStep(page, 'Make it deeper')
      await expect(iSection).toHaveAttribute('aria-disabled', 'true')
      await expect(page.getByText('Locked in this step. Editable now: Depth (diameter or height).').first()).toBeVisible()
      // aria-disabled: a forced click still reaches the tile but changes nothing.
      const before = await readState(page)
      await iSection.click({ force: true })
      expect((await readState(page)).draft).toEqual(before.draft)
      await expect(diameter).not.toHaveAttribute('readonly', '')
      await setDimension(page, 'diameterM', '40')
      await runAnyTest(page)
      // Step 2: the shape unlocks and the diameter locks.
      await expectGuidedStep(page, 'Try another shape')
      await expect(guide).toContainText('Make it deeper complete: Iteration 1 compared with the Baseline. Tip deflection decreased; Mass increased.')
      await expect(diameter).toHaveAttribute('readonly', '')
      await expect(iSection).not.toHaveAttribute('aria-disabled', 'true')
      await iSection.click()
      await runAnyTest(page)
      // Step 3: one dimension of the new shape.
      await expectGuidedStep(page, 'Tune one dimension')
      await setDimension(page, 'heightM', '60')
      await runAnyTest(page)
      // Step 4: everything open; an Accepted test completes the experiments.
      await expectGuidedStep(page, 'Meet every check')
      await expect(page.getByText(/Locked in this step/)).toHaveCount(0)
      await referenceDesign(page)
      await runAnyTest(page)
      await expect(guide.getByRole('heading', { name: 'All experiments complete' })).toBeVisible()
    } else {
      await expect(guide).toHaveCount(0)
      await expect(page.getByRole('list', { name: 'Experiment steps' })).toHaveCount(0)
      await expect(page.locator('canvas')).toHaveCount(0)
      await expect(page.getByText(/Every parameter is editable from the start/)).toBeVisible()
      await expect(page.getByText(/Locked in this step/)).toHaveCount(0)
      await expect(iSection).not.toHaveAttribute('aria-disabled', 'true')
      await referenceDesign(page)
      await page.getByRole('button', { name: 'Run Test', exact: true }).click()
      const prediction = page.getByRole('dialog', { name: 'Predict deflection' })
      await expect(prediction).toBeVisible()
      expect((await readState(page)).history).toHaveLength(1)
      await prediction.getByLabel('Decrease', { exact: true }).check()
      await prediction.getByRole('button', { name: 'Run structural test' }).click()
      await expect(prediction).toBeHidden()
    }
    const tested = await readState(page)
    const last = tested.history.length - 1
    expect(tested.history).toHaveLength(mode === 'Guided' ? 5 : 2)
    expect(tested.history[1].prediction?.direction).toBe('decrease')
    expect(tested.history[last].evaluation.status).toBe('accepted')
    await page.getByRole('checkbox', { name: `Compare Iteration ${last}`, exact: true }).check()
    await page.getByRole('button', { name: 'Explain & submit', exact: true }).click()
    const submit = page.getByRole('dialog', { name: 'Explain & submit', exact: true })
    await submit.getByRole('textbox').fill('My selected mode and tested workspace persist after reload.')
    await submit.getByRole('button', { name: 'Submit design & reflection' }).click()
    await page.keyboard.press('Escape')
    const before = await readState(page)
    expect(before.mode).toBe(mode.toLowerCase())
    await audit(page)
    await page.reload()
    await openWorkbench(page, false)
    expect(normalizeState(await readState(page))).toEqual(normalizeState(before))
    await expect(page.getByRole('combobox', { name: 'Interaction mode' })).toHaveCount(0)
    if (mode === 'Guided') await expect(guide.getByRole('heading', { name: 'All experiments complete' })).toBeVisible()
    else await expect(guide).toHaveCount(0)
    await page.setViewportSize({ width: 320, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    await audit(page)
  })
}

test('Guided step progress is derived from tested history and survives reload mid-sequence', async ({ page }) => {
  await openWorkbench(page, true, false, 'Guided')
  await setDimension(page, 'diameterM', '40')
  await runAnyTest(page)
  await expectGuidedStep(page, 'Try another shape')
  await page.reload()
  await openWorkbench(page, false)
  expect((await readState(page)).mode).toBe('guided')
  await expectGuidedStep(page, 'Try another shape')
  await expect(page.locator('#dim-diameterM')).toHaveAttribute('readonly', '')
})
