import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { dismissGuidedPopover } from './helpers'

// Task 61 (owner feedback): opening a disclosure in the challenge panel may grow the workbench
// row, but closing it must return the row to its original height. The 3D canvas used to keep the
// taller pixel height and hold the row open.
// Task 78: all ten challenges, in Guided (where the step popover is dismissed first, WD-11) and
// the popover and chip behaviour itself.

const NAMES = catalog.map((entry) => entry.title)

async function enter(page: Page, name: string, mode: 'Guided' | 'Parametric') {
  await page.goto('/#challenges')
  await page.getByRole('button', { name: `View ${name}`, exact: true }).click()
  const drawer = page.getByRole('dialog', { name, exact: true })
  await drawer.getByRole('button', { name: new RegExp(`^${mode}`) }).click()
  await drawer.getByRole('button', { name: /^(Open|Continue) challenge$/ }).click()
  await expect(page.getByRole('button', { name: 'Run Test', exact: true })).toBeVisible()
}

test('the catalog lists all ten challenges', () => {
  expect(NAMES).toHaveLength(10)
})

for (const name of NAMES) {
  test(`${name}: closing a challenge-panel disclosure restores the workbench height`, async ({ page }) => {
    test.skip(!catalog.find((e) => e.title === name)?.available, `${name} is not active`)
    await enter(page, name, 'Guided')
    // The auto-opened Guided step popover sits over the challenge column at desktop width and would
    // intercept the clicks; dismiss it explicitly (WD-11).
    await dismissGuidedPopover(page)
    const row = page.locator('.workbench')
    const height = async () => Math.round((await row.boundingBox())!.height)
    // Let the lazy 3D view (or its 2D fallback) settle before the baseline measurement.
    await page.waitForTimeout(1000)
    const before = await height()
    const summaries = page.getByRole('complementary', { name: 'The challenge' }).locator('details > summary')
    expect(await summaries.count()).toBeGreaterThan(0)
    for (let i = 0; i < await summaries.count(); i++) {
      await summaries.nth(i).click()
      await expect.poll(height).toBeGreaterThanOrEqual(before)
      await summaries.nth(i).click()
      await expect.poll(height).toBeLessThanOrEqual(before + 1)
    }
  })
}

test('Guided: the step popover is visible on entry; after Close the chip remains and the challenge disclosures are clickable', async ({ page }) => {
  await enter(page, 'Cantilever Beam I', 'Guided')
  const guide = page.getByRole('region', { name: 'Guided experiments' })
  const chip = guide.getByRole('button', { name: /^Step \d+ of \d+:/ })
  const popover = page.locator('.guided-popover')
  await expect(chip).toBeVisible()
  await expect(popover).toBeVisible()
  await expect(chip).toHaveAttribute('aria-expanded', 'true')
  await popover.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(popover).toBeHidden()
  await expect(chip).toBeVisible()
  await expect(chip).toHaveAttribute('aria-expanded', 'false')
  // The challenge-column disclosure can now be clicked and opens.
  const more = page.getByRole('complementary', { name: 'The challenge' }).locator('details > summary').first()
  await more.click()
  await expect(more.locator('xpath=..')).toHaveAttribute('open', '')
  // The chip reopens the popover.
  await chip.click()
  await expect(popover).toBeVisible()
})

test('Parametric: there is no Guided chip or popover', async ({ page }) => {
  await enter(page, 'Cantilever Beam I', 'Parametric')
  await expect(page.getByRole('region', { name: 'Guided experiments' })).toHaveCount(0)
  await expect(page.locator('.guided-popover')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Step \d+ of \d+:/ })).toHaveCount(0)
})
