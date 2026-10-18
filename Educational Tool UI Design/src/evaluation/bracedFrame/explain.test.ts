import { describe, expect, it } from 'vitest'
import { bracedFrameChallenge, worksheetFixture } from '../../../test/fixtures/bracedFrame'
import type { BracedFrameDesign } from '../../geometry/bracedFrame/design'
import { analyzeBracedFrame } from '../../physics/bracedFrame/analyze'
import type { BracedFrameMechanismAnalysis } from '../../physics/bracedFrame/types'
import { evaluateBracedFrame } from './evaluate'
import { BRACED_FRAME_MODEL_LIMITS_FACT_ID, bracedFrameModelLimitsFact, explainBracedFrameChange, explainBracedFrameSingle } from './explain'
import type { BracedFrameComparable } from './types'

// Grounded braced-frame explanation facts (task 49.2; design "Integration notes", MM-14).

const ch = bracedFrameChallenge()
function tested(d: BracedFrameDesign): BracedFrameComparable {
  const analysis = analyzeBracedFrame(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateBracedFrame(d, analysis, ch) }
}
const named = (name: string) => tested(worksheetFixture(name).design)
const ids = (facts: readonly { id: string }[]) => facts.map((f) => f.id)

describe('explainBracedFrameSingle', () => {
  it('solved: utilization facts for roof drift, member utilization and mass, the governing member, then the model fact', () => {
    const r = named('uniform60')
    expect(ids(r.evaluation.facts)).toEqual([
      'single.utilization.roofDrift',
      'single.utilization.utilization',
      'single.utilization.mass',
      'single.governingMember',
      BRACED_FRAME_MODEL_LIMITS_FACT_ID,
    ])
    const gov = r.evaluation.facts[3]
    const u = r.analysis.status === 'solved' ? r.analysis.members.diag1b!.utilization : Number.NaN
    expect(gov).toEqual({
      id: 'single.governingMember',
      text: `The governing member is the lower diagonal (bottom right to top left), in compression and limited by Euler buckling, at ${u.toFixed(2)} times its capacity.`,
      basis: { utilization: u },
    })
    expect(r.evaluation.facts[1].text).toContain('(over its limit)')
    expect(r.evaluation.facts[0].text).toContain('(within its limit)')
  })

  it('the baseline is over its limit on roof drift, member utilization and mass', () => {
    const facts = named('baseline').evaluation.facts
    for (const id of ['single.utilization.roofDrift', 'single.utilization.utilization', 'single.utilization.mass']) {
      expect(facts.find((f) => f.id === id)?.text, id).toContain('(over its limit)')
    }
    expect(facts.find((f) => f.id === 'single.governingMember')?.text).toContain('lower diagonal (bottom right to top left), in compression and limited by Euler buckling')
  })

  it('names tension and near-zero governing members accurately', () => {
    const r = named('reference')
    expect(r.evaluation.facts.find((f) => f.id === 'single.governingMember')?.text).toContain('floor beam, in compression and limited by Euler buckling')
    const a = r.analysis
    if (a.status !== 'solved') throw new Error('expected solved')
    const tensionGoverned = { ...a, governingMemberId: 'diag1a' as const }
    expect(explainBracedFrameSingle(tensionGoverned, r.evaluation.constraints).find((f) => f.id === 'single.governingMember')?.text).toContain('in tension and limited by tension yield')
    const zero = { ...a, members: { ...a.members, beam2: { ...a.members.beam2!, sense: 'zero' as const, mode: 'tensionYield' as const } }, governingMemberId: 'beam2' as const }
    expect(explainBracedFrameSingle(zero, r.evaluation.constraints).find((f) => f.id === 'single.governingMember')?.text).toContain('carrying almost no force')
    const yielded = { ...a, members: { ...a.members, col1R: { ...a.members.col1R!, mode: 'compressionYield' as const } }, governingMemberId: 'col1R' as const }
    expect(explainBracedFrameSingle(yielded, r.evaluation.constraints).find((f) => f.id === 'single.governingMember')?.text).toContain('compression yield')
  })

  it('mechanism: names the storeys without a diagonal, gives the mass fact, and no drift or force facts', () => {
    expect(named('upperUnbraced').evaluation.facts.map((f) => [f.id, f.text])).toEqual([
      ['single.mechanism', 'This pin-jointed frame is a mechanism: the upper storey has no diagonal, so the frame cannot resist sideways load and no displacements or member forces are defined.'],
      ['single.utilization.mass', expect.stringContaining('Mass is')],
      [BRACED_FRAME_MODEL_LIMITS_FACT_ID, bracedFrameModelLimitsFact().text],
    ])
    expect(named('unbraced').evaluation.facts[0].text).toContain('the lower and upper storeys have no diagonal')
    expect(named('lowerXOnly').evaluation.facts[0].text).toContain('the upper storey has no diagonal')
    expect(named('upperXOnly').evaluation.facts[0].text).toContain('the lower storey has no diagonal')
  })

  it('a mechanism with no unbraced storey (defense in depth) states only the status', () => {
    const m = named('upperUnbraced').analysis as BracedFrameMechanismAnalysis
    const facts = explainBracedFrameSingle({ ...m, unbracedStoreys: [] }, [])
    expect(facts[0].text).toBe('This pin-jointed frame is a mechanism, so no displacements or member forces are defined.')
  })

  it('skips facts for non-finite values', () => {
    const r = named('reference')
    const cs = r.evaluation.constraints.map((c) => (c.id === 'mass' ? { ...c, value: Number.NaN, utilization: Number.NaN } : c))
    expect(ids(explainBracedFrameSingle(r.analysis, cs))).not.toContain('single.utilization.mass')
    const a = r.analysis
    if (a.status !== 'solved') throw new Error('expected solved')
    const broken = { ...a, members: { ...a.members, beam1: { ...a.members.beam1!, utilization: Number.NaN } } }
    expect(ids(explainBracedFrameSingle(broken, r.evaluation.constraints))).not.toContain('single.governingMember')
  })

  it('the model fact names unmodeled effects and has no numbers', () => {
    expect(bracedFrameModelLimitsFact().text).not.toMatch(/\d/)
    expect(bracedFrameModelLimitsFact().text).toContain('pin-jointed frame model')
  })
})

describe('explainBracedFrameChange', () => {
  it('baseline → reference: every failed limit changes to pass', () => {
    const facts = explainBracedFrameChange(named('baseline'), named('reference'))
    expect(ids(facts)).toEqual([
      'change.roofDrift', 'change.mass', 'change.governingMember',
      'change.constraint.roofDrift', 'change.constraint.utilization', 'change.constraint.mass', BRACED_FRAME_MODEL_LIMITS_FACT_ID,
    ])
    expect(facts.filter((f) => f.id.startsWith('change.constraint.')).map((f) => f.text)).toEqual([
      'Roof drift: fail → pass.', 'Maximum member utilization: fail → pass.', 'Mass: fail → pass.',
    ])
  })

  it('uniform60 → reference: drift and mass ratios, governing member change and pass changes', () => {
    const prev = named('uniform60')
    const next = named('reference')
    const facts = explainBracedFrameChange(prev, next)
    expect(ids(facts)).toEqual(['change.roofDrift', 'change.mass', 'change.governingMember', 'change.constraint.utilization', BRACED_FRAME_MODEL_LIMITS_FACT_ID])
    if (prev.analysis.status !== 'solved' || next.analysis.status !== 'solved') throw new Error('expected solved')
    const rDrift = next.analysis.roofDriftM / prev.analysis.roofDriftM
    expect(facts[0]).toEqual({ id: 'change.roofDrift', text: `Roof drift changed by ×${rDrift.toFixed(2)}.`, basis: { rDrift } })
    expect(facts[2].text).toBe('The governing member changed from the lower diagonal (bottom right to top left) to the floor beam.')
    expect(facts[3].text).toBe('Maximum member utilization: fail → pass.')
  })

  it('resizing a determinate frame reports that member forces did not change', () => {
    const prev = named('reference')
    const next = named('bucklingBeam')
    const facts = explainBracedFrameChange(prev, next)
    expect(ids(facts)).toEqual(['change.roofDrift', 'change.mass', 'change.governingMember', 'change.forcesUnchanged', 'change.constraint.utilization', BRACED_FRAME_MODEL_LIMITS_FACT_ID])
    expect(facts[3].text).toContain('statically determinate')
    // The same governing member reports its utilization ratio instead.
    const same = explainBracedFrameChange(prev, named('lightLowerDiagonal'))
    expect(ids(same)).toEqual(['change.roofDrift', 'change.mass', 'change.governingUtilization', 'change.forcesUnchanged', 'change.constraint.roofDrift', BRACED_FRAME_MODEL_LIMITS_FACT_ID])
    expect(same[2].text).toBe('The governing member is still the floor beam; its utilization changed by ×1.00.')
  })

  it('no forces-unchanged fact for redundant frames, topology changes or identical sections', () => {
    expect(ids(explainBracedFrameChange(named('xBracedLight'), named('bruteForce')))).not.toContain('change.forcesUnchanged')
    expect(ids(explainBracedFrameChange(named('reference'), named('mixedLight')))).not.toContain('change.forcesUnchanged')
    expect(ids(explainBracedFrameChange(named('reference'), named('reference')))).not.toContain('change.forcesUnchanged')
  })

  it('reports becoming a mechanism and becoming stable again, without drift or member facts', () => {
    const toMech = explainBracedFrameChange(named('reference'), named('upperUnbraced'))
    expect(ids(toMech)).toEqual(['change.stability', 'change.mass', 'change.constraint.stability', 'change.constraint.applicability', BRACED_FRAME_MODEL_LIMITS_FACT_ID])
    expect(toMech[0].text).toBe('The frame became a mechanism: the upper storey has no diagonal.')
    const back = explainBracedFrameChange(named('unbraced'), named('reference'))
    expect(back[0].text).toBe('The frame is stable again: every storey has a diagonal to carry the sideways load.')
    const both = explainBracedFrameChange(named('upperUnbraced'), named('unbraced'))
    expect(ids(both)).toEqual(['change.mass', BRACED_FRAME_MODEL_LIMITS_FACT_ID])
    const m = named('upperUnbraced')
    const bare = { ...m, analysis: { ...(m.analysis as BracedFrameMechanismAnalysis), unbracedStoreys: [] } }
    expect(explainBracedFrameChange(named('reference'), bare)[0].text).toBe('The frame became a mechanism.')
  })

  it('skips ratio facts when stored values are not finite', () => {
    const prev = named('reference')
    const next = named('bucklingBeam')
    if (prev.analysis.status !== 'solved') throw new Error('expected solved')
    const broken = { ...prev, analysis: { ...prev.analysis, roofDriftM: 0, massKg: 0, maxUtilization: 0 } }
    expect(ids(explainBracedFrameChange(broken, next))).not.toEqual(expect.arrayContaining(['change.roofDrift']))
    expect(ids(explainBracedFrameChange(broken, next))).not.toContain('change.mass')
    const sameGov = explainBracedFrameChange(broken, named('lightLowerDiagonal'))
    expect(ids(sameGov)).not.toContain('change.governingUtilization')
  })
})
