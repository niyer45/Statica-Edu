import { selectVisibleHistory } from '../../state/selectors'
import { useEffect, useRef, useState } from 'react'
import { STATUS_LABELS } from '../panels/resultPresentation'
import ReflectionPrompt from '../panels/ReflectionPrompt'
import { useModelUi } from '../models/registry'
import { useStore } from '../state/store'
import Dialog from './Dialog'

function SubmissionForm({ onClose, onExit }: { onClose: () => void; onExit: () => void }) {
  const { state, submit } = useStore()
  const { copy } = useModelUi()
  const results = selectVisibleHistory(state).filter((r) => r.iteration >= 1)
  const [target, setTarget] = useState(results[results.length - 1]?.id ?? '')
  const hasResult = results.some((r) => r.id === target)
  const hasReflection = state.reflectionAnswer.trim().length > 0
  const recorded = state.submission
  // After a submission is recorded, focus moves to the way out (owner feedback, task 61).
  const wasRecorded = useRef(recorded !== undefined)
  const exitButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (recorded !== undefined && !wasRecorded.current) exitButton.current?.focus()
    wasRecorded.current = recorded !== undefined
  }, [recorded])
  return <Dialog title="Explain & submit" icon="check" onClose={onClose}>
    <ReflectionPrompt />
    <label htmlFor="submission-target">Iteration to submit</label>
    <select id="submission-target" value={target} onChange={(e) => setTarget(e.target.value)} disabled={results.length === 0}>
      {results.map((r) => <option value={r.id} key={r.id}>Iteration {r.iteration}</option>)}
    </select>
    {!hasResult && <p>Run at least one test iteration before submitting.</p>}
    {!hasReflection && <p>Enter a non-whitespace reflection before submitting.</p>}
    <button type="button" className="primary modal-primary" disabled={!hasResult || !hasReflection} onClick={() => submit(target)}>Submit design & reflection</button>
    {recorded && <div aria-label="Recorded submission"><p>Submitted iteration {state.history.find((r) => r.id === recorded.testResultId)!.iteration}: {STATUS_LABELS[recorded.status]}</p>
      <div aria-label="Submission efficiency">{copy.efficiency(recorded.efficiency).map((e) => <p key={e.label}>{e.label}: {e.value.toFixed(3)}</p>)}</div>
      <div className="submit-exit" role="group" aria-label="After submitting">
        <button ref={exitButton} type="button" className="primary" onClick={() => { onClose(); onExit() }}>Back to challenges</button>
        <button type="button" className="secondary" onClick={onClose}>Return to this challenge</button>
      </div>
    </div>}
  </Dialog>
}
export default function SubmitDialog({ open, onClose, onExit }: { open: boolean; onClose: () => void; onExit: () => void }) {
  return open ? <SubmissionForm onClose={onClose} onExit={onExit} /> : null
}
