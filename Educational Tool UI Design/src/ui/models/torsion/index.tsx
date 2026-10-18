import { lazy, Suspense } from 'react'
import type { TorsionEfficiency } from '../../../evaluation/torsion/types'
import ViewportBoundary from '../../viewport/ViewportBoundary'
import ViewportLoading from '../../viewport/ViewportLoading'
import { supportsWebGL2 } from '../../viewport/webgl'
import type { ModelUi } from '../types'
import TorsionChallengePanel from './TorsionChallengePanel'
import TorsionFallback from './TorsionFallback'
import TorsionHelp from './TorsionHelp'
import TorsionResults from './TorsionResults'
import TorsionTools from './TorsionTools'

// Torsion Shaft I UI (task 47.3; torsion-shaft-1 TSH-14, TSH-15; MM-20, MM-21).
// Task 54.2: the design view is a lazy 3D shaft chunk inside the shared ViewportBoundary, like
// the beam. The main-bundle SVG TorsionView (via TorsionFallback) is the boundary fallback and
// is rendered directly, without fetching the 3D chunk, when WebGL2 is unavailable.

const TorsionViewport3D = lazy(() => import('./TorsionViewport3D'))

export const TORSION_LIMITS_NOTICE = 'Idealized circular-shaft torsion, not a structural certification'

export const torsionUi: ModelUi = {
  copy: {
    tagline: 'Limit twist within shear stress, mass and packaging limits.',
    guidedContext: 'Solid and hollow shaft presets, diameter controls, and step-by-step prompts.',
    parametricContext: 'Precise diameter editing with the same validated torsion model.',
    parametricLabel: 'Direct shaft diameter editing',
    solverLabel: 'Saint-Venant · Circular shaft torsion',
    limitsNotice: TORSION_LIMITS_NOTICE,
    drawerAvailable: 'Available with an idealized circular-shaft torsion model. Length, torque, material, and support remain fixed by the challenge.',
    prediction: {
      title: 'Predict twist',
      question: (previous) => `Compared with ${previous}, how will your new shaft change its twist angle?`,
      legend: 'Predicted change in twist angle',
    },
    efficiency: (efficiency) => {
      const e = efficiency as TorsionEfficiency
      return [
        { label: 'Mass usage', value: e.massUsage },
        { label: 'Twist margin', value: e.twistMargin },
        { label: 'Stress margin', value: e.stressMargin },
      ]
    },
  },
  Tools: TorsionTools,
  View: ({ onUnavailable }) =>
    supportsWebGL2() ? (
      <ViewportBoundary onUnavailable={onUnavailable} fallback={<TorsionFallback onUnavailable={onUnavailable} />}>
        <Suspense fallback={<ViewportLoading />}>
          <TorsionViewport3D onUnavailable={onUnavailable} />
        </Suspense>
      </ViewportBoundary>
    ) : (
      <TorsionFallback onUnavailable={onUnavailable} />
    ),
  ChallengePanel: TorsionChallengePanel,
  Results: TorsionResults,
  Help: TorsionHelp,
  guidance: {
    steps: [
      { id: 'inspect', title: 'Inspect', instruction: 'Read the challenge and its limits. Find which limit the solid baseline shaft misses before editing.', hint: 'Expand Some things are fixed. to see the length, torque, material and support. Accepted applies to this idealized model, not a real-world safety approval.' },
      { id: 'experiment', title: 'Experiment', instruction: 'Change one diameter at a time. Predict how the twist angle will change, then Run Test to record the result.', hint: 'Try both a larger solid shaft and a hollow tube. The view keeps the latest tested twist until you run another test.' },
      { id: 'compare', title: 'Compare', instruction: 'Choose designs in Design history, then open Compare results. Compare twist and mass between solid and hollow shafts.', hint: 'Look at how much twist each design removes per kilogram. Like the beam, the gain comes from placing material far from the center, but torsion uses the polar moment rather than bending stiffness.' },
      { id: 'explain', title: 'Explain', instruction: 'Use your tested values to explain how the polar moment, twist and mass changed. Open Explain & submit to record a design and reflection.', hint: 'A submitted attempt can still be Not accepted. Name one effect the idealized shaft model does not include.' },
    ],
    experiment: () => undefined,
  },
}
