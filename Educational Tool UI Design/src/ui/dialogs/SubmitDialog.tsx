import { selectVisibleHistory } from '../../state/selectors'
import { useState } from 'react'
import { STATUS_LABELS } from '../panels/resultPresentation'
import ReflectionPrompt from '../panels/ReflectionPrompt'
import { useModelUi } from '../models/registry'
import { useStore } from '../state/store'
import Dialog from './Dialog'

function SubmissionForm({ onClose }: { onClose: () => void }) {
  const { state, submit } = useStore()
  const { copy } = useModelUi()
  const results = selectVisibleHistory(state).filter((r) => r.iteration >= 1)
  const [target, setTarget] = useState(results[results.length - 1]?.id ?? '')
  const hasResult = results.some((r) => r.id === target)
  const hasReflection = state.reflectionAnswer.trim().length > 0
  const recorded = state.submission
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
    </div>}
  </Dialog>
}
export default function SubmitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <SubmissionForm onClose={onClose} /> : null
}
