import { expect, test, type Page } from '@playwright/test'
import { audit } from './helpers'

// Task 67: the Learn pillar on desktop and Pixel 7. Predict-then-check steps, model-backed demos,
// progress kept across reloads, accessible at 320 px, and Apply it opening Cantilever Beam I in
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

test('Learn: predict, check with the demo, keep progress and apply it in Guided mode', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/#learning-paths') // old links still open Learn
  await expect(page.getByRole('heading', { level: 1, name: 'Learn' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Mechanics of materials' }).getByText('Planned').first()).toBeVisible()
  await audit(page)
  await page.getByRole('button', { name: 'Start Beam bending' }).click()
  await expect(page).toHaveURL(/#learn\/beam-bending$/)

  // The demo appears only after the prediction is committed.
  await expect(page.getByRole('heading', { level: 2, name: 'Load and deflection' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Try it' })).toHaveCount(0)
  await predict(page, 'It becomes four times larger')
  await expect(page.locator('.learn-feedback')).toContainText('The model gives a different answer: it doubles.')
  const tryIt = page.getByRole('region', { name: 'Try it' })
  const tip = tryIt.locator('dt', { hasText: 'Tip deflection' }).locator('xpath=following-sibling::dd')
  await expect(tip).toHaveText('9.1 mm')
  await tryIt.getByRole('slider', { name: 'Tip load' }).fill('100')
  await expect(tip).toHaveText('4.5 mm')
  await audit(page)

  await page.getByRole('button', { name: 'Next step' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Length' })).toBeFocused()
  await predict(page, 'Eight times as large')
  await expect(page.locator('.learn-feedback')).toContainText('Your prediction matches the model.')
  await expect(page.getByLabel('Module progress')).toHaveText('2 of 5 steps done')

  // Equations typeset with KaTeX on demand.
  await page.locator('.learn-advanced summary').click()
  await expect(page.locator('.learn-advanced .katex .mfrac').first()).toBeVisible()

  // A reload keeps the module and its progress on this device.
  await page.reload()
  await expect(page.getByRole('heading', { level: 2, name: 'Material stiffness' })).toBeVisible()
  await expect(page.getByLabel('Module progress')).toHaveText('2 of 5 steps done')
  await predict(page, 'About 3 times larger')
  await expectNoHorizontalOverflow(page, 320)
  await audit(page)

  await page.getByRole('list', { name: 'Steps' }).getByRole('button', { name: 'Apply it' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Apply it' })).toBeFocused()
  await page.getByRole('button', { name: 'Open Cantilever Beam I in Guided mode' }).click()
  await expect(page.getByRole('button', { name: 'Run Test', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Guided experiments' })).toBeVisible()
})
