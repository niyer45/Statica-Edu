import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import LiveRegion, { nextAnnouncement, type Announcement } from '../a11y/LiveRegion'
import Toast from '../a11y/Toast'
import { AnnounceContext, useAnnouncements } from '../a11y/useAnnouncements'
import PredictionDialog from '../dialogs/PredictionDialog'
import SubmitDialog from '../dialogs/SubmitDialog'
import Icon from '../icons/Icon'
import { useModelUi } from '../models/registry'
import { selectStatusBadge } from '../../state/selectors'
import { useSession } from '../state/store'
import PageFooter from './PageFooter'
import WorkbenchChrome, { MODE_LABELS } from './WorkbenchChrome'
import ModeExperience from './ModeExperience'
export { default as ViewportLoading, VIEWPORT_LOADING_TEXT } from '../viewport/ViewportLoading'

// Workbench layout (task 13.3; Req 24.1–24.7, 24.9–24.11).
//
// Template `.workbench` grid with the original region class names so `index.css` drives
// every breakpoint (> 870 three columns with full-width results; ≤ 870 two columns with the
// challenge panel spanning; ≤ 620 single column viewport → design → challenge → results;
// sidebar collapsed ≤ 1050 and hidden ≤ 620). Regions are filled by per-task components.
//
// Regions are filled by the active model's UI (task 34.2; ui/models registry): design tools,
// design view (with its own lazy chunk, loading placeholder and fallback boundary), challenge
// panel, results and help. Chrome, toast, prediction/submit dialogs and the single live region
// stay shared.

type Modal = 'submit' | 'help' | null

export interface WorkbenchProps {
  onExit: () => void
}

// The shell selects the mode before entry; Workbench has no mode-changing control.
export default function Workbench({ onExit }: WorkbenchProps) {
  const session = useSession()
  const ui = useModelUi()
  const [modal, setModal] = useState<Modal>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)

  /** Shows a visual toast and announces the same text once through the live region. */
  const notify = useCallback((message: string) => {
    setNotice(message)
    setAnnouncement((prev) => nextAnnouncement(prev, message))
  }, [])

  useAnnouncements(notify)

  const dismissNotice = useCallback(() => setNotice(null), [])
  const openHelp = () => setModal('help')

  return (
    <AnnounceContext.Provider value={notify}>
      <WorkbenchChrome
        onExit={onExit}
        onOpenHelp={openHelp}
        onShowDesigns={() => notify('Your local designs are collected in the history below.')}
      >
        <ModeExperience />
        <div className="workbench">
          <section className="design-panel panel" aria-label="Design tools">
            <div className="panel-title">
              <Icon name="tune" size={16} />
              <h2>Design tools</h2>
              <span className="guided">{MODE_LABELS[session.mode]}</span>
            </div>
            <div className="tools-body">
              <ui.Tools onAnnounce={notify} />
            </div>
          </section>
          <section className="viewport panel" aria-label="Design view">
            <div className="viewport-top">
              <div>
                <span className="viewport-label">DESIGN VIEW</span>
                <span className="draft-badge" aria-label="Test status">{selectStatusBadge(session)}</span>
              </div>
            </div>
            <ui.View onUnavailable={notify} />
          </section>
          <aside className="challenge-panel panel" aria-label="The challenge">
            <ui.ChallengePanel onOpenHelp={openHelp} />
          </aside>
        </div>
        <section className="results-panel panel" aria-label="Results">
          <ui.Results />
        </section>
        <PageFooter onExplainSubmit={() => setModal('submit')} />
        <Toast message={notice} onDismiss={dismissNotice} />
      </WorkbenchChrome>
      <PredictionDialog />
      <SubmitDialog open={modal === 'submit'} onClose={() => setModal(null)} />
      <ui.Help open={modal === 'help'} onClose={() => setModal(null)} />
      {/* Portaled to <body> so it stays present and unhidden while the template shell hides
          the Workbench during page navigation (Req 30.6). */}
      {createPortal(<LiveRegion announcement={announcement} />, document.body)}
    </AnnounceContext.Provider>
  )
}
