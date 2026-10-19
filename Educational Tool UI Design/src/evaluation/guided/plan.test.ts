import { describe, expect, it } from 'vitest'
import { BEAM_GUIDED_PLAN } from './beam'
import { BRACED_FRAME_GUIDED_PLAN } from './bracedFrame'
import { BRACKET_GUIDED_PLAN } from './bracket'
import { COLUMN_GUIDED_PLAN } from './column'
import { HEAT_SINK_GUIDED_PLAN } from './heatSink'
import { changedParams, currentStep, guidedProgress, isEditable, lockedChange, observations, type GuidedPlan, type GuidedResult } from './plan'
import { TORSION_GUIDED_PLAN } from './torsion'
import { VIBRATION_GUIDED_PLAN } from './vibration'

// Guided structured experiments (task 58): progress is a pure function of stored history.

interface D {
  kind: string
  a?: number
  b?: number
  c?: number
}
type R = GuidedResult<D> & { analysis: { y: number } }

const PLAN: GuidedPlan<D, R> = {
  params: (d) => ({ kind: d.kind, ...(d.a === undefined ? {} : { a: d.a }), ...(d.b === undefined ? {} : { b: d.b }), ...(d.c === undefined ? {} : { c: d.c }) }),
  structural: ['kind'],
  label: (id) => id.toUpperCase(),
  metrics: { y: { label: 'Y', read: (r) => r.analysis.y } },
  steps: [
    { id: 's1', title: 'A up', instruction: '', hint: '', focus: 'A', unlocks: ['a'], objective: { kind: 'change', params: ['a'], direction: 'increase' }, observe: ['y'] },
    { id: 's2', title: 'Kind', instruction: '', hint: '', focus: 'Kind', unlocks: ['kind'], objective: { kind: 'change', params: ['kind'], direction: 'any' } },
    { id: 's3', title: 'One of b/c', instruction: '', hint: '', focus: 'B or C', unlocks: ['b', 'c'], objective: { kind: 'change', params: ['b', 'c'], direction: 'any', single: true } },
    { id: 's4', title: 'Open', instruction: '', hint: '', focus: 'All', unlocks: 'all', objective: { kind: 'accepted' } },
  ],
}

let n = 0
const result = (design: D, y = 1, accepted = false): R => ({ id: `r${n}`, iteration: n++, designSnapshot: design, accepted, analysis: { y } })
const history = (...designs: (D | [D, number, boolean?])[]): R[] => {
  n = 0
  return designs.map((d) => (Array.isArray(d) ? result(d[0], d[1], d[2]) : result(d)))
}
const base: D = { kind: 'x', a: 1, b: 1, c: 1 }

describe('guided progress', () => {
  it('starts at the first step with only its parameters editable', () => {
    const p = guidedProgress(PLAN, history(base))
    expect(p).toEqual({ current: 0, completions: [], complete: false })
    expect(currentStep(PLAN, p)?.id).toBe('s1')
    expect(isEditable(PLAN, p, 'a')).toBe(true)
    expect(isEditable(PLAN, p, 'b')).toBe(false)
    expect(isEditable(PLAN, p, 'kind')).toBe(false)
  })

  it('completes a change step only with the required single-variable direction', () => {
    expect(guidedProgress(PLAN, history(base, { ...base, a: 0.5 })).current).toBe(0) // wrong direction
    expect(guidedProgress(PLAN, history(base, { ...base, a: 2, b: 2 })).current).toBe(0) // two variables
    const h = history(base, [{ ...base, a: 2 }, 0.5])
    const p = guidedProgress(PLAN, h)
    expect(p.current).toBe(1)
    expect(p.completions).toEqual([{ stepId: 's1', resultId: 'r1', comparedWithId: 'r0' }])
    expect(observations(PLAN, p.completions[0]!, h)).toEqual([{ label: 'Y', change: 'decreased' }])
  })

  it('compares with any earlier tested result, not only the previous one', () => {
    // r1 changed two variables; r2 differs from the Baseline only in `a`.
    const p = guidedProgress(PLAN, history(base, { ...base, a: 3, b: 5 }, { ...base, a: 2 }))
    expect(p.completions[0]).toEqual({ stepId: 's1', resultId: 'r2', comparedWithId: 'r0' })
  })

  it('needs a new test for each step; one result meets at most one step', () => {
    const h = history(base, { ...base, a: 2 }, { kind: 'y', a: 2, b: 1 }, { kind: 'y', a: 2, b: 3 }, [{ kind: 'y', a: 9, b: 9 }, 1, true])
    const p = guidedProgress(PLAN, h)
    expect(p.completions.map((c) => c.stepId)).toEqual(['s1', 's2', 's3', 's4'])
    expect(p.complete).toBe(true)
    expect(currentStep(PLAN, p)).toBeUndefined()
    expect(isEditable(PLAN, p, 'b')).toBe(true)
    // An accepted design tested before the final step does not skip steps.
    expect(guidedProgress(PLAN, history(base, [{ ...base, a: 2 }, 1, true])).current).toBe(1)
  })

  it('treats a structural change as one change and ignores incomparable parameters', () => {
    expect(changedParams(PLAN, base, { kind: 'y', a: 5 })).toEqual(['kind'])
    expect(changedParams(PLAN, base, { ...base, b: 2, c: 3 })).toEqual(['b', 'c'])
    expect(changedParams(PLAN, { kind: 'x', a: 1 }, { kind: 'x', b: 1 })).toEqual([])
  })

  it('reports the first locked parameter an edit changes', () => {
    const h = history(base)
    expect(lockedChange(PLAN, h, base, { ...base, a: 5 })).toBeUndefined()
    expect(lockedChange(PLAN, h, base, { ...base, b: 5 })).toBe('b')
    expect(lockedChange(PLAN, h, base, { kind: 'y', a: 1 })).toBe('kind')
    // At step 2 the kind is unlocked and a kind change may replace the other parameters.
    const h2 = history(base, { ...base, a: 2 })
    expect(lockedChange(PLAN, h2, base, { kind: 'y' })).toBeUndefined()
    expect(lockedChange(PLAN, h2, base, { ...base, a: 3 })).toBe('a')
  })

  it('treats a coupled follower as part of its leader edit', () => {
    const plan: GuidedPlan<D, R> = { ...PLAN, coupled: { a: ['b'] } }
    // Step 1 unlocks only `a`: a clamp shrink of `b` along with `a` is allowed and is one change.
    expect(lockedChange(plan, history(base), base, { ...base, a: 0.5, b: 0.4 })).toBeUndefined()
    expect(changedParams(plan, base, { ...base, a: 2, b: 0.4 })).toEqual(['a'])
    expect(guidedProgress(plan, history(base, { ...base, a: 2, b: 0.4 })).current).toBe(1)
    // A follower changed alone still needs its own unlock.
    expect(lockedChange(plan, history(base), base, { ...base, b: 0.4 })).toBe('b')
  })

  it('reports unavailable metrics without inventing values', () => {
    const plan: GuidedPlan<D, R> = { ...PLAN, metrics: { y: { label: 'Y', read: (r) => (r.analysis.y < 0 ? undefined : r.analysis.y) } } }
    const h = history(base, [{ ...base, a: 2 }, -1])
    const p = guidedProgress(plan, h)
    expect(observations(plan, p.completions[0]!, h)).toEqual([{ label: 'Y', change: 'unavailable' }])
  })
})

describe('bundled guided plans', () => {
  const plans = { BEAM_GUIDED_PLAN, TORSION_GUIDED_PLAN, VIBRATION_GUIDED_PLAN, HEAT_SINK_GUIDED_PLAN, BRACKET_GUIDED_PLAN, BRACED_FRAME_GUIDED_PLAN, COLUMN_GUIDED_PLAN }
  it.each(Object.entries(plans))('%s: single-variable steps unlock their objective parameters and end with an open accepted step', (_name, plan) => {
    const steps = plan.steps
    expect(steps.length).toBeGreaterThanOrEqual(3)
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length)
    const last = steps[steps.length - 1]!
    expect(last.unlocks).toBe('all')
    expect(last.objective).toEqual({ kind: 'accepted' })
    for (const step of steps.slice(0, -1)) {
      expect(step.unlocks).not.toBe('all')
      expect(step.objective.kind).toBe('change')
      if (step.objective.kind === 'change') expect(step.objective.params.every((p) => (step.unlocks as readonly string[]).includes(p))).toBe(true)
      for (const id of step.observe ?? []) expect(Object.keys(plan.metrics)).toContain(id)
      expect(step.instruction.length).toBeGreaterThan(20)
    }
  })
})
