import { describe, expect, it } from 'vitest'
import { bundledChallengeJson } from '../challenge/bundled'
import type { InteractionMode } from '../challenge/types'
import { BEAM_GUIDED_PLAN } from '../evaluation/guided/beam'
import { BRACED_FRAME_GUIDED_PLAN } from '../evaluation/guided/bracedFrame'
import { BRACKET_GUIDED_PLAN } from '../evaluation/guided/bracket'
import { HEAT_SINK_GUIDED_PLAN } from '../evaluation/guided/heatSink'
import { guidedProgress, type GuidedPlan, type GuidedStep } from '../evaluation/guided/plan'
import { TORSION_GUIDED_PLAN } from '../evaluation/guided/torsion'
import { VIBRATION_GUIDED_PLAN } from '../evaluation/guided/vibration'
import { SECTION_PARAMS } from '../geometry/params'
import { beamRuntime, bracedFrameRuntime, bracketRuntime, heatSinkRuntime, torsionRuntime, vibrationRuntime, type AnyRuntime, type LoopChallenge } from './runtimes'

// Guided structured experiments through the real runtimes (task 58). For every bundled
// challenge: each step is completable from the Baseline by editing only that step's parameters
// and testing; edits to locked parameters are rejected in Guided and accepted in Parametric; the
// final step opens every parameter and is met by an Accepted test. Edits are computed from the
// current draft (not hard-coded values), so the walk survives Baseline changes.

const T0 = '2026-10-18T00:00:00.000Z'

type Draft = Record<string, unknown>
type Session = { mode: InteractionMode; draft: Draft; history: { id: string; iteration: number; designSnapshot: Draft; accepted: boolean }[]; ui: { notice?: { kind: string; message: string } } }
type Ch = LoopChallenge & Record<string, unknown> & { referenceDesign: Draft }
type Act = { type: string; [k: string]: unknown }

interface Case {
  name: string
  id: string
  runtime: AnyRuntime
  plan: GuidedPlan<never, never>
  /** One edit that meets `step` from the current draft. */
  experiment(step: GuidedStep, d: Draft, ch: Ch): Act[]
  /** Edits from the current draft toward the challenge's reference design (all unlocked). */
  toReference(d: Draft, ch: Ch): Act[]
  /** An edit of a parameter that is locked in the first step. */
  lockedAtStart(d: Draft, ch: Ch): Act
}

const edit = (e: Record<string, unknown>): Act => ({ type: 'edit', edit: e })
/** First parameter of an objective that the draft has, as a number. */
function target(step: GuidedStep, params: Readonly<Record<string, unknown>>): string {
  if (step.objective.kind !== 'change') throw new Error('not a change step')
  const id = step.objective.params.find((p) => typeof params[p] === 'number')
  if (id === undefined) throw new Error(`no numeric target for ${step.id}`)
  return id
}
const sign = (step: GuidedStep) => (step.objective.kind === 'change' && step.objective.direction === 'decrease' ? -1 : 1)

const beamSection = (d: Draft) => d.section as Record<string, number | string>

const CASES: Case[] = [
  {
    name: 'Cantilever Beam I',
    id: 'cantilever-beam-1',
    runtime: beamRuntime as unknown as AnyRuntime,
    plan: BEAM_GUIDED_PLAN as unknown as GuidedPlan<never, never>,
    experiment: (step, d, ch) => {
      const section = beamSection(d)
      if (step.id === 'shape') return [{ type: 'applySection', kind: (ch.allowedSections as string[]).find((k) => k !== section.kind)! }]
      if (step.id === 'upright') return [{ type: 'setOrientation', orientationDeg: d.orientationDeg === 0 ? 90 : 0 }]
      const param = step.id === 'tune' ? SECTION_PARAMS[section.kind as keyof typeof SECTION_PARAMS][0] : target(step, section)
      return [{ type: 'setParam', param, valueM: (section[param] as number) + 0.005, mode: 'clamp' }]
    },
    toReference: (_d, ch) => {
      const ref = ch.referenceDesign as { section: Record<string, number | string>; orientationDeg: number }
      const params = Object.entries(ref.section).filter(([k]) => k !== 'kind')
      return [{ type: 'applySection', kind: ref.section.kind }, ...params.map(([param, v]) => ({ type: 'setParam', param, valueM: v, mode: 'strict' })), { type: 'setOrientation', orientationDeg: ref.orientationDeg }]
    },
    lockedAtStart: (d) => ({ type: 'applySection', kind: beamSection(d).kind === 'circle' ? 'rectangle' : 'circle' }),
  },
  {
    name: 'Torsion Shaft I',
    id: 'torsion-shaft-1',
    runtime: torsionRuntime as unknown as AnyRuntime,
    plan: TORSION_GUIDED_PLAN as unknown as GuidedPlan<never, never>,
    experiment: (step, d, ch) => {
      const section = beamSection(d)
      if (step.id === 'section') return [edit({ type: 'setSection', kind: (ch.allowedSections as string[]).find((k) => k !== section.kind)! })]
      const param = step.id === 'tune' ? Object.keys(section).find((k) => k !== 'kind')! : target(step, section)
      return [edit({ type: 'setParam', param, valueM: (section[param] as number) + 0.002, mode: 'clamp' })]
    },
    toReference: (_d, ch) => {
      const ref = (ch.referenceDesign as { section: Record<string, number | string> }).section
      const params = Object.entries(ref).filter(([k]) => k !== 'kind')
      return [edit({ type: 'setSection', kind: ref.kind }), ...params.map(([param, v]) => edit({ type: 'setParam', param, valueM: v, mode: 'strict' }))]
    },
    lockedAtStart: (d) => edit({ type: 'setSection', kind: beamSection(d).kind === 'tube' ? 'circle' : 'tube' }),
  },
  {
    name: 'Vibration Isolation I',
    id: 'vibration-isolation-1',
    runtime: vibrationRuntime as unknown as AnyRuntime,
    plan: VIBRATION_GUIDED_PLAN as unknown as GuidedPlan<never, never>,
    experiment: (step, d, ch) =>
      step.id === 'damping'
        ? [edit({ type: 'setMaterial', materialId: (ch.materials as { id: string }[]).find((m) => m.id !== d.materialId)!.id })]
        : [edit({ type: 'setStiffness', valueNPerM: (d.stiffnessNPerM as number) * (sign(step) < 0 ? 0.8 : 1.2), mode: 'clamp' })],
    toReference: (_d, ch) => [edit({ type: 'setStiffness', valueNPerM: ch.referenceDesign.stiffnessNPerM, mode: 'strict' }), edit({ type: 'setMaterial', materialId: ch.referenceDesign.materialId })],
    lockedAtStart: (d, ch) => edit({ type: 'setMaterial', materialId: (ch.materials as { id: string }[]).find((m) => m.id !== d.materialId)!.id }),
  },
  {
    name: 'Heat Sink I',
    id: 'heat-sink-1',
    runtime: heatSinkRuntime as unknown as AnyRuntime,
    plan: HEAT_SINK_GUIDED_PLAN as unknown as GuidedPlan<never, never>,
    experiment: (step, d, ch) => {
      const param = target(step, d)
      const delta = param === 'finCount' ? 1 : (ch.designLimits as Record<string, { stepM: number }>)[param]!.stepM
      return [edit({ type: 'setParam', param, value: (d[param] as number) + sign(step) * delta, mode: param === 'finCount' ? 'strict' : 'clamp' })]
    },
    toReference: (_d, ch) => ['finThicknessM', 'finHeightM', 'finCount'].map((param) => edit({ type: 'setParam', param, value: ch.referenceDesign[param], mode: 'strict' })),
    lockedAtStart: (d) => edit({ type: 'setParam', param: 'finHeightM', value: (d.finHeightM as number) - 0.001, mode: 'strict' }),
  },
  {
    name: 'Mounting Bracket I',
    id: 'mounting-bracket-1',
    runtime: bracketRuntime as unknown as AnyRuntime,
    plan: BRACKET_GUIDED_PLAN as unknown as GuidedPlan<never, never>,
    // Generic: nudge the step's first numeric parameter by one grid step in the objective's direction.
    experiment: (step, d, ch) => {
      const param = target(step, d)
      const delta = (ch.designLimits as Record<string, { stepM: number }>)[param]!.stepM
      return [edit({ type: 'setParam', param, valueM: (d[param] as number) + sign(step) * delta, mode: 'clamp' })]
    },
    toReference: (_d, ch) => Object.keys(BRACKET_GUIDED_PLAN.params(ch.referenceDesign as never)).map((param) => edit({ type: 'setParam', param, valueM: ch.referenceDesign[param], mode: 'strict' })),
    lockedAtStart: (d, ch) => {
      const step = BRACKET_GUIDED_PLAN.steps[0]!
      const param = Object.keys(BRACKET_GUIDED_PLAN.params(d as never)).find((p) => !(step.unlocks as readonly string[]).includes(p))!
      const limits = (ch.designLimits as Record<string, { minM: number; maxM: number; stepM: number }>)[param]!
      // Nudge one grid step toward the interior so a parameter at a bound still changes.
      const value = (d[param] as number) + limits.stepM <= limits.maxM ? (d[param] as number) + limits.stepM : (d[param] as number) - limits.stepM
      return edit({ type: 'setParam', param, valueM: value, mode: 'clamp' })
    },
  },
  {
    name: 'Braced Frame I',
    id: 'braced-frame-1',
    runtime: bracedFrameRuntime as unknown as AnyRuntime,
    plan: BRACED_FRAME_GUIDED_PLAN as unknown as GuidedPlan<never, never>,
    experiment: (step, d, ch) => {
      const members = d.members as Record<string, { present?: boolean; sectionId: string }>
      if (step.id === 'bracing') return [edit({ type: 'toggleDiagonal', memberId: Object.keys(members).find((id) => members[id]!.present === false) ?? 'diag1a' })]
      return [edit({ type: 'setMemberSection', memberId: 'col1L', sectionId: (ch.sections as { id: string }[]).find((s) => s.id !== members.col1L!.sectionId)!.id })]
    },
    toReference: (d, ch) => {
      const members = d.members as Record<string, { present?: boolean; sectionId: string }>
      const ref = ch.referenceDesign.members as Record<string, { present?: boolean; sectionId: string }>
      return Object.entries(ref).flatMap(([memberId, m]) => [
        ...(m.present !== undefined && m.present !== members[memberId]!.present ? [edit({ type: 'toggleDiagonal', memberId })] : []),
        edit({ type: 'setMemberSection', memberId, sectionId: m.sectionId }),
      ])
    },
    lockedAtStart: () => edit({ type: 'setMemberSection', memberId: 'col1L', sectionId: 'CHS88.9x5.0' }),
  },
]

function setup(c: Case, mode: InteractionMode) {
  const loaded = c.runtime.load(bundledChallengeJson(c.id))
  if (!loaded.ok) throw new Error(`${c.id} failed to load`)
  const ch = loaded.value as unknown as Ch
  const init = c.runtime.init(ch, T0, 'base', mode)
  if (!init.ok) throw new Error(init.error.message)
  let s = init.value as unknown as Session
  let tests = 0
  const apply = (actions: Act[]) => {
    for (const a of actions) s = c.runtime.reduce(s as never, a, ch) as unknown as Session
  }
  const test = () => {
    tests++
    apply([{ type: 'setPrediction', direction: 'decrease', now: T0 }, { type: 'runTest', now: T0, id: `t${tests}` }])
  }
  const progress = () => guidedProgress(c.plan as GuidedPlan<unknown, unknown>, s.history)
  return { ch, get s() { return s }, apply, test, progress }
}

describe.each(CASES)('$name guided experiments', (c) => {
  it('walks every step from the Baseline, editing only unlocked parameters', () => {
    const run = setup(c, 'guided')
    const steps = c.plan.steps
    for (const [index, step] of steps.entries()) {
      expect(run.progress().current).toBe(index)
      const before = run.s.draft
      run.apply(step.unlocks === 'all' ? c.toReference(run.s.draft, run.ch) : c.experiment(step, run.s.draft, run.ch))
      expect(run.s.draft).not.toBe(before)
      expect(run.s.ui.notice?.message ?? '').not.toMatch(/locked/)
      run.test()
      expect(run.s.history.length).toBe(index + 2)
    }
    expect(run.s.history[run.s.history.length - 1]!.accepted).toBe(true)
    expect(run.progress()).toMatchObject({ current: steps.length, complete: true })
  })

  it('rejects a locked parameter in Guided and accepts the same edit in Parametric', () => {
    const guided = setup(c, 'guided')
    const before = guided.s
    guided.apply([c.lockedAtStart(before.draft, guided.ch)])
    expect(guided.s.draft).toBe(before.draft)
    expect(guided.s.history).toBe(before.history)
    expect(guided.s.ui.notice).toMatchObject({ kind: 'error', message: expect.stringMatching(/is locked in this Guided step\. Editable now: /) })

    const parametric = setup(c, 'parametric')
    const draft = parametric.s.draft
    parametric.apply([c.lockedAtStart(draft, parametric.ch)])
    expect(parametric.s.draft).not.toEqual(draft)
    expect(parametric.s.ui.notice).toBeUndefined()
  })

  it('never blocks shared actions such as reset, restore or tests in Guided', () => {
    const run = setup(c, 'guided')
    run.apply(c.experiment(c.plan.steps[0]!, run.s.draft, run.ch))
    run.test()
    run.apply([{ type: 'restore', testResultId: 'base' }])
    expect(run.s.ui.notice).toBeUndefined()
    run.apply([{ type: 'reset' }])
    expect(run.s.history.length).toBe(2)
    expect(run.progress().current).toBe(1)
  })
})
