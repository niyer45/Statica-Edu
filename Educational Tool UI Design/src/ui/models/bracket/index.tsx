import type { BracketEfficiency } from '../../../evaluation/bracket/types'
import type { BracketSession } from '../../../state/bracketModel'
import type { ModelUi } from '../types'
import BracketChallengePanel from './BracketChallengePanel'
import BracketHelp from './BracketHelp'
import BracketResults from './BracketResults'
import BracketTools from './BracketTools'
import BracketView from './BracketView'

// Mounting Bracket I UI (task 46.3; mounting-bracket-1 MBR-16, MBR-18, MBR-19; MM-20, MM-21).
// Guided steps and the suggested experiment never state reference dimensions or invent numbers.

// The always-visible limits notice carries the short form of the Kt source disclosure (MBR-20,
// D-41 K-1); the reference dialog and the model-limits explanation fact carry the full text.
export const BRACKET_LIMITS_NOTICE =
  'Idealized stepped-bar bending; fillet Kt coefficients from secondary copies, pending printed-edition verification. Not a structural certification'

export const bracketUi: ModelUi = {
  copy: {
    tagline: 'Find where the stress peaks and bring it within the limit without adding material everywhere.',
    guidedContext: 'Depth, step and fillet controls, a bending-moment strip, and step-by-step prompts.',
    parametricContext: 'Precise depth, step location and fillet editing with the same validated stepped-bar model.',
    parametricLabel: 'Direct depth, step and fillet editing',
    solverLabel: 'Stepped flat bar · Peterson shoulder-fillet Kt',
    limitsNotice: BRACKET_LIMITS_NOTICE,
    drawerAvailable:
      'Available with an idealized stepped-bar bending model and a published shoulder-fillet stress-concentration fit. Length, thickness, force, material, and wall clamp remain fixed by the challenge.',
    prediction: {
      title: 'Predict peak stress',
      question: (previous) => `Compared with ${previous}, how will your new bracket change its peak stress?`,
      legend: 'Predicted change in peak stress',
    },
    efficiency: (efficiency) => {
      const e = efficiency as BracketEfficiency
      return [
        { label: 'Mass usage', value: e.massUsage },
        // Absent when the tested design has no peak stress (Kt fit undefined); never invented.
        ...(e.stressMargin !== undefined ? [{ label: 'Stress margin', value: e.stressMargin }] : []),
        { label: 'Deflection margin', value: e.deflectionMargin },
      ]
    },
  },
  Tools: BracketTools,
  View: BracketView,
  ChallengePanel: BracketChallengePanel,
  Results: BracketResults,
  Help: BracketHelp,
  guidance: {
    steps: [
      {
        id: 'inspect',
        title: 'Inspect',
        instruction: 'Read the challenge and its limits. Find which limit the baseline bracket misses and where its peak stress occurs: at the root or at the step.',
        hint: 'Expand Some things are fixed. to see the length, thickness, force, material and clamp. The moment strip under the bracket shows the bending moment falling from the wall to the tip. Accepted applies to this idealized model, not a real-world safety approval.',
      },
      {
        id: 'experiment',
        title: 'Experiment',
        instruction: 'Change only the fillet radius, or only the step location. Predict how the peak stress will change, then Run Test to record the result.',
        hint: 'A softer fillet lowers Kt. Moving the step toward the tip puts it where the moment is lower. Kt is a local peak at the fillet: it does not change the moment, the deflection or the root stress.',
      },
      {
        id: 'compare',
        title: 'Compare',
        instruction: 'Choose designs in Design history, then open Compare results. Compare where the peak stress occurs and the mass of each design, including one where the root governs.',
        hint: 'Making every depth larger also lowers the stress. Check what that does to the mass limit before choosing it.',
      },
      {
        id: 'explain',
        title: 'Explain',
        instruction: 'Use your tested values to connect the moment path, Kt and mass. Open Explain & submit to record a design and reflection.',
        hint: 'A submitted attempt can still be Not accepted. Name one effect the idealized bracket model does not include, such as fatigue or bolt-hole stress concentrations.',
      },
    ],
    experiment: (session) => {
      const latest = (session as unknown as BracketSession).history.at(-1)
      if (latest === undefined) return undefined
      const a = latest.analysis
      if (a.status === 'ktFitUndefined') return 'Your latest test is outside the fillet curve fit. Read its applicability reasons, then bring the step back inside the fit before comparing peak stress.'
      if (a.peakLocation === 'step') return 'Your latest test peaks at the step. Try one change at the shoulder, the fillet radius or the step location, and predict the result before you run it.'
      if (a.peakLocation === 'root') return 'Your latest test peaks at the root, where the moment is largest. Compare its mass with a design whose step governs.'
      return undefined
    },
  },
}
