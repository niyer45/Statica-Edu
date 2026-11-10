import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { audit, closeStepDialog, readState, stepDialog } from './helpers'

// Task 61 (owner feedback): opening a disclosure in the challenge panel may grow the workbench
// row, but closing it must return the row to its original height. The 3D canvas used to keep the
// taller pixel height and hold the row open.
// Task 78: all ten challenges, in Guided (where the step dialog is closed first, task 78.4) and
// the dialog behaviour itself. Task 78.3: the steps are a stepper row; About sits at the bottom.

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
    // The Guided step dialog opens on entry and blocks the page (WD-40); close it before measuring.
    await closeStepDialog(page)
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

test('Guided: the step dialog is open and modal on entry; the page behind is blocked; "Got it" closes it and the step name reopens it', async ({ page }) => {
  await enter(page, 'Cantilever Beam I', 'Guided')
  const stepper = page.getByRole('navigation', { name: 'Guided steps' })
  const current = stepper.getByRole('button', { name: /, current step$/ })
  const dialog = stepDialog(page)
  await expect(current).toBeVisible()
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAccessibleName('Step 1 of 4: Grow the circle')
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(dialog.getByRole('heading', { name: 'Grow the circle' })).toBeVisible()
  await expect(dialog.getByText('Editable now:')).toBeVisible()
  await expect(dialog.locator('#guided-lock-line')).toContainText('Locked in this step: everything except diameter.')
  await expect(dialog.getByText('Hint', { exact: true })).toBeVisible()
  await expect(dialog.locator('details')).not.toHaveAttribute('open', '')
  await expect(current).toHaveAttribute('aria-haspopup', 'dialog')
  await expect(current).not.toHaveAttribute('aria-expanded', /.*/)
  // Focus starts inside the dialog (its Close button, like every other dialog).
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  // The dialog is centred and sits over the whole app: the page behind is not clickable.
  const box = (await dialog.boundingBox())!
  const view = page.viewportSize()!
  expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThanOrEqual(2)
  expect(box.y).toBeGreaterThanOrEqual(0)
  const runTest = page.getByRole('button', { name: 'Run Test', exact: true })
  await runTest.scrollIntoViewIfNeeded()
  const target = (await runTest.boundingBox())!
  const covered = await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('.modal-backdrop'), [target.x + target.width / 2, target.y + target.height / 2])
  expect(covered, 'the backdrop covers Run Test').toBe(true)
  await expect(runTest.click({ timeout: 1500 })).rejects.toThrow()
  await expect(dialog).toBeVisible()
  expect((await readState(page)).history).toHaveLength(1)
  // Focus stays trapped inside while Tab is pressed repeatedly.
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true)
  // axe audit with the dialog open.
  await audit(page)
  // "Got it" closes it, focus returns to the step button, and the workbench is usable.
  await dialog.getByRole('button', { name: 'Got it', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(current).toBeFocused()
  const more = page.locator('.challenge-band details > summary').first()
  await more.click()
  await expect(more.locator('xpath=..')).toHaveAttribute('open', '')
  // The step name reopens it; Escape closes it again and focus returns to the step button.
  await current.click()
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('#guided-lock-line')).toContainText('Locked in this step: everything except diameter.')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(current).toBeFocused()
  // No "Step N of M" chip in the page, and no failed-attempt line without an attempt.
  await expect(page.getByText(/Step \d+ of \d+/)).toHaveCount(0)
  await expect(page.locator('.guided-feedback')).toHaveCount(0)
})

test('Guided: nothing is pushed down; the workbench starts below the stepper exactly as far below the band as in Parametric', async ({ page }) => {
  const top = async () => Math.round((await page.locator('.workbench').boundingBox())!.y + await page.evaluate(() => window.scrollY))
  await enter(page, 'Cantilever Beam I', 'Guided')
  await page.waitForTimeout(1000)
  const whileOpen = await top()
  await closeStepDialog(page)
  expect(await top(), 'closing the dialog does not move the workbench').toBe(whileOpen)
  const stepperBlock = await page.evaluate(() => {
    const el = document.querySelector('.guided-instructions') as HTMLElement
    return el.getBoundingClientRect().height + parseFloat(getComputedStyle(el).marginBottom)
  })
  await enter(page, 'Cantilever Beam I', 'Parametric')
  await page.waitForTimeout(1000)
  expect(Math.abs(whileOpen - await top() - stepperBlock), 'the only extra height in Guided is the stepper row').toBeLessThanOrEqual(2)
})

test('Guided: a failed attempt shows one feedback line under the stepper and does not reopen the dialog', async ({ page }) => {
  await enter(page, 'Cantilever Beam I', 'Guided')
  await closeStepDialog(page)
  await expect(page.locator('.guided-feedback')).toHaveCount(0)
  // Re-testing the unchanged Baseline does not meet "grow the circle".
  await page.getByRole('button', { name: 'Run Test', exact: true }).click()
  const prediction = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Run structural test' }) })
  if (await prediction.isVisible()) {
    await prediction.getByLabel('Decrease', { exact: true }).check()
    await prediction.getByRole('button', { name: 'Run structural test' }).click()
    await expect(prediction).toBeHidden()
  }
  const line = page.locator('.guided-feedback')
  await expect(line).toHaveText(/^Iteration \d+ did not complete this step yet\. Change only diameter as asked, then Run Test\.$/)
  await expect(stepDialog(page)).toHaveCount(0)
  await expect(line.locator('xpath=preceding-sibling::*[1]')).toHaveAttribute('aria-label', 'Guided steps')
  // The same line is inside the dialog when it is reopened.
  await page.getByRole('navigation', { name: 'Guided steps' }).getByRole('button').click()
  await expect(stepDialog(page).getByText(/did not complete this step yet/)).toBeVisible()
})

test('Parametric: there is no stepper row and no step dialog', async ({ page }) => {
  await enter(page, 'Cantilever Beam I', 'Parametric')
  await expect(page.getByRole('region', { name: 'Guided experiments' })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Guided steps' })).toHaveCount(0)
  await expect(stepDialog(page)).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
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
    await closeStepDialog(page) // a no-op in Parametric
    await about.locator('summary').click()
    await expect(about.locator('.ei-disclosure-body p').first()).toBeVisible()
  })
}

// Task 78.2 (WD-20–WD-23): the challenge band is the first workbench content, and its disclosure
// works once the Guided step dialog (open on entry, task 78.4) is closed.
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
        return [...chain.slice(0, -1).map((el, i) => follows(el, chain[i + 1]!)), document.querySelectorAll('.challenge-band').length === 1, (stepper !== null) === (document.querySelector('[role="dialog"][data-dialog-kind="guided-step"]') !== null)]
      })
      expect(order.every(Boolean), JSON.stringify(order)).toBe(true)
      // Full width above 870 px: the band spans the workbench row and sits above it.
      const bandBox = (await band.boundingBox())!
      const rowBox = (await page.locator('.workbench').boundingBox())!
      expect(bandBox.width).toBeGreaterThanOrEqual(rowBox.width - 2)
      expect(bandBox.y + bandBox.height).toBeLessThanOrEqual(rowBox.y)
      if (mode === 'Guided') {
        // The step dialog is open on entry; close it, then the band's disclosure is usable.
        await closeStepDialog(page)
        const more = band.getByText('More about this challenge', { exact: true })
        if (await more.count() > 0) {
          await more.click()
          await expect(band.locator('details')).toHaveAttribute('open', '')
        }
      }
    })
  }
}
