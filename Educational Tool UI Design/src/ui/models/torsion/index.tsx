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
import { TORSION_GUIDED_PLAN } from '../../../evaluation/guided/torsion'

// Torsion Shaft I UI (task 47.3; torsion-shaft-1 TSH-14, TSH-15; MM-20, MM-21).
// Task 54.2: the design view is a lazy 3D shaft chunk inside the shared ViewportBoundary, like
// the beam. The main-bundle SVG TorsionView (via TorsionFallback) is the boundary fallback and
// is rendered directly, without fetching the 3D chunk, when WebGL2 is unavailable.

const TorsionViewport3D = lazy(() => import('./TorsionViewport3D'))

export const TORSION_LIMITS_NOTICE = 'Idealized circular-shaft torsion, not a structural certification'

export const torsionUi: ModelUi = {
  copy: {
    tagline: 'Limit twist within shear stress, mass and packaging limits.',
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
      <ViewportBoundary onUnavailable={onUnavailable} fallback={TorsionFallback}>
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
  guided: TORSION_GUIDED_PLAN,
}
