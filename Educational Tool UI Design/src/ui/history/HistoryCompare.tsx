import { SECTION_KIND_NAMES } from '../../evaluation/explain'
import { formatMm, paToMpa } from '../../units/units'
import Icon from '../icons/Icon'
import SectionIcon from '../icons/SectionIcon'
import ImportExportBar from '../panels/ImportExportBar'
import { useChallenge, useSession } from '../state/store'

// STUB (task 13.3): the template `section.results-panel` contents moved here.
// Task 23.1 turns the tabs into an accessible tablist, fills metrics and explanations from
// stored Test_Results, and adds compare and restore. Until then rows list the session
// history by label and section type only; no metric value is shown (limits are challenge
// inputs).

const NO_RESULTS = 'Results not shown yet'

export default function HistoryCompare() {
  const { history } = useSession()
  const ch = useChallenge()
  const metrics = [
    { label: 'Tip deflection', limit: `${formatMm(ch.constraints.maxDeflectionM)} mm` },
    { label: 'Total mass', limit: `${ch.constraints.maxMassKg.toFixed(2)} kg` },
    { label: 'Bending stress', limit: `${paToMpa(ch.constraints.maxStressPa).toFixed(1)} MPa` },
  ]
  return (
    <>
      <div className="results-header">
        <div className="result-tabs">
          <span className="active">
            <Icon name="clock" size={15} /> Design history
            <span>{history.length.toString().padStart(2, '0')}</span>
          </span>
          <span>
            <Icon name="chart" size={15} /> Compare results
          </span>
        </div>
        <ImportExportBar />
      </div>
      <div className="results-content">
        <div className="iteration-list">
          {history.map((r) => (
            <div className={`iteration ${r.iteration === 0 ? 'active' : ''}`} key={r.id}>
              <span className="iteration-symbol">
                <SectionIcon kind={r.designSnapshot.section.kind} />
              </span>
              <span>
                <strong>{r.label}</strong>
                <small>{SECTION_KIND_NAMES[r.designSnapshot.section.kind]}</small>
              </span>
              <span className="status-fail">{NO_RESULTS}</span>
            </div>
          ))}
          {history.length === 1 && (
            <div className="empty-iteration">
              <span>+</span>No test iterations
              <small>Modify the section and run a test.</small>
            </div>
          )}
        </div>
        <div className="analysis-results">
          <div className="analysis-heading">
            <span>BASELINE RESULTS</span>
          </div>
          <div className="metrics">
            {metrics.map((m) => (
              <div className="metric" key={m.label}>
                <div>{m.label}</div>
                <strong>
                  — <span>{NO_RESULTS}</span>
                </strong>
                <div className="metric-track">
                  <i />
                </div>
                <small>Limit: {m.limit}</small>
              </div>
            ))}
          </div>
          <div className="result-explanation">
            <Icon name="bulb" size={15} />
            <p>Results will appear here after a test.</p>
          </div>
        </div>
      </div>
    </>
  )
}
