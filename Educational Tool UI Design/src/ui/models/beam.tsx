import { lazy, Suspense } from 'react'
import { SECTION_KIND_NAMES } from '../../evaluation/explain'
import type { Efficiency } from '../../evaluation/types'
import type { SessionState } from '../../state/session'
import NumericControls from '../controls/NumericControls'
import HelpDialog from '../dialogs/HelpDialog'
import HistoryCompare from '../history/HistoryCompare'
import RequirementsPanel from '../panels/RequirementsPanel'
import SectionPalette from '../palette/SectionPalette'
import ViewportBoundary from '../viewport/ViewportBoundary'
import ViewportLoading from '../viewport/ViewportLoading'
import type { ModelUi } from './types'
import { BEAM_GUIDED_PLAN } from '../../evaluation/guided/beam'

// Cantilever beam UI (task 34.2; MM-20). Wraps the existing Cantilever Beam I components and
// wording unchanged; only their placement moved from Workbench/ModeExperience/dialogs into
// this registry entry. The viewport scene stays a separate lazy chunk (Req 24.5).

const Viewport3D = lazy(() => import('../viewport/Viewport3D'))

export const BEAM_LIMITS_NOTICE = 'Idealized beam approximation, not a structural certification'

export const beamUi: ModelUi = {
  copy: {
    tagline: 'Reduce deflection within mass and stress limits.',
    solverLabel: 'Euler–Bernoulli · Beam solver',
    limitsNotice: BEAM_LIMITS_NOTICE,
    drawerAvailable: 'Available with an idealized beam solver. Length, load, material, and support remain fixed by the challenge.',
    prediction: {
      title: 'Predict deflection',
      question: (previous) => `Compared with ${previous}, how will your new section change tip deflection?`,
      legend: 'Predicted change in tip deflection',
    },
    efficiency: (efficiency) => {
      const e = efficiency as Efficiency
      return [
        { label: 'Mass usage', value: e.massUsage },
        { label: 'Deflection margin', value: e.deflectionMargin },
        { label: 'Stress margin', value: e.stressMargin },
      ]
    },
  },
  Tools: ({ onAnnounce }) => (
    <>
      <SectionPalette />
      <NumericControls onAnnounce={onAnnounce} />
    </>
  ),
  View: ({ onUnavailable }) => (
    <ViewportBoundary onUnavailable={onUnavailable}>
      <Suspense fallback={<ViewportLoading />}>
        <Viewport3D onUnavailable={onUnavailable} />
      </Suspense>
    </ViewportBoundary>
  ),
  ChallengePanel: RequirementsPanel,
  Results: HistoryCompare,
  Help: HelpDialog,
  guided: BEAM_GUIDED_PLAN,
  announceEdit: (session, lastAction) =>
    lastAction.type === 'applySection' ? `Section applied: ${SECTION_KIND_NAMES[(session as unknown as SessionState).draft.section.kind]}.` : undefined,
}
