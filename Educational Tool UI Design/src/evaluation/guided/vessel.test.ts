import { describe, expect, it } from 'vitest'
import { vessel, vesselChallenge } from '../../../test/fixtures/vessel'
import type { VesselDesign } from '../../geometry/vessel/design'
import { analyzeVessel } from '../../physics/vessel/analyze'
import type { VesselAnalysis } from '../../physics/vessel/types'
import { guidedProgress, isEditable, observations, type GuidedCompletion, type GuidedPlan, type GuidedResult } from './plan'
import { VESSEL_GUIDED_PLAN } from './vessel'

// Pressure Vessel I guided experiments (task 69; PVS-16, D-49).

const ch = vesselChallenge()
type Row = GuidedResult<VesselDesign> & { analysis: VesselAnalysis }
const history = (...designs: [VesselDesign, boolean?][]): Row[] =>
  designs.map(([d, accepted], i) => ({ id: `r${i}`, iteration: i, designSnapshot: d, accepted: accepted ?? false, analysis: analyzeVessel(d, ch) }))

describe('VESSEL_GUIDED_PLAN', () => {
  const plan = VESSEL_GUIDED_PLAN
  const observe = (c: GuidedCompletion, h: Row[]) => observations(plan as unknown as GuidedPlan<VesselDesign, Row>, c, h)
  const steps = plan.steps

  it('has single-variable steps that unlock their objective parameters and ends with an open accepted step', () => {
    expect(steps.map((s) => s.id)).toEqual(['shell', 'diameter', 'length', 'heads', 'open'])
    const last = steps.at(-1)!
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

  it('never states numbers or the reference dimensions in its text (MM-21)', () => {
    for (const s of steps) for (const text of [s.title, s.instruction, s.hint, s.focus]) expect(text).not.toMatch(/\d/)
  })

  it('walks the sequence from the baseline and reports stored changes only', () => {
    const b = ch.initialDesign
    const thick = { ...b, shellThicknessM: 0.004 }
    const wide = { ...thick, innerDiameterM: 0.4 }
    const short = { ...wide, shellLengthM: 0.53 }
    const heads = { ...short, headThicknessM: 0.0035 }
    const h = history([b], [thick], [wide], [short], [heads])
    const p = guidedProgress(plan, h)
    expect(p.current).toBe(4)
    expect(isEditable(plan, p, 'innerDiameterM')).toBe(true)
    const atHeads = guidedProgress(plan, h.slice(0, 4))
    expect(atHeads.current).toBe(3)
    expect(isEditable(plan, atHeads, 'innerDiameterM')).toBe(false)
    expect(isEditable(plan, atHeads, 'headThicknessM')).toBe(true)
    expect(observe(p.completions[0]!, h)).toEqual([
      { label: 'Hoop stress', change: 'decreased' },
      { label: 'Longitudinal stress', change: 'decreased' },
      { label: 'Mass', change: 'increased' },
    ])
    expect(observe(p.completions[1]!, h).slice(0, 2)).toEqual([
      { label: 'Hoop stress', change: 'increased' },
      { label: 'Internal volume', change: 'increased' },
    ])
    expect(observe(p.completions[2]!, h)).toContainEqual({ label: 'Hoop stress', change: 'unchanged' })
    const done = guidedProgress(plan, [...h, { id: 'r5', iteration: 5, designSnapshot: { ...heads, shellThicknessM: 0.0065 }, accepted: true, analysis: analyzeVessel(heads, ch) }])
    expect(done.complete).toBe(true)
  })

  it('the head step accepts a change in either direction, but only of the head thickness', () => {
    const b = ch.initialDesign
    const start = [b, { ...b, shellThicknessM: 0.004 }, { ...b, shellThicknessM: 0.004, innerDiameterM: 0.4 }, { ...b, shellThicknessM: 0.004, innerDiameterM: 0.4, shellLengthM: 0.5 }]
    const last = start.at(-1)!
    const thinner = guidedProgress(plan, history(...start.map((d) => [d] as [VesselDesign]), [{ ...last, headThicknessM: 0.001 }]))
    expect(thinner.current).toBe(4)
    const both = guidedProgress(plan, history(...start.map((d) => [d] as [VesselDesign]), [{ ...last, headThicknessM: 0.002, shellLengthM: 0.6 }]))
    expect(both.current).toBe(3)
    expect(plan.label('headThicknessM')).toBe('Head thickness')
    expect(plan.label('other')).toBe('other')
    expect(Object.keys(plan.params(vessel('x', 0.3, 0.5, 0.004, 0.002)))).toEqual(['innerDiameterM', 'shellLengthM', 'shellThicknessM', 'headThicknessM'])
  })
})
