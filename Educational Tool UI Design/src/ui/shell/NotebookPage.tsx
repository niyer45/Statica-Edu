import Icon from '../icons/Icon'

// Notebook (task 13.5; Req 34.8). Text is held by the shell in memory for this page session
// only; it is never sent over the network. "Export notes" downloads a local text file.

export const REFLECTION_QUESTIONS: readonly string[] = [
  'What did you expect to happen?',
  'What actually changed?',
  'Which constraint shaped your decision?',
  'Where else could this idea apply?',
]

export function wordCount(text: string): number {
  const t = text.trim()
  return t === '' ? 0 : t.split(/\s+/).length
}

function downloadNotes(notes: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([notes], { type: 'text/plain' }))
  a.download = 'statica-learning-notes.txt'
  a.click()
  URL.revokeObjectURL(a.href)
}

export interface NotebookPageProps {
  notes: string
  onChange: (notes: string) => void
}

export default function NotebookPage({ notes, onChange }: NotebookPageProps) {
  return (
    <>
      <section className="library-heading">
        <h1>Notebook</h1>
      </section>
      <section className="notebook-layout">
        <div className="panel notebook-editor">
          <div className="panel-title">
            <Icon name="book" />
            <h2>My engineering notes</h2>
            <span className="guided">Session only</span>
          </div>
          <textarea
            aria-label="Engineering notes"
            placeholder="Add observations, calculations, or questions…"
            value={notes}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="notebook-bottom">
            <span>{wordCount(notes)} words · Notes stay in this session</span>
            <button type="button" className="secondary" disabled={notes.trim() === ''} onClick={() => downloadNotes(notes)}>
              <Icon name="download" size={13} />
              Export notes
            </button>
          </div>
        </div>
        <div className="reflection-prompts">
          <div className="eyebrow">A FEW GOOD QUESTIONS</div>
          {REFLECTION_QUESTIONS.map((p, i) => (
            <button type="button" key={p} onClick={() => onChange(`${notes}${notes ? '\n\n' : ''}${p}\n`)}>
              <span>0{i + 1}</span>
              {p}
              <Icon name="plus" size={13} />
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
