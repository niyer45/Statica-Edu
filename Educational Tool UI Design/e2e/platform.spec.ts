import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { audit, normalizeState, openWorkbench, readState, recordOtherOrigins, referenceDesign, runTest } from './helpers'
import { DEV_URL, PREVIEW_URL } from '../playwright.config'

test('responsive layout preserves state across breakpoints and has no horizontal overflow', async ({ page }) => {
  test.setTimeout(90_000) // Both sides of every layout boundary plus five axe audits.
  await openWorkbench(page)
  await referenceDesign(page)
  await runTest(page)
  await page.getByRole('tab', { name: 'Compare results' }).click()
  const field = page.locator('#dim-heightM')
  await field.fill('61') // uncommitted input must survive layout changes too
  const before = normalizeState(await readState(page))
  for (const width of [1280, 1051, 1050, 1000, 871, 870, 800, 621, 620, 375, 320, 620, 621, 870, 871, 1050, 1051, 1280]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(normalizeState(await readState(page))).toEqual(before)
    await expect(field).toHaveValue('61')
    await expect(page.getByRole('tab', { name: 'Compare results' })).toHaveAttribute('aria-selected', 'true')
    const sidebar = page.locator('.platform-sidebar')
    if (width <= 620) await expect(sidebar).toBeHidden()
    else {
      await expect(sidebar).toBeVisible()
      const bounds = await sidebar.boundingBox()
      if (width <= 1050) expect(bounds?.width).toBe(72)
      else expect(bounds!.width).toBeGreaterThan(72)
    }
    const layout = await page.evaluate(() => ({
      width: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowing: Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((element) => {
        const box = element.getBoundingClientRect()
        return box.width > 0 && box.right > window.innerWidth
      }).slice(0, 15).map((element) => ({
        tag: element.tagName, class: element.getAttribute('class'),
        right: element.getBoundingClientRect().right,
        minWidth: getComputedStyle(element).minWidth,
        columns: getComputedStyle(element).gridTemplateColumns,
      })),
    }))
    expect(layout.scrollWidth, JSON.stringify({ requestedWidth: width, ...layout })).toBeLessThanOrEqual(width)
    const design = await page.getByRole('region', { name: 'Design tools' }).boundingBox()
    const viewport = await page.getByRole('region', { name: 'Design view' }).boundingBox()
    const challenge = await page.getByRole('complementary', { name: 'The challenge' }).boundingBox()
    if (!design || !viewport || !challenge) throw new Error('Workbench regions missing')
    for (const input of await page.locator('.design-panel input:not([type="range"])').all()) {
      const box = await input.boundingBox()
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(design.x)
        expect(box.x + box.width, `Clipped design input at ${width}px`).toBeLessThanOrEqual(design.x + design.width)
      }
    }
    if (width > 870) expect(challenge.x).toBeGreaterThan(viewport.x)
    else if (width > 620) expect(challenge.y).toBeGreaterThan(design.y)
    else expect(design.y).toBeGreaterThan(viewport.y)
    if ([1280, 1000, 800, 375, 320].includes(width)) await audit(page)
  }
})

test('WebGL-disabled flow reaches the same normalized session as the 3D flow', async ({ page, browser }) => {
  await openWorkbench(page)
  await referenceDesign(page)
  await runTest(page)
  const expected = normalizeState(await readState(page))
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  await context.addInitScript(() => { Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: undefined }) })
  const fallback = await context.newPage()
  await fallback.goto(`${DEV_URL}/#challenges`)
  await openWorkbench(fallback, false, false, 'Parametric')
  await expect(fallback.locator('canvas')).toHaveCount(0)
  await referenceDesign(fallback)
  await runTest(fallback)
  expect(normalizeState(await readState(fallback))).toEqual(expected)
  await audit(fallback)
  await context.close()
})

test('production obeys CSP, makes no other-origin requests, and exposes no state hook', async ({ page }) => {
  const other = recordOtherOrigins(page, PREVIEW_URL)
  const csp: string[] = []
  page.on('console', (message) => { if (/content security policy|violates.*directive/i.test(message.text())) csp.push(message.text()) })
  await page.goto(`${PREVIEW_URL}/#challenges`)
  await openWorkbench(page, false, false, 'Parametric')
  await referenceDesign(page)
  await runTest(page)
  // Task 65: reference formulas typeset with KaTeX (lazy chunk, self-hosted fonts) under the CSP.
  await page.getByRole('button', { name: /Section stiffness reference/ }).click()
  const reference = page.getByRole('dialog', { name: 'Section stiffness' })
  await expect(reference.locator('.katex .mfrac')).toHaveCount(1)
  await expect(reference.locator('.katex math')).toHaveCount(1)
  expect(await page.evaluate(async () => (await document.fonts.ready, document.fonts.check('16px KaTeX_Main')))).toBe(true)
  await audit(page)
  await reference.getByRole('button', { name: 'Back to design' }).click()
  await page.getByRole('button', { name: 'Explain & submit' }).click()
  await page.getByRole('dialog', { name: 'Explain & submit', exact: true }).getByRole('textbox').fill('Production flow with stored results.')
  await page.getByRole('button', { name: 'Submit design & reflection' }).click()
  await expect(page.getByLabel('Recorded submission')).toContainText('Accepted')
  await audit(page)
  expect(await page.evaluate(() => window.__EI_STATE__)).toBeUndefined()
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', "default-src 'self'")
  expect(csp).toEqual([])
  expect(other).toEqual([])
  const assets = path.resolve('dist/assets')
  const built = readFileSync('dist/index.html', 'utf8') + readdirSync(assets).filter((name) => name.endsWith('.css')).map((name) => readFileSync(path.join(assets, name), 'utf8')).join('')
  expect(built).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/)
})

test('Freeform cannot open a workbench, and every catalog challenge is runnable', async ({ page }) => {
  await page.goto('/#challenges')
  await page.getByRole('button', { name: 'View Cantilever Beam I', exact: true }).click()
  await page.getByRole('dialog', { name: 'Cantilever Beam I', exact: true }).getByRole('button', { name: /Freeform/ }).click()
  await expect(page.getByRole('button', { name: 'Not available yet', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Run Test', exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: 'Close challenge details' }).click()
  // All six original challenges are activated (D-42, D-43, D-44), plus Column Buckling I (D-58):
  // no card remains a concept preview.
  await expect(page.locator('.challenge-card')).toHaveCount(7)
  await expect(page.locator('.challenge-card').filter({ hasText: 'Concept preview' })).toHaveCount(0)
  await audit(page)
})
