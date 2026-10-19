import Icon from '../icons/Icon'
import type { AccountContextValue } from '../account/AccountContext'
import { MODE_LABELS } from '../workbench/WorkbenchChrome'
import { progressDetail, STATUS_LABELS, storageStatement, type ProgressRow } from './progress'
import TechnicalArt from './TechnicalArt'
import './home.css'

// My designs (task 62): progress on this device for every runnable challenge. Started
// workspaces get a card with their own challenge drawing; the rest are listed to start.
// Recorded results stay in the workbench.

export interface MyDesignsPageProps {
  account: AccountContextValue | null
  rows: readonly ProgressRow[]
  onFindChallenge: () => void
}

function WorkspaceCard({ row }: { row: ProgressRow }) {
  return (
    <article className={`project-card panel progress-${row.status}`} aria-label={`${row.title} workspace`}>
      <TechnicalArt kind={row.art} />
      <div>
        <span className="eyebrow">{row.active ? 'ACTIVE WORKSPACE' : 'SAVED WORKSPACE'}</span>
        <h2>{row.title}</h2>
        <p className="design-progress">
          <span className="progress-status">
            {row.status === 'completed' && <Icon name="check" size={13} />}
            {STATUS_LABELS[row.status]}
          </span>
          <span>{progressDetail(row)}</span>
        </p>
        <p>
          {row.mode !== undefined && `${MODE_LABELS[row.mode]} design · `}
          {row.discipline}
        </p>
        <button type="button" className="primary" onClick={row.onContinue} aria-label={row.active ? undefined : `Return to ${row.title}`}>
          Return to workbench
          <Icon name="arrow" size={15} />
        </button>
      </div>
    </article>
  )
}

export default function MyDesignsPage({ account, rows, onFindChallenge }: MyDesignsPageProps) {
  const started = rows.filter((r) => r.started || r.status !== 'notStarted')
  const notStarted = rows.filter((r) => !started.includes(r))
  const completed = rows.filter((r) => r.status === 'completed').length
  return (
    <div className="my-designs">
      <section className="library-heading">
        <h1>My designs</h1>
        <p className="design-summary" aria-label="Progress summary">
          {completed} of {rows.length} challenges completed · {started.length} started
        </p>
        <p className="home-storage">
          <Icon name="lock" size={15} />
          <span>{storageStatement(account)}</span>
        </p>
      </section>
      {started.length > 0 ? (
        <section className="design-cards" aria-label="Started challenges">
          {started.map((row) => (
            <WorkspaceCard key={row.challengeId} row={row} />
          ))}
        </section>
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
      {notStarted.length > 0 && (
        <section className="home-progress" aria-labelledby="not-started-title">
          <h2 id="not-started-title">Not started yet</h2>
          <ul className="progress-list" aria-labelledby="not-started-title">
            {notStarted.map((row) => (
              <li key={row.challengeId} className="progress-row panel progress-notStarted">
                <TechnicalArt kind={row.art} />
                <div className="progress-copy">
                  <h3>{row.title}</h3>
                  <p>
                    <span className="progress-status">{STATUS_LABELS[row.status]}</span>
                    <span className="progress-detail">{row.discipline}</span>
                  </p>
                </div>
                <button type="button" className="home-secondary" onClick={row.onContinue}>
                  Start
                  <span className="sr-only"> {row.title}</span>
                  <Icon name="arrow" size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="home-progress-note">
        Completed means a submitted design whose recorded test was Accepted. Status comes from the work saved in this browser.
      </p>
    </div>
  )
}
