import { selectTestCount } from '../../state/selectors'
import Icon from '../icons/Icon'
import { useSession } from '../state/store'

// Template `footer.page-footer` (task 13.3; Req 29.7, 35.6).
// The model-limits notice is always shown. "Explain & submit" opens the SubmitDialog and is
// enabled once history holds a Test_Result with iteration ≥ 1 (the template's
// `draft || runs.length < 2` rule is replaced).

export const MODEL_LIMITS_NOTICE = 'Idealized beam approximation, not a structural certification'

export default function PageFooter({ onExplainSubmit }: { onExplainSubmit: () => void }) {
  const s = useSession()
  const canSubmit = selectTestCount(s) >= 1
  return (
    <footer className="page-footer">
      <span>
        <Icon name="lock" size={12} />
        {MODEL_LIMITS_NOTICE}
      </span>
      <button
        type="button"
        className="submit-button"
        disabled={!canSubmit}
        title={canSubmit ? undefined : 'Run at least one test first'}
        onClick={onExplainSubmit}
      >
        {s.submission !== undefined ? 'Design submitted' : 'Explain & submit'}
        <Icon name="arrow" size={14} />
      </button>
    </footer>
  )
}
