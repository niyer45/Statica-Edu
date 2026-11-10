import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { dismissGuidedPopover } from './helpers'

// Task 61 (owner feedback): opening a disclosure in the challenge panel may grow the workbench
// row, but closing it must return the row to its original height. The 3D canvas used to keep the
// taller pixel height and hold the row open.
// Task 78: all ten challenges, in Guided (where the step popover is dismissed first, WD-11) and
// the popover behaviour itself. Task 78.3: the steps are a stepper row; About sits at the bottom.

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
    // The auto-opened Guided step popover is in flow above the workbench and pushes it down;
    // dismiss it explicitly (WD-11) so the measurements start from the settled layout.
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

test('Guided: the step popover is visible on entry; after Close the current step remains and the challenge disclosures are clickable', async ({ page }) => {
  await enter(page, 'Cantilever Beam I', 'Guided')
  const stepper = page.getByRole('navigation', { name: 'Guided steps' })
  const current = stepper.getByRole('button', { name: /, current step$/ })
  const popover = page.locator('.guided-popover')
  await expect(current).toBeVisible()
  await expect(popover).toBeVisible()
  await expect(current).toHaveAttribute('aria-expanded', 'true')
  await popover.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(popover).toBeHidden()
  await expect(current).toBeVisible()
  await expect(current).toHaveAttribute('aria-expanded', 'false')
  // The challenge band disclosure can now be clicked and opens.
  const more = page.locator('.challenge-band details > summary').first()
  await more.click()
  await expect(more.locator('xpath=..')).toHaveAttribute('open', '')
  // The current step reopens the popover; the lock line is inside it.
  await current.click()
  await expect(popover).toBeVisible()
  await expect(popover.locator('#guided-lock-line')).toContainText('Locked in this step: everything except diameter.')
  // No "Step N of M" chip any more.
  await expect(page.getByText(/Step \d+ of \d+/)).toHaveCount(0)
})

test('Parametric: there is no stepper row or popover', async ({ page }) => {
  await enter(page, 'Cantilever Beam I', 'Parametric')
  await expect(page.getByRole('region', { name: 'Guided experiments' })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Guided steps' })).toHaveCount(0)
  await expect(page.locator('.guided-popover')).toHaveCount(0)
  await expect(page.locator('.guided-stepper')).toHaveCount(0)
})

// Task 78.3 (WD-30–WD-33): the stepper row shows each challenge's real Guided steps between the band
// and the workbench, with state text, one tab stop and no horizontal overflow at 320 px.
for (const name of NAMES) {
  test(`${name} (Guided): the stepper row sits between the band and the workbench with state text`, async ({ page }) => {
    test.skip(!catalog.find((e) => e.title === name)?.available, `${name} is not active`)
    await enter(page, name, 'Guided')
    const stepper = page.getByRole('navigation', { name: 'Guided steps' })
    await expect(stepper).toBeVisible()
    const items = stepper.getByRole('listitem')
    expect(await items.count()).toBeGreaterThanOrEqual(3)
    await expect(items.first().locator('.sr-only')).toHaveText(', current step')
    await expect(stepper.locator('li[aria-current="step"]')).toHaveCount(1)
    await expect(stepper.locator('li.locked .sr-only').first()).toHaveText(', locked')
    // The row adds exactly one tab stop and it is the current step.
    await expect(stepper.locator('button')).toHaveCount(1)
    // Vertical order: band, stepper, workbench, results, About row.
    const tops = await page.evaluate(() => ['.challenge-band', '.guided-stepper', '.workbench', '.results-panel', '.workspace-context'].map((sel) => {
      const r = document.querySelector(sel)!.getBoundingClientRect()
      return [r.top + window.scrollY, r.bottom + window.scrollY]
    }))
    for (let i = 0; i < tops.length - 1; i++) expect(tops[i]![1], `region ${i} ends before region ${i + 1}`).toBeLessThanOrEqual(tops[i + 1]![0] + 1)
  })
}

test('Column Buckling I (Guided, the longest step titles): the stepper does not overflow horizontally at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await enter(page, 'Column Buckling I', 'Guided')
  const stepper = page.getByRole('navigation', { name: 'Guided steps' })
  await expect(stepper).toBeVisible()
  await expect(stepper.getByRole('listitem')).toHaveCount(5)
  const overflow = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, stepper: (document.querySelector('.guided-stepper') as HTMLElement).scrollWidth, stepperClient: (document.querySelector('.guided-stepper') as HTMLElement).clientWidth }))
  expect(overflow.doc, 'document horizontal overflow at 320px').toBeLessThanOrEqual(320)
  expect(overflow.stepper, 'stepper content fits its box').toBeLessThanOrEqual(overflow.stepperClient)
  // Every step label is fully inside the viewport.
  const rights = await stepper.locator('.guided-step-label').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right))
  for (const r of rights) expect(r).toBeLessThanOrEqual(320)
})

// Task 78.3 (WD-35): the "Guided mode / About this model" row is at the bottom, below the results and
// above the limits footer, in both modes.
for (const mode of ['Guided', 'Parametric'] as const) {
  test(`${mode}: About this model sits at the bottom, after the results and before the footer`, async ({ page }) => {
    await enter(page, 'Cantilever Beam I', mode)
    const about = page.locator('.workspace-context')
    await expect(about).toContainText(`${mode} mode`)
    const order = await page.evaluate(() => {
      const follows = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      const about = document.querySelector('.workspace-context')!
      return [follows(document.querySelector('.results-panel')!, about), follows(about, document.querySelector('.page-footer')!)]
    })
    expect(order).toEqual([true, true])
    await about.locator('summary').click()
    await expect(about.locator('.ei-disclosure-body p').first()).toBeVisible()
  })
}

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
      // DOM order: title, band, stepper (Guided only), design tools, results, About row, footer.
      const order = await page.evaluate(() => {
        const follows = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        const bandEl = document.querySelector('.challenge-band')!
        const stepper = document.querySelector('.guided-stepper')
        const chain = [document.querySelector('h1')!, bandEl, ...(stepper === null ? [] : [stepper]), document.querySelector('.design-panel')!, document.querySelector('.results-panel')!, document.querySelector('.about-model')!, document.querySelector('.page-footer')!]
        return [...chain.slice(0, -1).map((el, i) => follows(el, chain[i + 1]!)), document.querySelectorAll('.challenge-band').length === 1, (stepper !== null) === (document.querySelector('.guided-popover') !== null)]
      })
      expect(order.every(Boolean), JSON.stringify(order)).toBe(true)
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
