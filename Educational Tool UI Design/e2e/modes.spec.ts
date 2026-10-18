import { expect, test } from '@playwright/test'
import { audit, normalizeState, openWorkbench, readState, referenceDesign, tabTo } from './helpers'

for (const mode of ['Guided', 'Parametric'] as const) {
  test(`${mode} is selected before entry, fixed in the workbench and retained after reload`, async ({ page }) => {
    test.setTimeout(90_000) // Entry keyboard traversal, prediction/submission, reload and axe.
    if (mode === 'Parametric') {
      await page.addInitScript(() => { Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: undefined }) })
    }
    await page.goto('/#challenges')
    const view = page.getByRole('button', { name: 'View Cantilever Beam I', exact: true })
    await tabTo(page, view)
    await page.keyboard.press('Enter')
    const drawer = page.getByRole('dialog', { name: 'Cantilever Beam I', exact: true })
    const choice = drawer.getByRole('button', { name: new RegExp(`^${mode}`) })
    await tabTo(page, choice)
    await page.keyboard.press('Enter')
    const open = drawer.getByRole('button', { name: 'Open challenge', exact: true })
    await tabTo(page, open)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible()
    expect((await readState(page)).mode).toBe(mode.toLowerCase())
    await expect(page.getByRole('combobox', { name: 'Interaction mode' })).toHaveCount(0)
    const guide = page.getByRole('region', { name: 'Guided instructions' })
    if (mode === 'Guided') {
      await expect(guide.getByRole('heading', { name: 'Inspect', exact: true })).toBeVisible()
      await guide.getByRole('button', { name: '2. Experiment' }).click()
      await guide.getByText('Hint & suggested experiment').click()
      // The baseline is an I-section turned 90° (task 59), so the suggestion is to rotate it.
      await expect(guide.getByText(/Try rotating a rectangle or I-section/)).toBeVisible()
    } else {
      await expect(guide).toHaveCount(0)
      await expect(page.getByRole('list', { name: 'Workflow' })).toHaveCount(0)
      await expect(page.locator('canvas')).toHaveCount(0)
      await expect(page.getByText('Direct section and dimension editing')).toBeVisible()
    }
    await referenceDesign(page)
    await page.getByRole('button', { name: 'Run Test', exact: true }).click()
    const prediction = page.getByRole('dialog', { name: 'Predict deflection' })
    await expect(prediction).toBeVisible()
    expect((await readState(page)).history).toHaveLength(1)
    await prediction.getByLabel('Decrease', { exact: true }).check()
    await prediction.getByRole('button', { name: 'Run structural test' }).click()
    await expect(prediction).toBeHidden()
    const tested = await readState(page)
    expect(tested.history).toHaveLength(2)
    expect(tested.history[1].prediction?.direction).toBe('decrease')
    await page.getByRole('checkbox', { name: 'Compare Iteration 1', exact: true }).check()
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
    if (mode === 'Guided') await expect(guide.getByRole('heading', { name: 'Explain', exact: true })).toBeVisible()
    else await expect(guide).toHaveCount(0)
    await page.setViewportSize({ width: 320, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    await audit(page)
  })
}
