import { useContext, useEffect, useState } from 'react'
import { catalog, type CatalogEntry } from '../../challenge/catalog'
import type { InteractionMode, ModelRef } from '../../challenge/types'
import { selectProgress, selectWorkspaceStarted, type ChallengeProgress } from '../../state/selectors'
import { useAccount } from '../account/AccountContext'
import AccountPage from '../account/AccountPage'
import Icon from '../icons/Icon'
import { useChallenge, useSession, useStore } from '../state/store'
import { modelUiFor, ModelUiContext, useModelUi } from '../models/registry'
import Workbench from '../workbench/Workbench'
import { MODE_LABELS } from '../workbench/WorkbenchChrome'
import ChallengeDrawer from './ChallengeDrawer'
import HomePage from './HomePage'
import { storageStatement, type ProgressRow } from './progress'
import LibraryPage from './LibraryPage'
import MyDesignsPage from './MyDesignsPage'
import NotebookPage from './NotebookPage'
import ResourceDialog, { ABOUT_TITLE } from './ResourceDialog'
import { pushRoute, routeFromHash, type AccountView, type Page } from './routes'
import { LEARN_SUBJECTS, learnModule } from '../../learn/catalog'
import { commitPrediction, readProgress, writeProgress, type LearnProgress, type LearnStorage } from '../../learn/progress'
import type { LearnModule } from '../../learn/types'
import LearnPage from '../learn/LearnPage'
import ModulePage from '../learn/ModulePage'
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
// - Home and accounts (task 38, 62): Home presents what Statica does now and where it is going,
//   with account / guest entry; My designs holds each runnable challenge's progress. With `routed`, the page lives in the URL fragment (routes.ts) and the
//   app starts on Home; without it (isolated tests) the shell starts on Challenges as before.

export const PRODUCT_NAME = 'Statica'

export type { Page }

// Home is the standalone landing page (task 63), reached from the brand, not a workspace page.
const PAGES: readonly [Page, string][] = [
  ['Challenges', 'grid'],
  ['Learn', 'bulb'],
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
  saved?: { mode: InteractionMode; started: boolean; progress?: ChallengeProgress }
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
  /** Keep the page in the URL fragment and start on Home (the app); otherwise start on Challenges. */
  routed?: boolean
  /** Guest/account-scoped storage for Learn progress (task 67); in memory when omitted. */
  learnStorage?: LearnStorage | null
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
  routed = false,
  learnStorage = null,
}: PlatformShellProps = {}) {
  const { selectMode } = useStore()
  const session = useSession()
  const challenge = useChallenge()
  const activeUi = useModelUi()
  const uiRegistry = useContext(ModelUiContext)
  const account = useAccount()

  const [route] = useState(() => (routed && typeof window !== 'undefined' ? routeFromHash(window.location.hash) : { page: 'Challenges' as Page, view: 'sign-up' as AccountView }))
  const [page, setPage] = useState<Page>(route.page === 'Account' && account === null ? 'Home' : route.page)
  const [accountView, setAccountView] = useState<AccountView>(route.view)
  const [workspace, setWorkspace] = useState(enterOnMount !== undefined)
  const [opened, setOpened] = useState(enterOnMount !== undefined)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [savedState, setSavedState] = useState<string[]>([])
  const [notesState, setNotesState] = useState('')
  const [resource, setResource] = useState<string | null>(null)
  const [learnStore] = useState<LearnStorage>(() => learnStorage ?? memoryLearnStorage())
  const [moduleId, setModuleId] = useState<string | null>(route.moduleId ?? null)
  const openModule = moduleId === null ? undefined : learnModule(moduleId)
  const [learnProgress, setLearnProgress] = useState<LearnProgress>(() => (openModule ? readProgress(learnStore, openModule) : {}))
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
  // Back/Forward and edited fragments switch pages like the navigation does.
  useEffect(() => {
    if (!routed) return
    const onHash = () => {
      const next = routeFromHash(window.location.hash)
      setPage(next.page === 'Account' && account === null ? 'Home' : next.page)
      setAccountView(next.view)
      setModuleOpen(next.moduleId ?? null)
      setWorkspace(false)
      setDetail(null)
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [routed, account === null]) // eslint-disable-line react-hooks/exhaustive-deps

  const otherFor = (e: CatalogEntry) => (e.available ? others.find((o) => o.challengeId === e.challengeId) : undefined)
  const isActive = (e: CatalogEntry) => e.available && e.challengeId === challenge.id
  const isRunnable = (e: CatalogEntry) => isActive(e) || (onOpenOther !== undefined && otherFor(e) !== undefined)
  const modesFor = (e: CatalogEntry) => otherFor(e)?.allowedModes ?? challenge.allowedModes
  const featured = entries.find(isActive) ?? entries[0]
  if (featured === undefined) throw new Error('The challenge catalog is empty.')
  const started = opened || selectWorkspaceStarted(session)

  /** Opens a Learn module (or the hub with null) and loads its saved progress. */
  function setModuleOpen(id: string | null) {
    const m = id === null ? undefined : learnModule(id)
    setModuleId(m ? m.id : null)
    setLearnProgress(m ? readProgress(learnStore, m) : {})
  }

  const go = (p: Page, view?: AccountView, module?: LearnModule) => {
    setPage(p)
    if (view !== undefined) setAccountView(view)
    setModuleOpen(module?.id ?? null)
    setWorkspace(false)
    setDetail(null)
    if (routed) pushRoute(p, p === 'Account' ? (view ?? accountView) : undefined, module?.id)
  }

  const predict = (m: LearnModule, stepId: string, optionId: string) => {
    const next = commitPrediction(m, learnProgress, stepId, optionId)
    writeProgress(learnStore, m, next)
    setLearnProgress(next)
  }

  /** Opens the loaded challenge in `mode`; rejected modes keep the current mode (Req 35.4). */
  const openWorkbench = (mode: InteractionMode): boolean => {
    if (!selectMode(mode)) return false
    setOpened(true)
    setWorkspace(true)
    setDetail(null)
    return true
  }

  /** Opens any runnable challenge in `mode`, as the drawer does (Learn's Apply it, task 67; D-37). */
  const openChallenge = (challengeId: string, mode: InteractionMode) => {
    if (challenge.id === challengeId) {
      openWorkbench(mode)
      return
    }
    const other = others.find((o) => o.challengeId === challengeId)
    if (other !== undefined && other.allowedModes.includes(mode)) onOpenOther?.(challengeId, mode)
  }

  /** Featured / resume entry points reopen in the session's current mode. */
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

  // Progress (My designs, Home): every runnable challenge, from the live session (active) or its own saved session.
  const progressRows: ProgressRow[] = entries.filter((e): e is Extract<CatalogEntry, { available: true }> => e.available && isRunnable(e)).map((entry) => {
    const card = { challengeId: entry.challengeId, title: entry.title, art: entry.art, discipline: entry.discipline }
    if (isActive(entry)) {
      const progress = selectProgress(session)
      return { ...card, ...progress, active: true, started, mode: started ? session.mode : undefined, onContinue: () => (progress.status === 'notStarted' && !started ? showDetail(entry) : resume()) }
    }
    const other = otherFor(entry)!
    const progress = other.saved?.progress ?? { status: 'notStarted' as const, testsRun: 0 }
    const savedMode = other.saved?.started ? other.saved.mode : undefined
    return {
      ...card,
      ...progress,
      active: false,
      started: other.saved?.started === true,
      mode: savedMode,
      onContinue: () => (savedMode === undefined ? showDetail(entry) : onOpenOther?.(other.challengeId, savedMode)),
    }
  })
  const pages = account ? [...PAGES, ['Account', 'user'] as [Page, string]] : PAGES

  const toggleSaved = (id: string) =>
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  // The landing page replaces the whole workspace chrome; the Workbench stays mounted (Req 34.6).
  const landing = page === 'Home' && !workspace

  return (
    <div className={`platform${workspace ? ' workbench-open' : ''}${landing ? ' landing-open' : ''}`}>
      <aside className="platform-sidebar" hidden={landing}>
        <button type="button" className="brand" onClick={() => go('Home')} aria-label={`${PRODUCT_NAME} home`}>
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
          {account ? (
            <button
              type="button"
              className="profile"
              aria-label={account.user ? `Account: ${account.user.displayName}` : 'Account: guest'}
              aria-current={page === 'Account' && !workspace ? 'page' : undefined}
              onClick={() => go('Account', account.user ? undefined : 'sign-in')}
            >
              <div className="avatar" aria-hidden="true">{(account.user?.displayName.trim()[0] ?? 'G').toUpperCase()}</div>
              <div>
                {account.user ? account.user.displayName : 'Guest'}
                <span>{account.user ? 'Saved on this device' : 'Sign in or create account'}</span>
              </div>
              <Icon name="user" size={14} />
            </button>
          ) : (
            <div className="profile">
              <div className="avatar">Y</div>
              <div>
                Your workspace<span>Explore at your own pace</span>
              </div>
              <Icon name="tune" size={14} />
            </div>
          )}
        </div>
      </aside>
      <div className="platform-main">
        <div className="mobile-platform-nav" hidden={landing}>
          <button type="button" className="brand" onClick={() => go('Home')} aria-label={`${PRODUCT_NAME} home`}>
            statica.
          </button>
          <select aria-label="Navigate workspace" value={page === 'Home' ? '' : page} onChange={(e) => go(e.target.value as Page)}>
            {page === 'Home' && <option value="" disabled>Choose a page</option>}
            {pages.map(([p]) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        {/* Always mounted; hidden while another page is shown (Req 34.6). */}
        <div hidden={!workspace} data-testid="workbench-host">
          <Workbench onExit={() => go('Challenges')} />
        </div>
        {landing && (
          <HomePage
            account={account}
            entries={entries}
            startedCount={progressRows.filter((r) => r.started || r.status !== 'notStarted').length}
            onBrowse={() => go('Challenges')}
            onMyDesigns={() => go('My designs')}
            onAccount={(view) => go('Account', view)}
          />
        )}
        {!workspace && !landing && (
          <>
            <header className="platform-topbar">
              <div>
                <span>Your workspace</span>
                <span>/</span>
                <strong>{page}</strong>
              </div>
              <div className="local-indicator" title={storageStatement(account)}>
                <span className="tiny-dot" />
                {account?.user ? `${account.user.displayName} · saved on this device` : account ? 'Guest · saved on this device' : 'Personal learning space'}{' '}
                <span className="platform-top-divider" />{' '}
                <button type="button" onClick={() => setResource(ABOUT_TITLE)} aria-label="About your workspace">
                  <Icon name="help" size={16} />
                </button>
              </div>
            </header>
            <main className="platform-content">
              {page === 'Account' && account ? (
                <AccountPage
                  account={account}
                  view={accountView}
                  onViewChange={(view) => go('Account', view)}
                  guestWork={progressRows.filter((r) => r.status !== 'notStarted').map((r) => r.title)}
                  onBrowse={() => go('Challenges')}
                />
              ) : page === 'Challenges' || page === 'Account' ? (
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
              ) : page === 'Learn' && openModule ? (
                <ModulePage
                  key={openModule.id}
                  module={openModule}
                  path={learnPath(openModule)}
                  progress={learnProgress}
                  onPredict={(stepId, optionId) => predict(openModule, stepId, optionId)}
                  onBack={() => go('Learn')}
                  onApply={() => openChallenge(openModule.apply.challengeId, 'guided')}
                />
              ) : page === 'Learn' ? (
                <LearnPage storage={learnStore} onOpen={(m) => go('Learn', undefined, m)} />
              ) : page === 'My designs' ? (
                <MyDesignsPage account={account} rows={progressRows} onFindChallenge={() => go('Challenges')} />
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

/** Subject and topic titles above a module, for its breadcrumb. */
function learnPath(m: LearnModule): string[] {
  for (const subject of LEARN_SUBJECTS) {
    for (const topic of subject.topics) {
      if (topic.modules.some((e) => e.status === 'available' && e.module.id === m.id)) return [subject.title, topic.title, m.title]
    }
  }
  return [m.title]
}

function memoryLearnStorage(): LearnStorage {
  const values = new Map<string, string>()
  return { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v) }
}
