import Icon from '../icons/Icon'
import { useDispatch, useSession } from '../state/store'
import ModalFrame from './ModalFrame'

// STUB (task 13.3): the template "Predict deflection" modal moved here in look
// (`.prediction-options`). Opens only when the reducer sets `ui.predictionDialogOpen`.
// Non-interactive: options and confirm are disabled until task 22.2 wires `setPrediction`
// and `runTest`. Close dispatches `cancelPrediction` (stores nothing, Req 14.5).

export default function PredictionDialog() {
  const open = useSession().ui.predictionDialogOpen
  const dispatch = useDispatch()
  if (!open) return null
  return (
    <ModalFrame title="Predict deflection" icon="bulb" onClose={() => dispatch({ type: 'cancelPrediction' })}>
      <p>Compared with your previous tested design, how will your new section change tip deflection?</p>
      <div className="prediction-options">
        {['Decrease', 'Stay the same', 'Increase'].map((p) => (
          <button type="button" key={p} disabled>
            {p === 'Decrease' ? '↘' : p === 'Increase' ? '↗' : '→'} {p}
          </button>
        ))}
      </div>
      <button type="button" className="primary modal-primary" disabled>
        <Icon name="play" size={15} />
        Run structural test
      </button>
    </ModalFrame>
  )
}
