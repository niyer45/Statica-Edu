// Learn module types (task 67; .kiro/specs/learn-modules/). Pure data: subjects, topics and
// modules, each module a short list of steps with a concept, a prediction question, an
// interactive demonstration and an optional advanced note (LRN-01, LRN-02).

import type { ArtKind } from '../challenge/catalog'

/** Beam bending demonstrations; inputs and ranges live in `beamDemo.ts`. */
export type BeamDemoKind = 'load' | 'length' | 'material' | 'section' | 'stress'

/**
 * Which interactive demonstration a step shows. Each module adds its own kinds, namespaced by
 * module (e.g. `torsion-length`), with a demo model in `src/learn/<topic>Demo.ts` and components
 * in `src/ui/learn/demos/<topic>.tsx` registered in `src/ui/learn/demos/index.tsx`.
 */
export type DemoKind = BeamDemoKind | TorsionDemoKind | AxialDemoKind

/** Torsion demonstrations (task 71); inputs and ranges live in `torsionDemo.ts`. */
export type TorsionDemoKind = 'torsion-torque' | 'torsion-length' | 'torsion-diameter' | 'torsion-hollow' | 'torsion-stress'

/** Stress and strain demonstrations (task 72); inputs and ranges live in `axialDemo.ts`. */
export type AxialDemoKind = 'axial-area' | 'axial-strain' | 'axial-hooke' | 'axial-yield' | 'axial-length'

export interface PredictionOption {
  id: string
  label: string
}

export interface PredictionQuestion {
  prompt: string
  options: readonly PredictionOption[]
  /** The option the model agrees with; checked against the physics in unit tests (LRN-04). */
  answerId: string
  /** Why the model behaves this way, shown after the learner predicts. */
  explanation: string
}

/** An optional equation with a caption, typeset with KaTeX (`ui/math/TeX`). */
export interface AdvancedEquation {
  tex: string
  /** Plain-text version shown until KaTeX loads. */
  text: string
  caption: string
}

export interface LearnStep {
  id: string
  title: string
  /** At most three short points. */
  concept: readonly string[]
  question: PredictionQuestion
  demo: DemoKind
  /** What to try in the demonstration to check the prediction. */
  tryIt: string
  takeaway: string
  advanced: readonly AdvancedEquation[]
}

export interface LearnModule {
  id: string
  /** Content version; a bump starts a fresh progress key (LRN-07, as MM-04). */
  version: number
  title: string
  summary: string
  /** Display estimate, e.g. "15–20 min". */
  time: string
  /** Technical drawing on the module's Learn card (`ui/shell/TechnicalArt`). */
  art: ArtKind
  steps: readonly LearnStep[]
  /** The design challenge the final "Apply it" step opens (LRN-06). */
  apply: { challengeId: string; title: string; text: string }
}

export type ModuleEntry =
  | { status: 'available'; module: LearnModule }
  | { status: 'planned'; id: string; title: string; summary: string }

export interface Topic {
  id: string
  title: string
  modules: readonly ModuleEntry[]
}

export interface Subject {
  id: string
  title: string
  topics: readonly Topic[]
}
