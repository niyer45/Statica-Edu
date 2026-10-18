import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { audit, readState, tabTo } from './helpers'

// Task 60: Reset to baseline in every original challenge. For each of the six workbenches the
// learner edits the design, records a test, edits again, then resets through the in-page
// confirmation. The draft must equal the challenge's baseline (read from the stored Baseline
// result, which persistence keeps equal to the challenge's initial design) and the tested
// history must be unchanged, including after a reload. Edits are model-independent (a slider
// moved to an end of its range, or a member toggle), so no challenge values are hard-coded.

interface Entry { title: string; id: string }
const ENTRIES: Entry[] = [
  { title: 'Cantilever Beam I', id: 'cantilever-beam-1' },
  { title: 'Mounting Bracket I', id: 'mounting-bracket-1' },
  { title: 'Torsion Shaft I', id: 'torsion-shaft-1' },
  { title: 'Heat Sink I', id: 'heat-sink-1' },
  { title: 'Braced Frame I', id: 'braced-frame-1' },
  { title: 'Vibration Isolation I', id: 'vibration-isolation-1' },
]

type Design = { id: string } & Record<string, unknown>
interface State { challengeId: string; draft: Design; draftStatus: string; history: { id: string; designSnapshot: Design }[]; submission?: unknown }
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

test('Reset to baseline restores every challenge baseline and keeps tested history', async ({ page }, info) => {
  test.setTimeout(240_000) // Six workbenches, six tests, six resets, a reload and six restores.
  expect(catalog.filter((e) => e.available).map((e) => e.title).sort()).toEqual(ENTRIES.map((e) => e.title).sort())
  await page.goto('/')
  const histories = new Map<string, unknown>()
  for (const [i, entry] of ENTRIES.entries()) {
    await open(page, entry)
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
    const dialog = page.getByRole('dialog', { name: 'Reset design?' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Your tested history and any submission stay unchanged.')).toBeVisible()
    if (i === 0) {
      await audit(page)
      await page.screenshot({ path: info.outputPath('reset-dialog.png') })
    }
    await dialog.getByRole('button', { name: 'Reset design', exact: true }).click()
    await expect(dialog).toBeHidden()

    const after = await state(page)
    expect(withoutId(after.draft)).toEqual(withoutId(baseline))
    expect(after.history).toEqual(before.history)
    expect(after.submission).toEqual(before.submission)
    // The latest recorded test is not the baseline, so the restored baseline is an untested draft.
    expect(after.draftStatus).toBe('draft')
    await expect(page.getByLabel('Test status', { exact: true })).toHaveText('Draft')
    await expect(page.getByTestId('live-region')).toHaveText('Design reset to the baseline. Tested history is unchanged.')
    await expect(resetButton(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(resetButton(page)).toBeFocused()
    histories.set(entry.id, after.history)
    if (i === 0) await page.screenshot({ path: info.outputPath('reset-done.png') })
    await toLibrary(page)
  }

  // The reset draft and the untouched history are saved like any other edit.
  await page.reload()
  for (const entry of ENTRIES) {
    await open(page, entry)
    const restored = await state(page)
    expect(withoutId(restored.draft)).toEqual(withoutId(restored.history[0]!.designSnapshot))
    expect(restored.history).toEqual(histories.get(entry.id))
    await expect(resetButton(page)).toHaveAttribute('aria-disabled', 'true')
    await toLibrary(page)
  }
})

test('Reset to baseline works by keyboard, can be cancelled and fits 320 px', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await open(page, ENTRIES[3]!)
  await editDesign(page, 0)
  const edited = await state(page)

  // Escape cancels and leaves the edited draft in place; focus returns to the control.
  await tabTo(page, resetButton(page))
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Reset design?' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(resetButton(page)).toBeFocused()
  expect((await state(page)).draft).toEqual(edited.draft)

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
  await tabTo(page, dialog.getByRole('button', { name: 'Reset design', exact: true }))
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  const after = await state(page)
  expect(withoutId(after.draft)).toEqual(withoutId(after.history[0]!.designSnapshot))
  expect(after.history).toEqual(edited.history)
  // Nothing was tested yet, so the baseline is the latest test again.
  expect(after.draftStatus).toBe('tested')
  await expect(page.getByLabel('Test status', { exact: true })).toHaveText('Tested #0')
})
