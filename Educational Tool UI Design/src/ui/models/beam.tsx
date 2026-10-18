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

// Cantilever beam UI (task 34.2; MM-20). Wraps the existing Cantilever Beam I components and
// wording unchanged; only their placement moved from Workbench/ModeExperience/dialogs into
// this registry entry. The viewport scene stays a separate lazy chunk (Req 24.5).

const Viewport3D = lazy(() => import('../viewport/Viewport3D'))

export const BEAM_LIMITS_NOTICE = 'Idealized beam approximation, not a structural certification'

export const beamUi: ModelUi = {
  copy: {
    tagline: 'Reduce deflection within mass and stress limits.',
    guidedContext: 'Shape presets, dimension controls, and step-by-step prompts.',
    parametricContext: 'Precise parameter editing with the same validated beam model.',
    parametricLabel: 'Direct section and dimension editing',
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
  guidance: {
    steps: [
      { id: 'inspect', title: 'Inspect', instruction: 'Read the challenge and its limits. Find which requirements the Baseline misses before editing.', hint: 'Expand Some things are fixed. to inspect the load, span, material and support. Accepted applies to this idealized model, not a real-world safety approval.' },
      { id: 'experiment', title: 'Experiment', instruction: 'Change one section dimension or orientation. Predict what will happen, then Run Test to record the result.', hint: 'Change one thing at a time so you can explain its effect. The dotted outline stays on the latest tested design until you run another test.' },
      { id: 'compare', title: 'Compare', instruction: 'Choose designs in Design history, then open Compare results. Select a design to inspect its values against Baseline.', hint: 'Look for a stiffness and mass tradeoff. Restore copies a tested design into the draft; the recorded results remain unchanged.' },
      { id: 'explain', title: 'Explain', instruction: 'Use your tested values to explain one design decision. Open Explain & submit to record a design and reflection.', hint: 'A submitted attempt can still be Not accepted. Explain remaining failures and one effect the idealized beam model does not include.' },
    ],
    experiment: (session) => {
      const kind = (session as unknown as SessionState).draft.section.kind
      return kind === 'circle' || kind === 'tube'
        ? 'Try a diameter change and compare stiffness with mass. For a tube, consider both the outer diameter and wall thickness.'
        : 'Try rotating a rectangle or I-section before adding material. Compare the tested deflection, stress and mass.'
    },
  },
  announceEdit: (session, lastAction) =>
    lastAction.type === 'applySection' ? `Section applied: ${SECTION_KIND_NAMES[(session as unknown as SessionState).draft.section.kind]}.` : undefined,
}
