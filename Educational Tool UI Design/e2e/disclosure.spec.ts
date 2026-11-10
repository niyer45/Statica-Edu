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
    const summaries = page.locator('.challenge-band details > summary, aside[aria-label="Checks"] details > summary')
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
  const more = page.locator('.challenge-band details > summary').first()
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

// Task 78.2 (WD-20–WD-23): the challenge band is the first workbench content, uncovered by the
// Guided popover, and its disclosure works with the popover still open.
for (const mode of ['Guided', 'Parametric'] as const) {
  for (const name of NAMES) {
    test(`${name} (${mode}): the challenge band is first, shows the goal line and one visible sentence`, async ({ page }) => {
      test.skip(!catalog.find((e) => e.title === name)?.available, `${name} is not active`)
      const entry = catalog.find((e) => e.title === name)!
      await enter(page, name, mode)
      const band = page.getByRole('region', { name: 'The challenge', exact: true })
      await expect(band).toBeVisible()
      await expect(band.getByRole('heading', { level: 2, name: 'The challenge' })).toBeVisible()
      await expect(band.locator('.challenge-goal')).toHaveText(entry.description)
      await expect(band.locator('> p:not(.challenge-goal)')).toBeVisible()
      await expect(page.getByRole('complementary', { name: 'Checks', exact: true })).toBeVisible()
      // DOM order: title, band, then the About row and the design tools.
      const order = await page.evaluate(() => {
        const follows = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        const bandEl = document.querySelector('.challenge-band')!
        return [
          follows(document.querySelector('h1')!, bandEl),
          follows(bandEl, document.querySelector('.about-model')!),
          follows(bandEl, document.querySelector('.design-panel')!),
          document.querySelectorAll('.challenge-band').length === 1,
        ]
      })
      expect(order).toEqual([true, true, true, true])
      // Full width above 870 px: the band spans the workbench row and sits above it.
      const bandBox = (await band.boundingBox())!
      const rowBox = (await page.locator('.workbench').boundingBox())!
      expect(bandBox.width).toBeGreaterThanOrEqual(rowBox.width - 2)
      expect(bandBox.y + bandBox.height).toBeLessThanOrEqual(rowBox.y)
      if (mode === 'Guided') {
        // The popover is open on entry and does not cover the band.
        const popover = page.locator('.guided-popover')
        await expect(popover).toBeVisible()
        const p = (await popover.boundingBox())!
        expect(p.y).toBeGreaterThanOrEqual(bandBox.y + bandBox.height - 1)
        const more = band.getByText('More about this challenge', { exact: true })
        if (await more.count() > 0) {
          await more.click()
          await expect(band.locator('details')).toHaveAttribute('open', '')
        }
      }
    })
  }
}
