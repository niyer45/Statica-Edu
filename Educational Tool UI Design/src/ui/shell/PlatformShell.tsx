import { useContext, useEffect, useState } from 'react'
import { catalog, type CatalogEntry } from '../../challenge/catalog'
import type { InteractionMode, ModelRef } from '../../challenge/types'
import { selectTestCount, selectWorkspaceStarted } from '../../state/selectors'
import Icon from '../icons/Icon'
import { useChallenge, useSession, useStore } from '../state/store'
import { modelUiFor, ModelUiContext, useModelUi } from '../models/registry'
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
// - Multiple runnable challenges (task 34.1 step 2; MM-16, MM-23): this shell renders inside
//   the active challenge's StoreProvider. Other runnable challenges arrive as `others` with a
//   read-only saved summary; opening one asks the host (CatalogHost) to switch stores. With no
//   `others` the shell behaves exactly as the single-challenge shell.

export const PRODUCT_NAME = 'Statica'

export type Page = 'Challenges' | 'Learning paths' | 'My designs' | 'Notebook'

const PAGES: readonly [Page, string][] = [
  ['Challenges', 'grid'],
  ['Learning paths', 'chart'],
  ['My designs', 'cube'],
  ['Notebook', 'book'],
]

/** A runnable challenge other than the active one, summarized from its own saved session. */
export interface OtherChallenge {
  challengeId: string
  title: string
  /** Explicit model identity, for model-specific drawer wording (task 34.2). */
  model: Readonly<ModelRef>
  allowedModes: readonly InteractionMode[]
  /** Saved workspace summary, read without touching the active store. */
  saved?: { mode: InteractionMode; started: boolean }
}

export interface PlatformShellProps {
  /** Library entries; defaults to the bundled catalog. */
  entries?: readonly CatalogEntry[]
  others?: readonly OtherChallenge[]
  /** Switch the host to another runnable challenge, entering in `mode` (chosen before entry, D-37). */
  onOpenOther?: (challengeId: string, mode: InteractionMode) => void
  /** Enter the workbench in this mode on mount (after a host switch); selectMode persists it. */
  enterOnMount?: InteractionMode
  /** Lifted page-session state, so it survives a store switch. Uncontrolled when omitted. */
  saved?: readonly string[]
  onSavedChange?: (saved: string[]) => void
  notes?: string
  onNotesChange?: (notes: string) => void
}

interface Detail {
  entry: CatalogEntry
  mode: InteractionMode
  error: string | null
}

export function rejectedModeMessage(mode: InteractionMode): string {
  return `${MODE_LABELS[mode]} mode is not available for this challenge yet.`
}

export default function PlatformShell({
  entries = catalog,
  others = [],
  onOpenOther,
  enterOnMount,
  saved: savedProp,
  onSavedChange,
  notes: notesProp,
  onNotesChange,
}: PlatformShellProps = {}) {
  const { selectMode } = useStore()
  const session = useSession()
  const challenge = useChallenge()
  const activeUi = useModelUi()
  const uiRegistry = useContext(ModelUiContext)

  const [page, setPage] = useState<Page>('Challenges')
  const [workspace, setWorkspace] = useState(enterOnMount !== undefined)
  const [opened, setOpened] = useState(enterOnMount !== undefined)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [savedState, setSavedState] = useState<string[]>([])
  const [notesState, setNotesState] = useState('')
  const [resource, setResource] = useState<string | null>(null)
  const saved = savedProp ?? savedState
  const setSaved = (update: (s: readonly string[]) => string[]) => {
    const next = update(saved)
    if (onSavedChange) onSavedChange(next)
    else setSavedState(next)
  }
  const notes = notesProp ?? notesState
  const setNotes = onNotesChange ?? setNotesState

  useEffect(() => {
    document.title = PRODUCT_NAME
  }, [])
  // Mount-only: the host remounts this shell (new store key) for every switch.
  useEffect(() => {
    if (enterOnMount !== undefined && !selectMode(enterOnMount)) setWorkspace(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const otherFor = (e: CatalogEntry) => (e.available ? others.find((o) => o.challengeId === e.challengeId) : undefined)
  const isActive = (e: CatalogEntry) => e.available && e.challengeId === challenge.id
  const isRunnable = (e: CatalogEntry) => isActive(e) || (onOpenOther !== undefined && otherFor(e) !== undefined)
  const modesFor = (e: CatalogEntry) => otherFor(e)?.allowedModes ?? challenge.allowedModes
  const featured = entries.find(isActive) ?? entries[0]
  if (featured === undefined) throw new Error('The challenge catalog is empty.')
  const testCount = selectTestCount(session)
  const started = opened || selectWorkspaceStarted(session)

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
    const other = otherFor(detail.entry)
    if (other !== undefined && !isActive(detail.entry)) {
      // Another challenge's store opens it; reject disallowed modes here, as selectMode would.
      if (!other.allowedModes.includes(mode)) setDetail({ ...detail, error: rejectedModeMessage(mode) })
      else onOpenOther?.(other.challengeId, mode)
      return
    }
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
                  <span className="nav-count">{String(entries.length).padStart(2, '0')}</span>
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
                  entries={entries}
                  modesFor={modesFor}
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
                  others={others.flatMap((o) =>
                    o.saved?.started && onOpenOther
                      ? [{ id: o.challengeId, title: o.title, mode: o.saved.mode, onReturn: () => onOpenOther(o.challengeId, o.saved!.mode) }]
                      : [],
                  )}
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
          allowedModes={modesFor(detail.entry)}
          availableText={(() => {
            const other = otherFor(detail.entry)
            return other ? modelUiFor(other.model, uiRegistry)?.copy.drawerAvailable : activeUi.copy.drawerAvailable
          })()}
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
