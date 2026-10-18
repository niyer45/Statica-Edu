import type { BracedFrameEfficiency } from '../../../evaluation/bracedFrame/types'
import type { ModelUi } from '../types'
import BracedFrameChallengePanel from './BracedFrameChallengePanel'
import BracedFrameHelp from './BracedFrameHelp'
import BracedFrameResults from './BracedFrameResults'
import BracedFrameTools from './BracedFrameTools'
import BracedFrameView from './BracedFrameView'

// Braced Frame I UI (task 49.3; braced-frame-1 BFR-16, BFR-17; MM-20, MM-21). Registered in the
// production model UI registry; the catalog card stays unavailable until owner-approved
// activation. Guided hints never state the reference sections, invent numbers or claim that one
// diagonal direction is always best.

export const BRACED_FRAME_LIMITS_NOTICE = 'Idealized pin-jointed frame, not a structural certification'

export const bracedFrameUi: ModelUi = {
  copy: {
    tagline: 'Brace a two-storey frame and size its members within drift, capacity and mass limits.',
    guidedContext: 'Diagonal toggles, member section choices, and step-by-step prompts.',
    parametricContext: 'Direct bracing and member section editing with the same validated frame model.',
    parametricLabel: 'Direct bracing and member section editing',
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
  guidance: {
    steps: [
      {
        id: 'inspect',
        title: 'Inspect',
        instruction:
          'Read the challenge, its limits and the pin-jointed idealization. Find the governing member of the baseline frame: is it in tension or compression, and why does it fail?',
        hint: 'Expand Some things are fixed. to see the loads and supports. The member force table under the drawing lists each member’s force, capacity and utilization from the latest test. Accepted applies to this idealized model, not a real-world safety approval.',
      },
      {
        id: 'experiment',
        title: 'Experiment',
        instruction:
          'Remove one diagonal, predict how the roof drift will change, then Run Test and see what happens to a storey without a diagonal. Restore it, flip a diagonal’s direction and predict the change in roof drift again.',
        hint: 'A storey with no diagonal is a mechanism in this model, so its roof drift is not defined and that prediction cannot be scored. Change one thing at a time so you can tell what caused each change.',
      },
      {
        id: 'compare',
        title: 'Compare',
        instruction: 'Choose designs in Design history, then open Compare results. Compare the governing members, roof drift and mass of two designs.',
        hint: 'With one diagonal per storey, change only member sections and compare the member forces. Strengthen the members that govern instead of every member.',
      },
      {
        id: 'explain',
        title: 'Explain',
        instruction:
          'Use your tested values to describe how the sideways load travels through the diagonals to the supports. Open Explain & submit to record a design and reflection.',
        hint: 'A submitted attempt can still be Not accepted. Name one effect the pin-jointed model does not include, such as rigid joints or load reversal.',
      },
    ],
    experiment: () => undefined,
  },
}
