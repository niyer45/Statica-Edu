import { describe, expect, it } from 'vitest'
import { bracedFrameChallenge, worksheetFixture } from '../../../test/fixtures/bracedFrame'
import type { BracedFrameDesign } from '../../geometry/bracedFrame/design'
import { PhysicsInvariantError } from '../analyze'
import { analyzeBracedFrame, assembleBracedFrame, BRACED_FRAME_MODEL_ID, BRACED_FRAME_MODEL_VERSION, BracedFrameInvariantError, isMemberPresent } from './analyze'
import { BRACED_FRAME_ASSUMPTIONS, BRACED_FRAME_UNSUPPORTED_EFFECTS } from './constants'

// Braced frame analysis entry point (task 49.2; BFR-06, BFR-10–BFR-14, MM-03, MM-10).

const ch = bracedFrameChallenge()
const reference = worksheetFixture('reference').design
const upperUnbraced = worksheetFixture('upperUnbraced').design

describe('analyzeBracedFrame', () => {
  it('names pinJointedBracedFrame v1 and lists assumptions and unsupported effects', () => {
    const a = analyzeBracedFrame(reference, ch)
    expect(BRACED_FRAME_MODEL_ID).toBe('pinJointedBracedFrame')
    expect(BRACED_FRAME_MODEL_VERSION).toBe(1)
    expect(a).toMatchObject({ modelId: 'pinJointedBracedFrame', modelVersion: 1, status: 'solved', applicable: true, warnings: [], notApplicableReasons: [], unbracedStoreys: [] })
    expect(a.assumptions).toEqual(BRACED_FRAME_ASSUMPTIONS)
    expect(a.unsupportedEffects).toEqual(BRACED_FRAME_UNSUPPORTED_EFFECTS)
  })

  it('returns exactly the documented keys for a solved frame, with finite numbers', () => {
    const a = analyzeBracedFrame(reference, ch)
    expect(Object.keys(a).sort()).toEqual(
      [
        'modelId', 'modelVersion', 'applicable', 'warnings', 'notApplicableReasons', 'unsupportedEffects', 'assumptions',
        'massKg', 'unbracedStoreys', 'status', 'displacementsM', 'members', 'reactionsN', 'floorDriftM', 'roofDriftM',
        'storeyDriftRatios', 'maxStoreyDriftRatio', 'maxUtilization', 'governingMemberId', 'maxInelasticRatio',
      ].sort(),
    )
    expect(Object.keys(a.status === 'solved' ? a.members : {})).toEqual(['col1L', 'col1R', 'col2L', 'col2R', 'beam1', 'beam2', 'diag1a', 'diag2a'])
    const numbers: number[] = []
    JSON.stringify(a, (_k, v: unknown) => (typeof v === 'number' && numbers.push(v), v))
    expect(numbers.every(Number.isFinite)).toBe(true)
  })

  it('returns only mass, the unbraced storeys and the MECHANISM reason for a mechanism (MM-10)', () => {
    const a = analyzeBracedFrame(upperUnbraced, ch)
    expect(a.status).toBe('mechanism')
    expect(a.applicable).toBe(false)
    expect(a.unbracedStoreys).toEqual([2])
    expect(a.notApplicableReasons.map((i) => [i.code, i.value, i.threshold])).toEqual([['MECHANISM', 1, 0]])
    for (const key of ['displacementsM', 'members', 'reactionsN', 'floorDriftM', 'roofDriftM', 'storeyDriftRatios', 'maxStoreyDriftRatio', 'maxUtilization', 'governingMemberId', 'maxInelasticRatio']) {
      expect(Object.prototype.hasOwnProperty.call(a, key), key).toBe(false)
    }
  })

  it('is deep-frozen, deterministic and does not mutate inputs', () => {
    const d = structuredClone(reference)
    const before = structuredClone(d)
    const a = analyzeBracedFrame(d, ch)
    expect(Object.isFrozen(a)).toBe(true)
    expect(Object.isFrozen(a.status === 'solved' && a.members.beam1)).toBe(true)
    expect(analyzeBracedFrame(d, ch)).toEqual(a)
    expect(d).toEqual(before)
  })

  it('ignores absent diagonals for stiffness and mass, whatever their section', () => {
    const swapped: BracedFrameDesign = { ...reference, members: { ...reference.members, diag1b: { present: false, sectionId: 'CHS88.9x5.0' } } }
    expect(analyzeBracedFrame(swapped, ch)).toEqual(analyzeBracedFrame(reference, ch))
    expect(isMemberPresent(reference, 'diag1b')).toBe(false)
    expect(isMemberPresent(reference, 'col1L')).toBe(true)
    expect(assembleBracedFrame(reference, ch).members.map((m) => m.id)).toEqual(['col1L', 'col1R', 'col2L', 'col2R', 'beam1', 'beam2', 'diag1a', 'diag2a'])
  })

  it('assembles fixed supports at j1/j2 and the challenge loads', () => {
    const { problem } = assembleBracedFrame(reference, ch)
    expect(problem.fixedDofs).toEqual([0, 1, 2, 3])
    expect(problem.loadsN).toEqual([0, 0, 0, 0, 20000, 0, 0, 0, 40000, -40000, 0, -40000])
  })

  it('throws a typed invariant error for a section outside the catalog (a design that skipped validation)', () => {
    const bad: BracedFrameDesign = { ...reference, members: { ...reference.members, beam1: { sectionId: 'CHS114.3x6.3' } } }
    expect(() => analyzeBracedFrame(bad, ch)).toThrow(BracedFrameInvariantError)
    try {
      analyzeBracedFrame(bad, ch)
    } catch (e) {
      expect(e).toBeInstanceOf(PhysicsInvariantError)
      expect(e).toMatchObject({ name: 'BracedFrameInvariantError', field: 'members.beam1.sectionId' })
    }
  })

  it('throws for non-finite results instead of storing them', () => {
    expect(() => analyzeBracedFrame(reference, { ...ch, material: { ...ch.material, densityKgM3: 0 } })).toThrow(/massKg/)
    expect(() => analyzeBracedFrame(reference, { ...ch, material: { ...ch.material, yieldStressPa: Number.POSITIVE_INFINITY } })).toThrow(BracedFrameInvariantError)
  })

  it('solves very large finite loads linearly (no overflow in the residual norm)', () => {
    const a = analyzeBracedFrame(reference, ch)
    const b = analyzeBracedFrame(reference, { ...ch, loads: ch.loads.map((l) => ({ ...l, fxN: l.fxN * 1e290, fyN: l.fyN * 1e290 })) })
    if (a.status !== 'solved' || b.status !== 'solved') throw new Error('expected solved')
    expect(b.roofDriftM / a.roofDriftM).toBeCloseTo(1e290, -280)
  })

  it('never stores −0', () => {
    const a = analyzeBracedFrame(worksheetFixture('baseline').design, ch)
    JSON.stringify(a, (_k, v: unknown) => {
      if (typeof v === 'number') expect(Object.is(v, -0)).toBe(false)
      return v
    })
    if (a.status !== 'solved') throw new Error('expected solved')
    expect(Object.is(a.reactionsN.j1.x, -0)).toBe(false)
  })
})
