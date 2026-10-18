import { useEffect, useRef, useState } from 'react'
import type { ProgressStatus } from '../../state/selectors'
import type { AccountContextValue } from '../account/AccountContext'
import Icon from '../icons/Icon'
import type { AccountView } from './routes'
import './home.css'

// Homepage (task 38): what Statica is, account / guest entry points, an honest statement that
// progress is saved in this browser on this device, and a progress overview of each runnable
// challenge derived from its stored session (see selectProgress).

export interface ProgressRow {
  challengeId: string
  title: string
  status: ProgressStatus
  testsRun: number
  submission?: string
  /** Continue a started challenge in its saved mode, or open its details to choose a mode. */
  onContinue: () => void
}

export const STATUS_LABELS: Record<ProgressStatus, string> = {
  notStarted: 'Not started',
  inProgress: 'In progress',
  completed: 'Completed',
}

const SUBMISSION_LABELS: Record<string, string> = {
  accepted: 'Submitted, Accepted',
  notAccepted: 'Submitted, not accepted',
  modelNotApplicable: 'Submitted, model not applicable',
}

export function progressDetail(row: Pick<ProgressRow, 'testsRun' | 'submission' | 'status'>): string {
  const parts = [row.testsRun === 0 ? (row.status === 'notStarted' ? 'No work yet' : 'No tests yet') : `${row.testsRun} test${row.testsRun === 1 ? '' : 's'} run`]
  if (row.submission !== undefined) parts.push(SUBMISSION_LABELS[row.submission] ?? 'Submitted')
  return parts.join(' · ')
}

export function storageStatement(account: AccountContextValue | null): string {
  if (account?.user) {
    return `Signed in as ${account.user.displayName}. Your account and progress are saved in this browser on this device only; they do not sync to other devices or browsers yet.`
  }
  return account
    ? "You're using Statica as a guest. Your progress is saved in this browser on this device only."
    : 'Your progress is saved in this browser on this device only.'
}

export interface HomePageProps {
  account: AccountContextValue | null
  rows: readonly ProgressRow[]
  onBrowse: () => void
  onAccount: (view?: AccountView) => void
}

export default function HomePage({ account, rows, onBrowse, onAccount }: HomePageProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  // Keep the one-shot session notice for this visit; the context copy is consumed at once.
  const [notice] = useState(() => account?.notice ?? null)
  useEffect(() => {
    if (notice === null) return
    account?.consumeNotice()
    heading.current?.focus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const user = account?.user ?? null
  const completed = rows.filter((r) => r.status === 'completed').length
  return (
    <div className="home">
      <section className="home-hero panel" aria-labelledby="home-title">
        <span className="eyebrow">
          <span className="tiny-dot" />
          ENGINEERING INTUITION
        </span>
        <h1 id="home-title" ref={heading} tabIndex={-1} aria-describedby={notice !== null ? 'home-notice' : undefined}>
          {user ? `Welcome back, ${user.displayName}` : 'Welcome to Statica'}
        </h1>
        <p className="home-lede">
          Statica is a hands-on practice space for structures and mechanics. Pick a challenge, predict how your design
          will behave, run an idealized engineering test and compare iterations to understand why.
        </p>
        {notice !== null && (
          <p id="home-notice" className="home-notice" role="status">
            <Icon name="check" size={15} />
            {notice}
          </p>
        )}
        <div className="home-actions">
          {account && !user ? (
            <>
              <button type="button" className="primary" onClick={() => onAccount('sign-up')}>
                Create account
              </button>
              <button type="button" className="home-secondary" onClick={() => onAccount('sign-in')}>
                Sign in
              </button>
              <button type="button" className="home-secondary" onClick={onBrowse}>
                Continue as guest
                <Icon name="arrow" size={15} />
              </button>
            </>
          ) : (
            <>
              <button type="button" className="primary" onClick={onBrowse}>
                Browse challenges
                <Icon name="arrow" size={15} />
              </button>
              {account && (
                <button type="button" className="home-secondary" onClick={() => onAccount()}>
                  Account settings
                </button>
              )}
            </>
          )}
        </div>
        <p className="home-storage">
          <Icon name="lock" size={15} />
          <span>{storageStatement(account)}</span>
        </p>
      </section>

      <section className="home-progress" aria-labelledby="progress-title">
        <div className="home-progress-heading">
          <h2 id="progress-title">{user ? 'Your progress' : 'Progress on this device'}</h2>
          <p>
            {completed} of {rows.length} challenges completed
          </p>
        </div>
        <ul className="progress-list" aria-labelledby="progress-title">
          {rows.map((row) => (
            <li key={row.challengeId} className={`progress-row panel progress-${row.status}`}>
              <div className="progress-copy">
                <h3>{row.title}</h3>
                <p>
                  <span className="progress-status">
                    {row.status === 'completed' && <Icon name="check" size={13} />}
                    {STATUS_LABELS[row.status]}
                  </span>
                  <span className="progress-detail">{progressDetail(row)}</span>
                </p>
              </div>
              <button type="button" className={row.status === 'notStarted' ? 'home-secondary' : 'primary'} onClick={row.onContinue}>
                {row.status === 'notStarted' ? 'Start' : 'Continue'}
                <span className="sr-only"> {row.title}</span>
                <Icon name="arrow" size={14} />
              </button>
            </li>
          ))}
        </ul>
        <p className="home-progress-note">
          Completed means a submitted design whose recorded test was Accepted. Status comes from the work saved in this
          browser.
        </p>
      </section>
    </div>
  )
}
