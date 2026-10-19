import { expect, test } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'

// Task 61 (owner feedback): opening a disclosure in the challenge panel may grow the workbench
// row, but closing it must return the row to its original height. The 3D canvas used to keep the
// taller pixel height and hold the row open.

const NAMES = ['Cantilever Beam I', 'Mounting Bracket I', 'Torsion Shaft I', 'Heat Sink I', 'Braced Frame I', 'Vibration Isolation I']

for (const name of NAMES) {
  test(`${name}: closing a challenge-panel disclosure restores the workbench height`, async ({ page }) => {
    test.skip(!catalog.find((e) => e.title === name)?.available, `${name} is not active`)
    await page.goto('/#challenges')
    await page.getByRole('button', { name: `View ${name}`, exact: true }).click()
    await page.getByRole('dialog', { name, exact: true }).getByRole('button', { name: /^(Open|Continue) challenge$/ }).click()
    await expect(page.getByRole('button', { name: 'Run Test', exact: true })).toBeVisible()
    const row = page.locator('.workbench')
    const height = async () => Math.round((await row.boundingBox())!.height)
    // Let the lazy 3D view (or its 2D fallback) settle before the baseline measurement.
    await page.waitForTimeout(1000)
    const before = await height()
    const summaries = page.getByRole('complementary', { name: 'The challenge' }).locator('details > summary')
    for (let i = 0; i < await summaries.count(); i++) {
      await summaries.nth(i).click()
      await expect.poll(height).toBeGreaterThanOrEqual(before)
      await summaries.nth(i).click()
      await expect.poll(height).toBeLessThanOrEqual(before + 1)
    }
  })
}
