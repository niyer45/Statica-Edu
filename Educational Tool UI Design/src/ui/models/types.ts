import type { ComponentType } from 'react'
import type { GuidedPlan } from '../../evaluation/guided/plan'
import type { LoopSession } from '../../state/runtimes'

// Model UI contract (task 34.2; multi-model-architecture MM-20, MM-21). A model fills the
// workbench regions and supplies its own wording; the shell, layout, dialogs frame, toast,
// single live region and footer stay shared. Components render inside the active challenge's
// StoreProvider and read their typed store with `useModelStore`.

export interface ModelCopy {
  /** Page heading subtitle under the challenge title. */
  tagline: string
  /** Optional model disclosure shown after the mode sentence in the workspace context. */
  contextNote?: string
  solverLabel: string
  /** Always-visible model limits notice in the footer. */
  limitsNotice: string
  /** Challenge drawer text for an available entry of this model. */
  drawerAvailable: string
  prediction: {
    title: string
    /** `previous` is "the Baseline" or "iteration n". */
    question(previous: string): string
    legend: string
  }
  /** Labelled stored submission margins (never recomputed). */
  efficiency(efficiency: unknown): { label: string; value: number }[]
}

export interface ModelUi {
  copy: ModelCopy
  /** Design tools region (section/parameter controls). */
  Tools: ComponentType<{ onAnnounce: (message: string) => void }>
  /** Design view region, including its own error boundary and non-WebGL fallback. */
  View: ComponentType<{ onUnavailable: (message: string) => void }>
  /** The challenge panel (statement, fixed values, limits, Run Test). */
  ChallengePanel: ComponentType<{ onOpenHelp: () => void }>
  /** History and comparison of stored results. */
  Results: ComponentType
  Help: ComponentType<{ open: boolean; onClose: () => void }>
  /**
   * Guided structured experiments (task 58): the model's pure step plan. Guided locks every
   * parameter the current step does not unlock; Parametric ignores the plan.
   */
  guided: GuidedPlan<never, never>
  /** Announcement for a successful model edit action, if any. */
  announceEdit?(session: LoopSession, lastAction: { type: string }): string | undefined
}
