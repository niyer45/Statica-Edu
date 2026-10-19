import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { audit, openWorkbench, readState, runAnyTest, setDimension, tabTo } from './helpers'

// Task 60 (owner amendment): Reset to baseline starts a challenge over. For each of the six
// workbenches the learner edits the design, records a test, edits again, then resets through the
// in-page confirmation. The session must look like a first opening in the same mode: the draft
// equals the challenge baseline (read from the stored Baseline result, which persistence keeps
// equal to the challenge's initial design), history holds only that Baseline, and this survives a
// reload. A Guided run checks that experiment progress returns to step 1 and the submission and
// reflection are cleared. Edits are model-independent (a slider moved to an end of its range, or a
// member toggle), so no challenge values are hard-coded.

interface Entry { title: string; id: string }
const ENTRIES: Entry[] = [
  { title: 'Cantilever Beam I', id: 'cantilever-beam-1' },
  { title: 'Mounting Bracket I', id: 'mounting-bracket-1' },
  { title: 'Torsion Shaft I', id: 'torsion-shaft-1' },
  { title: 'Heat Sink I', id: 'heat-sink-1' },
  { title: 'Braced Frame I', id: 'braced-frame-1' },
  { title: 'Vibration Isolation I', id: 'vibration-isolation-1' },
  // Task 69 (D-59): owner-requested Pressure Vessel I.
  { title: 'Pressure Vessel I', id: 'pressure-vessel-1' },
  { title: 'Stress and Strain I', id: 'stress-strain-1' }, // task 72
  // Task 70 (D-60).
  { title: 'Fatigue Analysis I', id: 'fatigue-analysis-1' },
  // Task 68 (D-58).
  { title: 'Column Buckling I', id: 'column-buckling-1' },
]

type Design = { id: string } & Record<string, unknown>
interface State { challengeId: string; mode: string; draft: Design; draftStatus: string; history: { id: string; iteration: number; designSnapshot: Design }[]; deletedIterationIds?: string[]; reflectionAnswer: string; submission?: unknown }
const state = async (page: Page) => (await readState(page)) as unknown as State
const withoutId = ({ id, ...rest }: Design) => { void id; return rest }

async function toLibrary(page: Page) {
  const library = page.locator('.platform-sidebar').getByRole('button', { name: 'Challenges' })
  if (await library.isVisible()) await library.click()
  else await page.getByLabel('Navigate workspace').selectOption('Challenges')
}

async function open(page: Page, { title, id }: Entry) {
  await page.getByRole('button', { name: `View ${title}`, exact: true }).click()
  const drawer = page.getByRole('dialog', { name: title, exact: true })
  await drawer.getByRole('button', { name: /^Parametric/ }).click()
  await drawer.getByRole('button', { name: /^(Open|Continue) challenge$/ }).click()
  await expect(page.getByRole('button', { name: 'Run Test', exact: true })).toBeVisible()
  await expect.poll(async () => (await state(page)).challengeId).toBe(id)
}

/** Change the draft through the model's own controls: the n-th slider, else the n-th toggle. */
async function editDesign(page: Page, n: number) {
  const before = (await state(page)).draft
  const tools = page.getByRole('region', { name: 'Design tools' })
  const sliders = tools.locator('input[type=range]')
  const count = await sliders.count()
  if (count > 0) {
    const slider = sliders.nth(n % count)
    await slider.scrollIntoViewIfNeeded()
    await slider.focus()
    const atMax = Number(await slider.inputValue()) >= Number(await slider.getAttribute('max'))
    await page.keyboard.press(atMax ? 'Home' : 'End')
  } else {
    const toggles = tools.locator('button[aria-pressed]')
    const toggle = toggles.nth(n % (await toggles.count()))
    await toggle.scrollIntoViewIfNeeded()
    await toggle.click()
  }
  await expect.poll(async () => withoutId((await state(page)).draft)).not.toEqual(withoutId(before))
}

async function runWithPrediction(page: Page) {
  await page.getByRole('button', { name: 'Run Test', exact: true }).click()
  const prediction = page.getByRole('dialog', { name: /^Predict / })
  if (await prediction.isVisible()) {
    await prediction.getByLabel('Decrease', { exact: true }).check()
    await prediction.getByRole('button', { name: 'Run structural test' }).click()
    await expect(prediction).toBeHidden()
  }
}

const resetButton = (page: Page) => page.getByRole('button', { name: 'Reset to baseline', exact: true })

/** The session is a fresh start: baseline draft, only the Baseline tested, nothing else kept. */
function expectFresh(s: State, mode: string) {
  expect(s.mode).toBe(mode)
  expect(s.history).toHaveLength(1)
  expect(s.history[0]!.iteration).toBe(0)
  expect(withoutId(s.draft)).toEqual(withoutId(s.history[0]!.designSnapshot))
  expect(s.deletedIterationIds ?? []).toEqual([])
  expect(s.draftStatus).toBe('tested')
  expect(s.reflectionAnswer).toBe('')
  expect(s.submission).toBeUndefined()
}

const ANNOUNCEMENT = 'Challenge reset to the baseline. Design, test history and submission were cleared.'

test('Reset to baseline starts every challenge over from its baseline', async ({ page }, info) => {
  test.setTimeout(360_000) // Six workbenches, six tests, six resets, a reload and six restores (software WebGL).
  expect(catalog.filter((e) => e.available).map((e) => e.title).sort()).toEqual(ENTRIES.map((e) => e.title).sort())
  await page.goto('/#challenges')
  for (const [i, entry] of ENTRIES.entries()) {
    await open(page, entry)
    expectFresh(await state(page), 'parametric')
    await expect(resetButton(page)).toHaveAttribute('aria-disabled', 'true')
    await editDesign(page, 0)
    await expect(resetButton(page)).toHaveAttribute('aria-disabled', 'false')
    await runWithPrediction(page)
    await expect.poll(async () => (await state(page)).history.length).toBe(2)
    await editDesign(page, 1)
    const before = await state(page)
    const baseline = before.history[0]!.designSnapshot
    expect(withoutId(before.draft)).not.toEqual(withoutId(baseline))

    await resetButton(page).scrollIntoViewIfNeeded()
    await resetButton(page).click()
    const dialog = page.getByRole('dialog', { name: 'Reset this challenge?' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('This cannot be undone.')).toBeVisible()
    if (i === 0) {
      await audit(page)
      await page.screenshot({ path: info.outputPath('reset-dialog.png') })
    }
    await dialog.getByRole('button', { name: 'Reset challenge', exact: true }).click()
    await expect(dialog).toBeHidden()

    await expect.poll(async () => (await state(page)).history.length).toBe(1)
    const after = await state(page)
    expectFresh(after, 'parametric')
    expect(withoutId(after.history[0]!.designSnapshot)).toEqual(withoutId(baseline))
    await expect(page.getByLabel('Test status', { exact: true })).toHaveText('Tested #0')
    await expect(page.getByTestId('live-region')).toHaveText(ANNOUNCEMENT)
    await expect(resetButton(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(resetButton(page)).toBeFocused()
    if (i === 0) await page.screenshot({ path: info.outputPath('reset-done.png') })
    await toLibrary(page)
  }

  // The fresh session is saved like any other action.
  await page.reload()
  for (const entry of ENTRIES) {
    await open(page, entry)
    expectFresh(await state(page), 'parametric')
    await expect(resetButton(page)).toHaveAttribute('aria-disabled', 'true')
    await toLibrary(page)
  }
})

test('Guided: reset returns experiments to step 1 and clears the submission', async ({ page }) => {
  test.setTimeout(120_000)
  await openWorkbench(page, true, false, 'Guided')
  const guide = page.getByRole('region', { name: 'Guided experiments' })
  await expect(guide).toContainText(/Step 1 of \d+/)
  // Step 1 grows the Ø31 mm circle baseline (D-47 amendment).
  await setDimension(page, 'diameterM', '34')
  await runAnyTest(page)
  await expect(guide).not.toContainText(/Step 1 of \d+/)
  await page.getByRole('button', { name: 'Explain & submit' }).click()
  await page.getByRole('dialog', { name: 'Explain & submit', exact: true }).getByRole('textbox').fill('A reflection that reset clears.')
  await page.getByRole('button', { name: 'Submit design & reflection' }).click()
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await state(page)).submission).toBeDefined()

  await resetButton(page).click()
  await page.getByRole('dialog', { name: 'Reset this challenge?' }).getByRole('button', { name: 'Reset challenge', exact: true }).click()
  await expect.poll(async () => (await state(page)).history.length).toBe(1)
  expectFresh(await state(page), 'guided')
  await expect(guide).toContainText(/Step 1 of \d+/)
  await page.reload()
  await openWorkbench(page, false)
  expectFresh(await state(page), 'guided')
  await expect(page.getByRole('region', { name: 'Guided experiments' })).toContainText(/Step 1 of \d+/)
})

test('Reset to baseline works by keyboard, can be cancelled and fits 320 px', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.goto('/#challenges')
  await open(page, ENTRIES[3]!)
  await editDesign(page, 0)
  const edited = await state(page)

  // Escape cancels and keeps everything; focus returns to the control.
  await tabTo(page, resetButton(page))
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Reset this challenge?' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(resetButton(page)).toBeFocused()
  expect(await state(page)).toEqual(edited)

  await page.setViewportSize({ width: 320, height: 800 })
  await resetButton(page).scrollIntoViewIfNeeded()
  await expect(resetButton(page)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  await page.screenshot({ path: info.outputPath('reset-320.png') })
  await resetButton(page).focus()
  await page.keyboard.press('Space')
  await expect(dialog).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  await page.screenshot({ path: info.outputPath('reset-320-dialog.png') })
  await audit(page)
  await tabTo(page, dialog.getByRole('button', { name: 'Reset challenge', exact: true }))
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  expectFresh(await state(page), 'parametric')
  await expect(page.getByLabel('Test status', { exact: true })).toHaveText('Tested #0')
})
