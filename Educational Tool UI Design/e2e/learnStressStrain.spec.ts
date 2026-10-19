import { expect, test, type Page } from '@playwright/test'
import { audit, readState } from './helpers'

// Task 72 (SSL-01–SSL-06): the Stress and strain Learn module on desktop and Pixel 7.
// Predict-then-check steps, model-backed demos with beyond-yield states in text, KaTeX equations,
// progress kept across reloads, accessible at 320 px, and Apply it opening Stress and Strain I in
// Guided mode.

async function expectNoHorizontalOverflow(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 })
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(width)
}

async function predict(page: Page, option: string) {
  await page.getByRole('radio', { name: option, exact: true }).check()
  await page.getByRole('button', { name: 'Check my prediction' }).click()
}

const readout = (page: Page, label: string | RegExp) => page.getByRole('region', { name: 'Try it' }).locator('dt', { hasText: label }).locator('xpath=following-sibling::dd')

test('Learn: Stress and strain, predict and check, keep progress and apply it in Guided mode', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/#learn')
  await expect(page.getByRole('heading', { level: 1, name: 'Learn' })).toBeVisible()
  await page.getByRole('button', { name: 'Start Stress and strain' }).click()
  await expect(page).toHaveURL(/#learn\/stress-strain$/)

  await expect(page.getByRole('heading', { level: 2, name: 'Stress: force over area' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Try it' })).toHaveCount(0)
  await predict(page, 'Twice as large')
  await expect(page.locator('.learn-feedback')).toContainText('The model gives a different answer: a quarter as large.')
  const stress = readout(page, /^Stress$/)
  await expect(stress).toHaveText('127.3 MPa')
  await page.getByRole('region', { name: 'Try it' }).getByRole('slider', { name: 'Diameter' }).fill('20')
  await expect(stress).toHaveText('31.8 MPa')
  await page.getByRole('region', { name: 'Try it' }).getByRole('slider', { name: 'Diameter' }).fill('5')
  await expect(readout(page, 'State (steel)')).toHaveText('Beyond yield: not modeled')
  await audit(page)

  await page.getByRole('button', { name: 'Next step' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Strain: stretch per length' })).toBeFocused()
  await predict(page, 'The 1 m rod')
  await expect(page.locator('.learn-feedback')).toContainText('Your prediction matches the model.')
  await expect(page.getByLabel('Module progress')).toHaveText('2 of 5 steps done')
  await page.locator('.learn-advanced summary').click()
  await expect(page.locator('.learn-advanced .katex .mfrac').first()).toBeVisible()

  // A reload keeps the module and its progress on this device.
  await page.reload()
  await expect(page.getByRole('heading', { level: 2, name: "Hooke's law and stiffness" })).toBeVisible()
  await expect(page.getByLabel('Module progress')).toHaveText('2 of 5 steps done')
  await predict(page, 'About 3 times as much')
  await page.getByRole('region', { name: 'Try it' }).getByRole('radio', { name: 'Aluminium alloy 6061-T6' }).check()
  await expect(readout(page, 'Elongation')).toHaveText('3.69 mm')
  await page.getByRole('button', { name: 'Next step' }).click()
  await predict(page, 'About the same: the aluminium alloy is slightly higher')
  await page.getByRole('region', { name: 'Try it' }).getByRole('slider', { name: 'Load' }).fill('20')
  await expect(readout(page, 'Structural steel: yield 250.0 MPa')).toHaveText('Beyond yield: not modeled')
  await expectNoHorizontalOverflow(page, 320)
  await audit(page)

  await page.getByRole('list', { name: 'Steps' }).getByRole('button', { name: 'Apply it' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Apply it' })).toBeFocused()
  await page.getByRole('button', { name: 'Open Stress and Strain I in Guided mode' }).click()
  await expect(page.getByRole('button', { name: 'Run Test', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Guided experiments' }).getByRole('heading', { name: 'Thicken the rod' })).toBeVisible()
  await expect.poll(async () => (await readState(page)).challengeId).toBe('stress-strain-1')
  expect((await readState(page)).mode).toBe('guided')
})
