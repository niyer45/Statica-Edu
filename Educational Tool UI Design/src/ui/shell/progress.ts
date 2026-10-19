import type { ArtKind, Discipline } from '../../challenge/catalog'
import type { InteractionMode } from '../../challenge/types'
import type { ProgressStatus } from '../../state/selectors'
import type { AccountContextValue } from '../account/AccountContext'

// Per-challenge progress shown in My designs (task 38, moved from Home in task 62), derived from
// each challenge's stored session (see selectProgress). Nothing here is persisted.

export interface ProgressRow {
  challengeId: string
  title: string
  art: ArtKind
  discipline: Discipline
  status: ProgressStatus
  testsRun: number
  submission?: string
  /** True for the challenge whose store is mounted (the workbench behind the page). */
  active: boolean
  /** The workspace has been opened or holds saved work. */
  started: boolean
  /** Mode of the saved or open workspace, when there is one. */
  mode?: InteractionMode
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
