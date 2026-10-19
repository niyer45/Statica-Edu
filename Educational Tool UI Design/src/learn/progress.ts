import { z } from 'zod'
import type { LearnModule } from './types'

// Learn progress (task 67; LRN-07): the learner's committed prediction for each step, saved per
// module and content version in the same guest/account storage as challenge progress. A step is
// complete once its prediction is committed (LRN-03: predicting is enough to move on). Unknown or
// corrupt data is ignored, never shown.

export interface LearnStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Step id → chosen option id. */
export type LearnProgress = Readonly<Record<string, string>>

export const LEARN_KEY_PREFIX = 'ei:learn:'

export const learnKey = (m: LearnModule) => `${LEARN_KEY_PREFIX}${m.id}:v${m.version}`

const recordSchema = z
  .object({ schemaVersion: z.literal(1), answers: z.record(z.string(), z.string()) })
  .strict()

/** Keeps only answers to this module's steps that name one of the step's options. */
function known(m: LearnModule, answers: Record<string, string>): LearnProgress {
  const kept: Record<string, string> = {}
  for (const step of m.steps) {
    const answer = answers[step.id]
    if (answer !== undefined && step.question.options.some((o) => o.id === answer)) kept[step.id] = answer
  }
  return kept
}

export function readProgress(storage: LearnStorage, m: LearnModule): LearnProgress {
  try {
    const raw = storage.getItem(learnKey(m))
    if (raw === null) return {}
    const parsed = recordSchema.safeParse(JSON.parse(raw))
    return parsed.success ? known(m, parsed.data.answers) : {}
  } catch {
    return {}
  }
}

/** Saves progress; returns false when storage is unavailable (the page keeps working). */
export function writeProgress(storage: LearnStorage, m: LearnModule, progress: LearnProgress): boolean {
  try {
    storage.setItem(learnKey(m), JSON.stringify({ schemaVersion: 1, answers: progress }))
    return true
  } catch {
    return false
  }
}

/** Commits a prediction. A committed prediction is final; unknown steps or options change nothing. */
export function commitPrediction(m: LearnModule, progress: LearnProgress, stepId: string, optionId: string): LearnProgress {
  if (progress[stepId] !== undefined) return progress
  return known(m, { ...progress, [stepId]: optionId })
}

export interface ModuleStatus {
  completed: number
  total: number
  done: boolean
  /** First step without a prediction, or the step count when every step is done. */
  nextStep: number
}

export function moduleStatus(m: LearnModule, progress: LearnProgress): ModuleStatus {
  const completed = m.steps.filter((s) => progress[s.id] !== undefined).length
  const next = m.steps.findIndex((s) => progress[s.id] === undefined)
  return { completed, total: m.steps.length, done: completed === m.steps.length, nextStep: next === -1 ? m.steps.length : next }
}
