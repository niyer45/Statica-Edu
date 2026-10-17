import type { ComponentType } from 'react'
import type { LoopSession } from '../../state/runtimes'

// Model UI contract (task 34.2; multi-model-architecture MM-20, MM-21). A model fills the
// workbench regions and supplies its own wording; the shell, layout, dialogs frame, toast,
// single live region and footer stay shared. Components render inside the active challenge's
// StoreProvider and read their typed store with `useModelStore`.

export interface GuidanceStep {
  id: 'inspect' | 'experiment' | 'compare' | 'explain'
  title: string
  instruction: string
  hint: string
}

export interface ModelCopy {
  /** Page heading subtitle under the challenge title. */
  tagline: string
  /** Workspace context line for each mode. */
  guidedContext: string
  parametricContext: string
  /** Short Parametric direct-edit description shown above the workbench (MODE-04). */
  parametricLabel: string
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
  guidance: {
    steps: readonly GuidanceStep[]
    /** Extra suggested experiment for the Experiment step, from stored state only. */
    experiment(session: LoopSession): string | undefined
  }
  /** Announcement for a successful model edit action, if any. */
  announceEdit?(session: LoopSession, lastAction: { type: string }): string | undefined
}
