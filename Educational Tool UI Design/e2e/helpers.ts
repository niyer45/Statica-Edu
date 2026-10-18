import { expect, type Locator, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { OrthographicCamera, Vector3 } from 'three'
import type { SessionState } from '../src/state/session'
import { handlesFor } from '../src/geometry/handles'
import type { SectionParam } from '../src/geometry/params'
import { localToGlobalYZ } from '../src/ui/viewport/sceneLayout'
import { readFileSync } from 'node:fs'
import { loadChallenge } from '../src/challenge/loader'
const bundledChallengeResult = loadChallenge(JSON.parse(readFileSync(new URL('../src/challenge/challenges/cantilever-beam-1.json', import.meta.url), 'utf8')))

/** Reach controls using the real document tab order, including off-screen controls. */
export async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 100; i++) {
    if (await target.evaluate((element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`Control not reachable by Tab: ${await target.getAttribute('aria-label') ?? await target.textContent()}`)
}
export async function openWorkbench(page: Page, navigate = true, keyboard = false) {
  if (navigate) await page.goto('/#challenges')
  const open = page.getByRole('button', { name: /^(Open|Continue) challenge$/ }).first()
  if (keyboard) { await tabTo(page, open); await page.keyboard.press('Enter') }
  else await open.click()
  await expect(page.getByRole('button', { name: 'Run Test', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible()
}
export async function readState(page: Page): Promise<SessionState> {
  await page.waitForFunction(() => window.__EI_STATE__ !== undefined)
  return page.evaluate(() => structuredClone(window.__EI_STATE__) as SessionState)
}
/** Stable identifiers retain their relationships while generated ids and all timestamps drop. */
export function normalizeState(state: SessionState): unknown {
  const ids = new Map(state.history.map((r, i) => [r.id, `result-${i}`]))
  return JSON.parse(JSON.stringify(state, (key, value: unknown) => {
    if (['id', 'timestamp', 'createdAt', 'submittedAt'].includes(key)) return undefined
    if (key === 'testResultId' && typeof value === 'string') return ids.get(value)
    if (key === 'compareSelection' && Array.isArray(value)) return value.map((id) => ids.get(id))
    return value
  }))
}
export function recordOtherOrigins(page: Page, origin: string) {
  const requests: string[] = []
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) requests.push(request.url())
  })
  return requests
}
export async function audit(page: Page) {
  const result = await new AxeBuilder({ page }).analyze()
  expect(result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
}
export async function setDimension(page: Page, param: SectionParam, value: string, keyboard = false) {
  const field = page.locator(`#dim-${param}`)
  await field.scrollIntoViewIfNeeded()
  if (keyboard) { await tabTo(page, field); await field.press('ControlOrMeta+A'); await field.pressSequentially(value) }
  else await field.fill(value)
  await field.press('Enter')
  await expect(field).not.toHaveAttribute('aria-invalid', 'true')
}
export async function runTest(page: Page, keyboard = false) {
  const button = page.getByRole('button', { name: 'Run Test', exact: true })
  if (keyboard) { await tabTo(page, button); await button.press('Enter') } else await button.click()
  const dialog = page.getByRole('dialog', { name: 'Predict deflection' })
  if (await dialog.isVisible()) {
    const radio = dialog.getByLabel('Decrease', { exact: true })
    if (keyboard) { await tabTo(page, radio); await radio.press('Space') } else await radio.check()
    const confirm = dialog.getByRole('button', { name: 'Run structural test' })
    if (keyboard) { await tabTo(page, confirm); await confirm.press('Enter') } else await confirm.click()
    await expect(dialog).not.toBeVisible()
  }
}
export async function referenceDesign(page: Page, keyboard = false) {
  const tile = page.getByRole('button', { name: /I-section/ }).filter({ has: page.locator('svg') }).first()
  if (keyboard) { await tabTo(page, tile); await tile.press('Enter') } else await tile.click()
  for (const [param, value] of [['heightM', '60'], ['widthM', '40'], ['flangeThicknessM', '4'], ['webThicknessM', '3']] as const) await setDimension(page, param, value, keyboard)
}
/** Use the same default camera framing as BeamView, without inspecting renderer internals. */
export async function projectScenePoint(page: Page, pointM: [number, number, number]) {
  const state = await readState(page)
  const canvas = page.getByRole('img', { name: '3D beam view', exact: true })
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('No 3D canvas bounds')
  const L = state.draft.lengthM
  const camera = new OrthographicCamera(-box.width / 2, box.width / 2, box.height / 2, -box.height / 2, 0.001, 20)
  camera.position.set(L / 2 + 0.85, 0.5, 1)
  camera.lookAt(L / 2, -0.025, 0)
  camera.zoom = Math.min(box.width, box.height) / (2.2 * Math.hypot(L / 2 + 0.09, 0.29, 0.15))
  camera.updateProjectionMatrix(); camera.updateMatrixWorld()
  const point = new Vector3(...pointM).project(camera)
  return { x: box.x + (point.x + 1) * box.width / 2, y: box.y + (1 - point.y) * box.height / 2 }
}
/** Project the actual descriptor through the documented default orthographic camera. */
export async function dragHeightHandle(page: Page) {
  if (!bundledChallengeResult.ok) throw new Error('Invalid challenge')
  const state = await readState(page)
  const handle = handlesFor(state.draft.section, state.draft.orientationDeg, bundledChallengeResult.value.sectionLimits).find((h) => h.param === 'heightM')!
  const { y, z } = localToGlobalYZ(handle.anchorM.u, handle.anchorM.v, state.draft.orientationDeg)
  const { x, y: top } = await projectScenePoint(page, [state.draft.lengthM + 0.004, y, z])
  await page.mouse.move(x, top)
  await page.mouse.down()
  await expect(page.getByTestId('dimension-feedback')).toContainText('Height')
  await page.mouse.move(x, top - 15, { steps: 10 })
  await expect.poll(async () => (await readState(page)).draft.section).not.toEqual(state.draft.section)
  await page.mouse.up()
}
