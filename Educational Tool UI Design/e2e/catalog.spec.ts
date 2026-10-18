import { expect, test, type Page } from '@playwright/test'
import { catalog } from '../src/challenge/catalog'
import { readState, referenceDesign } from './helpers'

// Original-catalog gate evidence (task 51, automated part): in one browser profile, every one of
// the six original challenges runs a test from its own edited draft, saves under its own
// `ei:session:<id>:v<version>` key, and restores its own history and entry mode after a reload,
// with no challenge's work leaking into another's. Each challenge's full learning loop, axe and
// 320 px checks live in its own spec; this file checks the six together.

interface Entry { title: string; id: string; edit: (page: Page) => Promise<void> }

async function fill(page: Page, label: string, value: string) {
  const field = page.getByLabel(label, { exact: true })
  await field.scrollIntoViewIfNeeded()
  await field.fill(value)
  await field.press('Enter')
  await expect(field).not.toHaveAttribute('aria-invalid', 'true')
}

const ENTRIES: Entry[] = [
  { title: 'Cantilever Beam I', id: 'cantilever-beam-1', edit: (page) => referenceDesign(page) },
  { title: 'Mounting Bracket I', id: 'mounting-bracket-1', edit: (page) => fill(page, 'Step location', '175') },
  {
    title: 'Torsion Shaft I',
    id: 'torsion-shaft-1',
    edit: async (page) => {
      await page.getByRole('button', { name: /Hollow tube/ }).click()
      await fill(page, 'Outer diameter', '50')
      await fill(page, 'Inner diameter', '44')
    },
  },
  { title: 'Heat Sink I', id: 'heat-sink-1', edit: (page) => fill(page, 'Fin height', '35') },
  {
    title: 'Braced Frame I',
    id: 'braced-frame-1',
    edit: async (page) => {
      const diagonal = page.getByRole('button', { name: 'Storey 1 diagonal, bottom left to top right', exact: true })
      await diagonal.scrollIntoViewIfNeeded()
      await diagonal.click()
      await expect(diagonal).toHaveAttribute('aria-pressed', 'true')
    },
  },
  { title: 'Vibration Isolation I', id: 'vibration-isolation-1', edit: (page) => fill(page, 'Stiffness', '85') },
]

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
  await expect.poll(async () => (await readState(page)).challengeId).toBe(id)
}

async function runWithPrediction(page: Page) {
  await page.getByRole('button', { name: 'Run Test', exact: true }).click()
  const prediction = page.getByRole('dialog', { name: /^Predict / })
  await expect(prediction).toBeVisible()
  await prediction.getByLabel('Decrease', { exact: true }).check()
  await prediction.getByRole('button', { name: 'Run structural test' }).click()
  await expect(prediction).toBeHidden()
}

test('all six original challenges keep separate saved work in one browser profile', async ({ page }) => {
  test.setTimeout(180_000) // Six workbenches, six tests, a reload and six restores.
  expect(catalog.filter((e) => e.available).map((e) => e.title).sort()).toEqual(ENTRIES.map((e) => e.title).sort())
  await page.goto('/')
  const saved = new Map<string, { draft: unknown; history: unknown }>()
  for (const entry of ENTRIES) {
    await open(page, entry)
    await entry.edit(page)
    await runWithPrediction(page)
    const state = await readState(page)
    expect(state.challengeId).toBe(entry.id)
    expect(state.mode).toBe('parametric')
    expect(state.history).toHaveLength(2)
    saved.set(entry.id, { draft: state.draft, history: state.history })
    await toLibrary(page)
  }

  const keys = await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('ei:session:')).sort())
  expect(keys).toEqual(ENTRIES.map((e) => `ei:session:${e.id}:v1`).sort())

  await page.reload()
  for (const entry of ENTRIES) {
    await open(page, entry)
    const restored = await readState(page)
    expect(restored.challengeId).toBe(entry.id)
    expect(restored.mode).toBe('parametric')
    expect(restored.history).toHaveLength(2)
    // Exactly this challenge's own draft and tested records come back, not another challenge's.
    expect({ draft: restored.draft, history: restored.history }).toEqual(saved.get(entry.id))
    await toLibrary(page)
  }
})

async function exportDesign(page: Page): Promise<string> {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export design', exact: true }).click()
  const path = await (await download).path()
  if (!path) throw new Error('Design download not available')
  return path
}

test("a design file opens only in its own challenge's workbench", async ({ page }) => {
  test.setTimeout(180_000) // Six exports, six own-challenge imports and six cross-challenge refusals.
  await page.goto('/')
  const files = new Map<string, string>()
  for (const entry of ENTRIES) {
    await open(page, entry)
    await entry.edit(page)
    const draft = (await readState(page)).draft
    const file = await exportDesign(page)
    files.set(entry.id, file)
    // Own challenge: the exported design imports back to the same draft.
    await page.getByLabel('Import design', { exact: true }).setInputFiles(file)
    await expect.poll(async () => (await readState(page)).draft).toEqual(draft)
    await toLibrary(page)
  }
  for (const [i, entry] of ENTRIES.entries()) {
    const other = ENTRIES[(i + 1) % ENTRIES.length]!
    await open(page, entry)
    const before = await readState(page)
    await page.getByLabel('Import design', { exact: true }).setInputFiles(files.get(other.id)!)
    const refusal = page.getByRole('dialog', { name: 'Design could not be imported' })
    await expect(refusal.getByText(/belongs to a different challenge/)).toBeVisible()
    await refusal.getByRole('button', { name: /Back to design/ }).click()
    await expect(refusal).toBeHidden()
    const after = await readState(page)
    expect(after.draft).toEqual(before.draft)
    expect(after.history).toEqual(before.history)
    await toLibrary(page)
  }
})
