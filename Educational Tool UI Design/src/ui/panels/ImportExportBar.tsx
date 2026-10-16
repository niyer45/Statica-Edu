import { useRef, useState } from 'react'
import { exportDesign, importDesign, MAX_IMPORT_BYTES, type ImportChallenge } from '../../state/importExport'
import { useAnnounce } from '../a11y/useAnnouncements'
import Dialog from '../dialogs/Dialog'
import Icon from '../icons/Icon'
import { useStore } from '../state/store'

export async function readImportFile(file: File, challenge: ImportChallenge) {
  if (file.size > MAX_IMPORT_BYTES) return { ok: false as const, error: ['The file is too large: design files must be at most 102400 bytes (100 KB).'] }
  try {
    const text = typeof file.text === 'function' ? await file.text() : await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('The design file could not be read.'))
      reader.readAsText(file)
    })
    return importDesign(text, challenge)
  } catch { return { ok: false as const, error: ['The design file could not be read.'] } }
}
export default function ImportExportBar() {
  const { state, challenge, dispatch } = useStore()
  const [errors, setErrors] = useState<string[]>([])
  const announce = useAnnounce()
  const request = useRef(0)
  const reject = (reasons: string[]) => { setErrors(reasons); announce(`Design import rejected: ${reasons.join(' ')}`) }
  const exportFile = () => {
    try {
      const url = URL.createObjectURL(new Blob([exportDesign(state.draft, challenge)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url; link.download = `${challenge.id}-design.json`
      document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch { reject(['The design file could not be downloaded in this browser.']) }
  }
  return <div className="history-note"><span className="tiny-dot" />Local design files
    <button type="button" title="Export current design" aria-label="Export design" onClick={exportFile}><Icon name="download" size={15} /></button>
    <label className="design-import">Import design<input className="sr-only" type="file" aria-label="Import design" accept=".json,application/json" onChange={async (event) => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (!file) return
      const token = ++request.current
      const result = await readImportFile(file, challenge)
      if (token !== request.current) return
      if (!result.ok) { reject(result.error); return }
      dispatch({ type: 'importDesign', json: { format: 'ei-design', schemaVersion: 1, challengeId: challenge.id, design: result.value } })
      setErrors([])
      announce('Design imported. Run Test to record its results.')
    }} /></label>
    {errors.length > 0 && <Dialog title="Design could not be imported" icon="book" onClose={() => setErrors([])}><ul aria-label="Import error reasons">{errors.map((reason, index) => <li key={index}>{reason}</li>)}</ul><button type="button" onClick={() => setErrors([])}>Back to design</button></Dialog>}
  </div>
}
