import type { BracedFrameEfficiency } from '../../../evaluation/bracedFrame/types'
import type { ModelUi } from '../types'
import BracedFrameChallengePanel from './BracedFrameChallengePanel'
import BracedFrameHelp from './BracedFrameHelp'
import BracedFrameResults from './BracedFrameResults'
import BracedFrameTools from './BracedFrameTools'
import BracedFrameView from './BracedFrameView'
import { BRACED_FRAME_GUIDED_PLAN } from '../../../evaluation/guided/bracedFrame'

// Braced Frame I UI (task 49.3; braced-frame-1 BFR-16, BFR-17; MM-20, MM-21). Registered in the
// production model UI registry; the catalog card stays unavailable until owner-approved
// activation. Guided hints never state the reference sections, invent numbers or claim that one
// diagonal direction is always best.

export const BRACED_FRAME_LIMITS_NOTICE = 'Idealized pin-jointed frame, not a structural certification'

export const bracedFrameUi: ModelUi = {
  copy: {
    tagline: 'Brace a two-storey frame and size its members within drift, capacity and mass limits.',
    solverLabel: 'Direct stiffness · Pin-jointed frame',
    limitsNotice: BRACED_FRAME_LIMITS_NOTICE,
    drawerAvailable:
      'Available with an idealized pin-jointed frame model: every joint is a hinge, so members carry only tension or compression. Geometry, supports, loads, and material remain fixed by the challenge.',
    prediction: {
      title: 'Predict roof drift',
      question: (previous) => `Compared with ${previous}, how will your new frame change its roof drift?`,
      legend: 'Predicted change in roof drift',
    },
    // Only the margins the stored submission has: a mechanism stores no drift or utilization margin.
    efficiency: (efficiency) => {
      const e = efficiency as BracedFrameEfficiency
      const rows: { label: string; value: number }[] = [{ label: 'Mass usage', value: e.massUsage }]
      if (e.driftUsage !== undefined) rows.push({ label: 'Roof drift usage', value: e.driftUsage })
      if (e.maxUtilization !== undefined) rows.push({ label: 'Maximum member utilization', value: e.maxUtilization })
      return rows
    },
  },
  Tools: BracedFrameTools,
  View: BracedFrameView,
  ChallengePanel: BracedFrameChallengePanel,
  Results: BracedFrameResults,
  Help: BracedFrameHelp,
  guided: BRACED_FRAME_GUIDED_PLAN,
}
