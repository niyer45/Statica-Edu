import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { audit, normalizeState, openWorkbench, readState, recordOtherOrigins, referenceDesign, runTest } from './helpers'

test('responsive layout preserves state across breakpoints and has no horizontal overflow', async ({ page }) => {
  await openWorkbench(page)
  await referenceDesign(page)
  await runTest(page)
  const before = normalizeState(await readState(page))
  for (const width of [1280, 1000, 800, 375, 320, 1280]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(normalizeState(await readState(page))).toEqual(before)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const design = await page.getByRole('region', { name: 'Design tools' }).boundingBox()
    const viewport = await page.getByRole('region', { name: 'Design view' }).boundingBox()
    const challenge = await page.getByRole('complementary', { name: 'The challenge' }).boundingBox()
    if (!design || !viewport || !challenge) throw new Error('Workbench regions missing')
    if (width > 870) expect(challenge.x).toBeGreaterThan(viewport.x)
    else if (width > 620) expect(challenge.y).toBeGreaterThan(design.y)
    else expect(design.y).toBeGreaterThan(viewport.y)
    await audit(page)
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
  await fallback.goto('http://127.0.0.1:4174')
  await openWorkbench(fallback, false)
  await expect(fallback.locator('canvas')).toHaveCount(0)
  await referenceDesign(fallback)
  await runTest(fallback)
  expect(normalizeState(await readState(fallback))).toEqual(expected)
  await audit(fallback)
  await context.close()
})

test('production obeys CSP, makes no other-origin requests, and exposes no state hook', async ({ page }) => {
  const other = recordOtherOrigins(page, 'http://127.0.0.1:4173')
  const csp: string[] = []
  page.on('console', (message) => { if (/content security policy|violates.*directive/i.test(message.text())) csp.push(message.text()) })
  await page.goto('http://127.0.0.1:4173')
  await openWorkbench(page, false)
  await referenceDesign(page)
  await runTest(page)
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

test('preview challenges and Freeform cannot open a workbench', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'View Cantilever Beam I', exact: true }).click()
  await page.getByRole('dialog', { name: 'Cantilever Beam I', exact: true }).getByRole('button', { name: /Freeform/ }).click()
  await expect(page.getByRole('button', { name: 'Not available yet', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Close challenge details' }).click()
  const previews = page.locator('.challenge-card').filter({ hasText: 'Concept preview' })
  const preview = previews.first().locator('.card-art')
  await preview.click()
  await expect(page.getByRole('button', { name: 'Not available yet', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Run Test', exact: true })).not.toBeVisible()
  await audit(page)
})
