import { useState } from 'react'
import type { PredictionDirection } from '../../state/session'
import Icon from '../icons/Icon'
import { useSession, useStore } from '../state/store'
import Dialog from './Dialog'

function PredictionForm() {
  const store = useStore()
  const [direction, setDirection] = useState<PredictionDirection | ''>('')
  const [explanation, setExplanation] = useState('')
  const [error, setError] = useState('')
  const previous = store.state.history[store.state.history.length - 1]!
  const cancel = () => store.dispatch({ type: 'cancelPrediction' })
  const confirm = () => {
    if (!direction) { setError('Select a prediction direction.'); return }
    if (explanation.length > 500) { setError('Explanation must contain at most 500 characters.'); return }
    store.dispatch({ type: 'setPrediction', direction, explanation, now: store.clock() })
    store.runTest()
  }
  return <Dialog title="Predict deflection" icon="bulb" onClose={cancel}>
    <p>Compared with {previous.iteration === 0 ? 'the Baseline' : `iteration ${previous.iteration}`}, how will your new section change tip deflection?</p>
    <fieldset className="prediction-options"><legend>Predicted change in tip deflection</legend>
      {([['decrease', 'Decrease'], ['same', 'Stay the same'], ['increase', 'Increase']] as const).map(([value, label]) => <label key={value}>
        <input type="radio" name="prediction" value={value} checked={direction === value} onChange={() => { setDirection(value); setError('') }} /> {label}
      </label>)}
    </fieldset>
    <label htmlFor="prediction-explanation">Explanation (optional, up to 500 characters)</label>
    <textarea id="prediction-explanation" maxLength={500} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
    {(error || store.state.ui.notice?.kind === 'error') && <p role="alert">{error || store.state.ui.notice?.message}</p>}
    <button type="button" className="primary modal-primary" onClick={confirm}><Icon name="play" size={15} />Run structural test</button>
    <button type="button" onClick={cancel}>Cancel</button>
  </Dialog>
}
export default function PredictionDialog() {
  return useSession().ui.predictionDialogOpen ? <PredictionForm /> : null
}
