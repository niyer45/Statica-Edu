import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import LiveRegion, { nextAnnouncement, type Announcement } from '../a11y/LiveRegion'
import Toast from '../a11y/Toast'
import NumericControls from '../controls/NumericControls'
import HelpDialog from '../dialogs/HelpDialog'
import PredictionDialog from '../dialogs/PredictionDialog'
import SubmitDialog from '../dialogs/SubmitDialog'
import HistoryCompare from '../history/HistoryCompare'
import Icon from '../icons/Icon'
import SectionPalette from '../palette/SectionPalette'
import RequirementsPanel from '../panels/RequirementsPanel'
import { selectStatusBadge } from '../../state/selectors'
import { useSession } from '../state/store'
import PageFooter from './PageFooter'
import WorkbenchChrome, { MODE_LABELS } from './WorkbenchChrome'
import WorkflowStepper from './WorkflowStepper'

// Workbench layout (task 13.3; Req 24.1–24.7, 24.9–24.11).
//
// Template `.workbench` grid with the original region class names so `index.css` drives
// every breakpoint (> 870 three columns with full-width results; ≤ 870 two columns with the
// challenge panel spanning; ≤ 620 single column viewport → design → challenge → results;
// sidebar collapsed ≤ 1050 and hidden ≤ 620). Regions are filled by per-task components.
//
// The viewport scene is a separate lazy chunk (Req 24.5): panels render first and the
// viewport shows a same-footprint "3D view is loading" placeholder until it resolves (24.6,
// 24.7). Task 14.4 adds ViewportBoundary for load failure.

const Viewport3D = lazy(() => import('../viewport/Viewport3D'))

export const VIEWPORT_LOADING_TEXT = '3D view is loading'

/** Same footprint as the scene: fills the `.viewport` flex column like `.beam-scene`. */
export function ViewportLoading() {
  return (
    <div className="beam-scene viewport-loading grid place-items-center cursor-default!" role="status">
      <span className="viewport-label">{VIEWPORT_LOADING_TEXT}</span>
    </div>
  )
}

type Modal = 'submit' | 'help' | null

export interface WorkbenchProps {
  onExit: () => void
}

// Mode selection lives in the platform shell (ui/shell/PlatformShell), which calls the
// store's `selectMode`; the Workbench renders whatever `session.mode` is (Req 35.1, 35.4).
export default function Workbench({ onExit }: WorkbenchProps) {
  const session = useSession()
  const [modal, setModal] = useState<Modal>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)

  /** Shows a visual toast and announces the same text once through the live region. */
  const notify = useCallback((message: string) => {
    setNotice(message)
    setAnnouncement((prev) => nextAnnouncement(prev, message))
  }, [])

  // Reducer notices (task 19) flow to the toast and live region.
  const reducerNotice = session.ui.notice?.message
  useEffect(() => {
    if (reducerNotice !== undefined) notify(reducerNotice)
  }, [reducerNotice, notify])

  const openHelp = () => setModal('help')

  return (
    <>
      <WorkbenchChrome
        onExit={onExit}
        onOpenHelp={openHelp}
        onShowDesigns={() => notify('Your local designs are collected in the history below.')}
      >
        <WorkflowStepper />
        <div className="workbench">
          <section className="design-panel panel" aria-label="Design tools">
            <div className="panel-title">
              <Icon name="tune" size={16} />
              <h2>Design tools</h2>
              <span className="guided">{MODE_LABELS[session.mode]}</span>
            </div>
            <div className="tools-body">
              <SectionPalette />
              <NumericControls onAnnounce={notify} />
            </div>
          </section>
          <section className="viewport panel" aria-label="Design view">
            <div className="viewport-top">
              <div>
                <span className="viewport-label">DESIGN VIEW</span>
                <span className="draft-badge">{selectStatusBadge(session)}</span>
              </div>
            </div>
            <Suspense fallback={<ViewportLoading />}>
              <Viewport3D />
            </Suspense>
          </section>
          <aside className="challenge-panel panel" aria-label="The challenge">
            <RequirementsPanel onOpenHelp={openHelp} />
          </aside>
        </div>
        <section className="results-panel panel" aria-label="Results">
          <HistoryCompare />
        </section>
        <PageFooter onExplainSubmit={() => setModal('submit')} />
        <Toast message={notice} onDismiss={() => setNotice(null)} />
      </WorkbenchChrome>
      <PredictionDialog />
      <SubmitDialog open={modal === 'submit'} onClose={() => setModal(null)} />
      <HelpDialog open={modal === 'help'} onClose={() => setModal(null)} />
      {/* Portaled to <body> so it stays present and unhidden while the template shell hides
          the Workbench during page navigation (Req 30.6). */}
      {createPortal(<LiveRegion announcement={announcement} />, document.body)}
    </>
  )
}
