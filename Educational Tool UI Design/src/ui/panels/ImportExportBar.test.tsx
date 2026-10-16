import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { bundledChallenge } from '../../../test/arbitraries'
import { createHarness } from '../../../test/state/model'
import { exportDesign, MAX_IMPORT_BYTES } from '../../state/importExport'
import StoreProvider from '../state/StoreProvider'
import { useStore, type Store } from '../state/store'
import { AnnounceContext } from '../a11y/useAnnouncements'
import ImportExportBar, { readImportFile } from './ImportExportBar'
const ch = bundledChallenge()
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
it('rejects oversized files before reading and handles unreadable files', async () => {
  const text = vi.fn().mockResolvedValue('{}')
  const result = await readImportFile({ size: MAX_IMPORT_BYTES + 1, text } as unknown as File, ch)
  expect(result.ok).toBe(false); expect(text).not.toHaveBeenCalled()
  const boundary = await readImportFile({ size: MAX_IMPORT_BYTES, text } as unknown as File, ch)
  expect(text).toHaveBeenCalledTimes(1); expect(boundary.ok).toBe(false)
  const unreadable = await readImportFile({ size: 5, text: async () => { throw new Error('read failed') } } as unknown as File, ch)
  expect(unreadable.ok).toBe(false)
})
it('lists all reasons with literal escaping, announces the cause and leaves rejected session untouched', async () => {
  let store: Store
  const announce = vi.fn()
  function Probe() { store = useStore(); return null }
  render(<StoreProvider challenge={ch} initialSession={createHarness(ch).real.state}><Probe /><AnnounceContext.Provider value={announce}><ImportExportBar /></AnnounceContext.Provider></StoreProvider>)
  const before = store!.state
  const payload = JSON.parse(exportDesign(before.draft, ch))
  payload.design.materialId = '<img onerror=literal>'
  payload.design.lengthM = 1
  const file = new File([JSON.stringify(payload)], 'bad.json', { type: 'application/json' })
  fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [file] } })
  await screen.findByRole('dialog', { name: 'Design could not be imported' })
  expect(screen.getByRole('list', { name: 'Import error reasons' }).children.length).toBe(2)
  expect(screen.getByText(/<img onerror=literal>/)).toBeTruthy()
  expect(document.querySelector('img')).toBeNull()
  expect(store!.state).toBe(before)
  expect(announce).toHaveBeenCalledWith(expect.stringMatching(/material/i))
})
it('imports validated geometry without adding a test result', async () => {
  let store: Store
  function Probe() { store = useStore(); return null }
  render(<StoreProvider challenge={ch} initialSession={createHarness(ch).real.state}><Probe /><ImportExportBar /></StoreProvider>)
  const design = { ...store!.state.draft, section: { kind: 'circle' as const, diameterM: 0.05 } }
  fireEvent.change(screen.getByLabelText('Import design'), { target: { files: [new File([exportDesign(design, ch)], 'valid.json')] } })
  await waitFor(() => expect(store!.state.draft.section).toEqual(design.section))
  expect(store!.state.history).toHaveLength(1)
})

it('exports only the current design as a downloadable JSON object URL and revokes it', () => {
  vi.useFakeTimers()
  const createObjectURL = vi.fn(() => 'blob:local-design')
  const revokeObjectURL = vi.fn()
  class DownloadURL extends URL { static createObjectURL = createObjectURL; static revokeObjectURL = revokeObjectURL }
  vi.stubGlobal('URL', DownloadURL)
  let filename = ''
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download })
  render(<StoreProvider challenge={ch} initialSession={createHarness(ch).real.state}><ImportExportBar /></StoreProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Export design' }))
  expect(createObjectURL).toHaveBeenCalledTimes(1)
  expect(filename).toBe(`${ch.id}-design.json`)
  vi.runAllTimers()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-design')
})
