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
/**
 * Opens Cantilever Beam I (closing the Guided step dialog, see `closeStepDialog`). With `mode`, the mode is chosen in the challenge drawer before entry
 * (D-37); a fresh navigation defaults to Parametric, the open-design mode the generic learning-loop
 * specs need (Guided locks parameters by step, task 58). Without `mode` (a reload), the featured
 * Open/Continue button reopens the saved session in its own mode.
 */
export async function openWorkbench(page: Page, navigate = true, keyboard = false, mode: 'Guided' | 'Parametric' | undefined = navigate ? 'Parametric' : undefined, closeDialog = true) {
  if (navigate) await page.goto('/#challenges')
  const press = async (target: Locator) => {
    if (keyboard) { await tabTo(page, target); await page.keyboard.press('Enter') }
    else await target.click()
  }
  if (mode !== undefined) {
    await press(page.getByRole('button', { name: 'View Cantilever Beam I', exact: true }))
    const drawer = page.getByRole('dialog', { name: 'Cantilever Beam I', exact: true })
    await press(drawer.getByRole('button', { name: new RegExp(`^${mode}`) }))
    await press(drawer.getByRole('button', { name: /^(Open|Continue) challenge$/ }))
  } else {
    await press(page.getByRole('button', { name: /^(Open|Continue) challenge$/ }).first())
  }
  await expect(page.getByRole('button', { name: 'Run Test', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible()
  // A Guided challenge opens its step dialog on every entry and reload (task 78.4): assert it, then close it.
  // A no-op in Parametric. Pass `closeDialog = false` to assert the dialog yourself.
  if (closeDialog) await closeStepDialog(page, keyboard)
}

/** Clicks Run Test and answers the prediction checkpoint if this iteration requires one. */
export async function runAnyTest(page: Page, keyboard = false) {
  const button = page.getByRole('button', { name: 'Run Test', exact: true })
  const before = (await readState(page)).history.length
  if (keyboard) { await tabTo(page, button); await button.press('Enter') } else await button.click()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Run structural test' }) })
  if (await dialog.isVisible()) {
    const radio = dialog.getByLabel('Decrease', { exact: true })
    if (keyboard) { await tabTo(page, radio); await radio.press('Space') } else await radio.check()
    const confirm = dialog.getByRole('button', { name: 'Run structural test' })
    if (keyboard) { await tabTo(page, confirm); await confirm.press('Enter') } else await confirm.click()
    await expect(dialog).toBeHidden()
  }
  await expect.poll(async () => (await readState(page)).history.length).toBe(before + 1)
}

/**
 * Asserts the current Guided experiment step by its title (task 78.3). The stepper row is a `nav`
 * named "Guided steps"; its current step is the one button, named "<title>, current step", inside
 * the list item marked `aria-current="step"`. It is visible whether or not the step dialog is open.
 */
export async function expectGuidedStep(page: Page, title: string) {
  // The label and the sr-only ", current step" are separate flex items, so the computed name has a space before the comma.
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const current = page.getByRole('navigation', { name: 'Guided steps' }).getByRole('button', { name: new RegExp(`^${escaped}\\s*, current step$`) })
  await expect(current).toBeVisible()
  await expect(current.locator('xpath=..')).toHaveAttribute('aria-current', 'step')
}

/** The Guided step dialog (task 78.4): "Step N of M: <title>", or "All N steps complete" at the end. */
export function stepDialog(page: Page) {
  return page.getByRole('dialog', { name: /^(Step \d+ of \d+: .+|All \d+ steps complete)$/ })
}

/**
 * The dialog opens on a timer (0.8 s after entry, 1.5 s after a step change, task 78.5) and, on a loaded
 * CI runner, only after the main thread has finished rendering the test result (seen to take 6-8 s
 * per action). Waiting for it is waiting on an explicit signal (the dialog is visible), so the bound
 * is generous: a dialog that never opens still fails, just later.
 */
export const STEP_DIALOG_OPEN_TIMEOUT = 30_000

/** Waits for the Guided step dialog to open by itself (entry, reload or a step change). */
export async function expectStepDialogOpen(page: Page) {
  await expect(stepDialog(page)).toBeVisible({ timeout: STEP_DIALOG_OPEN_TIMEOUT })
}

/**
 * Waits for the Guided step dialog (it opens on entry, on reload and on every step change), asserts it
 * is visible, then closes it: with "Got it", or by keyboard (Escape) when `keyboard` is set, and asserts
 * that focus returns to the current step button of the stepper. A no-op in Parametric (no stepper, no
 * dialog). Replaces `dismissGuidedPopover` (task 78.4).
 */
export async function closeStepDialog(page: Page, keyboard = false) {
  const nav = page.getByRole('navigation', { name: 'Guided steps' })
  if (await nav.count() === 0) return
  const dialog = stepDialog(page)
  await expectStepDialogOpen(page)
  if (keyboard) await page.keyboard.press('Escape')
  else await dialog.getByRole('button', { name: 'Got it', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(nav.getByRole('button')).toBeFocused()
}

/** With every step met the step dialog shows "All experiments complete"; asserts that, then closes it. */
export async function expectAllStepsComplete(page: Page, keyboard = false) {
  await expect(stepDialog(page).getByRole('heading', { name: 'All experiments complete' })).toBeVisible({ timeout: STEP_DIALOG_OPEN_TIMEOUT })
  await closeStepDialog(page, keyboard)
  await expect(page.getByRole('navigation', { name: 'Guided steps' }).getByRole('button', { name: /^All \d+ steps complete$/ })).toBeVisible()
}

/** Opens the collapsed "About this model" disclosure, which sits at the bottom of the workbench (task 78.3, WD-35). */
export async function openAbout(page: Page) {
  const about = page.locator('.workspace-context details.ei-disclosure')
  if (!(await about.evaluate((el: HTMLDetailsElement) => el.open))) await about.locator('summary').click()
  return about
}

/** Parametric's one explanatory sentence lives in "About this model" (task 78, WD-03). */
export async function expectParametricNote(page: Page) {
  const about = await openAbout(page)
  await expect(about.getByText(/Every parameter is editable from the start/)).toBeVisible()
}

/** Fills a labelled numeric field and commits it with Enter. */
export async function fillField(page: Page, label: string, value: string) {
  const field = page.getByLabel(label, { exact: true })
  await field.scrollIntoViewIfNeeded()
  await field.fill(value)
  await field.press('Enter')
  await expect(field).not.toHaveAttribute('aria-invalid', 'true')
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
  // Task 77: the keyboard path skips the pre-scroll; tabTo focuses the field and the browser scrolls it into view.
  if (keyboard) { await tabTo(page, field); await field.press('ControlOrMeta+A'); await field.pressSequentially(value) }
  else { await field.scrollIntoViewIfNeeded(); await field.fill(value) }
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
