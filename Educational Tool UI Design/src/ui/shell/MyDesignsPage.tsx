import type { EvaluationStatus, TestResult } from '../../evaluation/types'
import { formatMm, paToMpa, UNAVAILABLE_PLACEHOLDER } from '../../units/units'
import Icon from '../icons/Icon'
import { MODE_LABELS } from '../workbench/WorkbenchChrome'
import type { InteractionMode } from '../../challenge/types'
import TechnicalArt from './TechnicalArt'

// My designs (task 13.5; Req 34.7). Lists only the Test_Results in the session history;
// every metric and status is read from the stored Test_Result (no recomputation here).

export const STATUS_LABELS: Readonly<Record<EvaluationStatus, string>> = {
  accepted: 'Accepted',
  notAccepted: 'Not accepted',
  modelNotApplicable: 'Outside model',
}

const fixed = (v: number, digits: number) => (Number.isFinite(v) ? v.toFixed(digits) : UNAVAILABLE_PLACEHOLDER)

export interface MyDesignsPageProps {
  title: string
  mode: InteractionMode
  /** Session history from the store (baseline first). */
  results: readonly TestResult[]
  started: boolean
  onReturn: () => void
  onFindChallenge: () => void
}

export default function MyDesignsPage({ title, mode, results, started, onReturn, onFindChallenge }: MyDesignsPageProps) {
  return (
    <>
      <section className="library-heading">
        <h1>My designs</h1>
      </section>
      {started ? (
        <article className="project-card panel">
          <TechnicalArt kind="beam" />
          <div>
            <span className="eyebrow">ACTIVE WORKSPACE</span>
            <h2>{title}</h2>
            <p>{MODE_LABELS[mode]} design · Mechanics · Local session</p>
            <table className="my-designs-results" aria-label="Session test results">
              <thead>
                <tr>
                  <th scope="col">Test</th>
                  <th scope="col">Tip deflection</th>
                  <th scope="col">Mass</th>
                  <th scope="col">Bending stress</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{r.label ?? `Test #${r.iteration}`}</th>
                    <td>{formatMm(r.analysis.tipDeflectionM, 2)} mm</td>
                    <td>{fixed(r.analysis.massKg, 3)} kg</td>
                    <td>{fixed(paToMpa(r.analysis.nominalMaxStressPa), 1)} MPa</td>
                    <td>{STATUS_LABELS[r.evaluation.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="primary" onClick={onReturn}>
              Return to workbench
              <Icon name="arrow" size={15} />
            </button>
            <small>Results are kept for this session on this device.</small>
          </div>
        </article>
      ) : (
        <div className="library-empty panel">
          <Icon name="cube" size={35} />
          <h3>No designs yet</h3>
          <p>Open a challenge to start building your design collection.</p>
          <button type="button" className="primary" onClick={onFindChallenge}>
            Find a challenge
            <Icon name="arrow" size={15} />
          </button>
        </div>
      )}
    </>
  )
}
