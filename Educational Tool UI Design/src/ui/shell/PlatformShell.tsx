import { useEffect, useState } from 'react'
import { catalog, type CatalogEntry } from '../../challenge/catalog'
import type { InteractionMode } from '../../challenge/types'
import { selectTestCount } from '../../state/selectors'
import Icon from '../icons/Icon'
import { useChallenge, useSession, useStore } from '../state/store'
import Workbench from '../workbench/Workbench'
import { MODE_LABELS } from '../workbench/WorkbenchChrome'
import ChallengeDrawer from './ChallengeDrawer'
import LearningPathsPage from './LearningPathsPage'
import LibraryPage from './LibraryPage'
import MyDesignsPage from './MyDesignsPage'
import NotebookPage from './NotebookPage'
import ResourceDialog, { ABOUT_TITLE } from './ResourceDialog'
import '../../platform-base.css'
import '../../platform.css'

// Platform shell (task 13.5; Req 34.1–34.9, 35.1, 35.2, 35.4), refactored from the template
// `src/App.tsx` with its class names.
//
// - The Workbench is mounted once and only hidden while another page is shown, so the
//   session (draft, history, compare, reflection, submission) lives in the store and is
//   unchanged by navigation (34.6).
// - Guided and Parametric open the same Workbench with the same store; only the session
//   `mode` differs. Opening goes through `selectMode`, which rejects modes outside the
//   challenge's `allowedModes` and keeps the current mode (35.1, 35.4).
// - Saved challenges and notebook text are React state only: in memory for this page
//   session, never sent anywhere (34.8).

export const PRODUCT_NAME = 'Statica'

export type Page = 'Challenges' | 'Learning paths' | 'My designs' | 'Notebook'

const PAGES: readonly [Page, string][] = [
  ['Challenges', 'grid'],
  ['Learning paths', 'chart'],
  ['My designs', 'cube'],
  ['Notebook', 'book'],
]

interface Detail {
  entry: CatalogEntry
  mode: InteractionMode
  error: string | null
}

export function rejectedModeMessage(mode: InteractionMode): string {
  return `${MODE_LABELS[mode]} mode is not available for this challenge yet.`
}

export default function PlatformShell() {
  const { selectMode } = useStore()
  const session = useSession()
  const challenge = useChallenge()

  const [page, setPage] = useState<Page>('Challenges')
  const [workspace, setWorkspace] = useState(false)
  const [opened, setOpened] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [saved, setSaved] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [resource, setResource] = useState<string | null>(null)

  useEffect(() => {
    document.title = PRODUCT_NAME
  }, [])

  const isRunnable = (e: CatalogEntry) => e.available && e.challengeId === challenge.id
  const featured = catalog.find(isRunnable) ?? catalog[0]
  if (featured === undefined) throw new Error('The challenge catalog is empty.')
  const testCount = selectTestCount(session)
  const started = opened || testCount > 0 || session.draftStatus === 'draft' || (session.deletedIterationIds?.length ?? 0) > 0 || session.reflectionAnswer.length > 0 || session.submission !== undefined

  const go = (p: Page) => {
    setPage(p)
    setWorkspace(false)
    setDetail(null)
  }

  /** Opens the loaded challenge in `mode`; rejected modes keep the current mode (Req 35.4). */
  const openWorkbench = (mode: InteractionMode): boolean => {
    if (!selectMode(mode)) return false
    setOpened(true)
    setWorkspace(true)
    setDetail(null)
    return true
  }

  /** Featured / resume / learning-path entry points reopen in the session's current mode. */
  const resume = () => {
    openWorkbench(session.mode)
  }

  const showDetail = (entry: CatalogEntry, mode: InteractionMode = session.mode) =>
    setDetail({ entry, mode, error: null })

  const openFromDrawer = (mode: InteractionMode) => {
    if (detail === null || !isRunnable(detail.entry)) return
    if (!openWorkbench(mode)) setDetail({ ...detail, error: rejectedModeMessage(mode) })
  }

  const toggleSaved = (id: string) =>
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <div className={`platform${workspace ? ' workbench-open' : ''}`}>
      <aside className="platform-sidebar">
        <button type="button" className="brand" onClick={() => go('Challenges')} aria-label={`${PRODUCT_NAME} home`}>
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          statica<span className="brand-dot">.</span>
        </button>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Platform">
          {PAGES.map(([label, icon]) => {
            const active = page === label && !workspace
            return (
              <button
                type="button"
                key={label}
                className={`nav-item ${active ? 'active' : ''}`}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                onClick={() => go(label)}
              >
                <Icon name={icon} />
                <span>{label}</span>
                {label === 'Challenges' && (
                  <span className="nav-count">{String(catalog.length).padStart(2, '0')}</span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-divider" />
        <div className="workspace-label">PICK UP WHERE YOU LEFT OFF</div>
        <button type="button" className="resume-nav" onClick={resume}>
          <span className="tiny-dot" />
          <span>
            {featured.title}
            <small>{started ? 'Resume challenge' : 'Available challenge'}</small>
          </span>
          <Icon name="arrow" size={14} />
        </button>
        <div className="platform-sidebar-bottom">
          <button type="button" className="nav-item" aria-label="Help & resources" onClick={() => setResource(ABOUT_TITLE)}>
            <Icon name="help" />
            <span>Help & resources</span>
          </button>
          <div className="profile">
            <div className="avatar">Y</div>
            <div>
              Your workspace<span>Explore at your own pace</span>
            </div>
            <Icon name="tune" size={14} />
          </div>
        </div>
      </aside>
      <div className="platform-main">
        <div className="mobile-platform-nav">
          <button type="button" className="brand" onClick={() => go('Challenges')} aria-label={`${PRODUCT_NAME} home`}>
            statica.
          </button>
          <select aria-label="Navigate workspace" value={page} onChange={(e) => go(e.target.value as Page)}>
            {PAGES.map(([p]) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        {/* Always mounted; hidden while another page is shown (Req 34.6). */}
        <div hidden={!workspace} data-testid="workbench-host">
          <Workbench onExit={() => go('Challenges')} />
        </div>
        {!workspace && (
          <>
            <header className="platform-topbar">
              <div>
                <span>Your workspace</span>
                <span>/</span>
                <strong>{page}</strong>
              </div>
              <div className="local-indicator">
                <span className="tiny-dot" />
                Personal learning space <span className="platform-top-divider" />{' '}
                <button type="button" onClick={() => setResource(ABOUT_TITLE)} aria-label="About your workspace">
                  <Icon name="help" size={16} />
                </button>
              </div>
            </header>
            <main className="platform-content">
              {page === 'Challenges' ? (
                <LibraryPage
                  featured={featured}
                  isRunnable={isRunnable}
                  allowedModes={challenge.allowedModes}
                  started={started}
                  saved={saved}
                  onToggleSaved={toggleSaved}
                  onOpenFeatured={resume}
                  onShowDetail={showDetail}
                />
              ) : page === 'Learning paths' ? (
                <LearningPathsPage testCount={testCount} onStart={resume} onPreview={setResource} />
              ) : page === 'My designs' ? (
                <MyDesignsPage
                  title={challenge.title}
                  mode={session.mode}
                  started={started}
                  onReturn={resume}
                  onFindChallenge={() => go('Challenges')}
                />
              ) : (
                <NotebookPage notes={notes} onChange={setNotes} />
              )}
            </main>
          </>
        )}
      </div>
      {detail !== null && (
        <ChallengeDrawer
          entry={detail.entry}
          runnable={isRunnable(detail.entry)}
          allowedModes={challenge.allowedModes}
          mode={detail.mode}
          onModeChange={(mode) => setDetail({ ...detail, mode, error: null })}
          onOpen={openFromDrawer}
          onClose={() => setDetail(null)}
          error={detail.error}
          onFallback={() => setDetail({ entry: featured, mode: 'guided', error: null })}
        />
      )}
      {resource !== null && (
        <ResourceDialog
          title={resource}
          onClose={() => setResource(null)}
          onExplore={() => {
            setResource(null)
            go('Challenges')
          }}
        />
      )}
    </div>
  )
}
