import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../test/arbitraries'
import { deserializeSession, serializeSession, sessionKey } from './persistence'
import { sessionReducer } from './reducer'
import { initSession, type Action, type SessionState } from './session'

// Frozen beam save format (task 34.1 step 1; MM-17, D-39). The fixture was recorded with the
// release before the model registry (ba1dc2d, regenerated there and compared byte-for-byte).
// Two guards: the recorded bytes must keep loading with identical content (existing saves
// survive), and the same deterministic session must still serialize to exactly those bytes
// (the writer is unchanged, so a rollback to that release can read new saves). Loading
// normalizes key order to the schema order, which is pre-existing and content-neutral.

// Task 59 and its D-47 amendment changed the bundled baseline (now content version 3), so this save
// belongs to the version 1 content: the same challenge with the Ø30 mm circle baseline. The
// frozen v1 envelope format is unchanged; only the content version (and storage key) moved.
const raw = readFileSync(new URL('../../test/fixtures/sessions/cantilever-beam-1.v1.json', import.meta.url), 'utf8')
const current = bundledChallenge()
const ch = { ...current, version: 1, initialDesign: { ...current.initialDesign, section: { kind: 'circle' as const, diameterM: 0.03 }, orientationDeg: 0 as const } }
const SAVED_AT = '2026-10-17T09:05:00.000Z'

/** The action sequence that produced the fixture. */
function recordedSession(): SessionState {
  const init = initSession(ch, '2026-10-17T09:00:00.000Z', 'baseline-0001', 'parametric')
  if (!init.ok) throw new Error('bundled challenge must initialize')
  const actions: Action[] = [
    { type: 'applySection', kind: 'tube' },
    { type: 'setParam', param: 'outerDiameterM', valueM: 0.05, mode: 'strict' },
    { type: 'setParam', param: 'innerDiameterM', valueM: 0.04, mode: 'strict' },
    { type: 'setPrediction', direction: 'decrease', explanation: 'Material moved away from the axis.', now: '2026-10-17T09:01:00.000Z' },
    { type: 'runTest', now: '2026-10-17T09:01:01.000Z', id: 'test-0001' },
    { type: 'applySection', kind: 'rectangle' },
    { type: 'setOrientation', orientationDeg: 90 },
    { type: 'runTest', now: '2026-10-17T09:02:00.000Z', id: 'test-0002' },
    { type: 'applySection', kind: 'iSection' },
    { type: 'setPrediction', direction: 'same', now: '2026-10-17T09:03:00.000Z' },
    { type: 'runTest', now: '2026-10-17T09:03:01.000Z', id: 'test-0003' },
    { type: 'deleteIteration', testResultId: 'test-0002' },
    { type: 'restore', testResultId: 'test-0001' },
    { type: 'setReflection', text: 'The tube kept the mass and cut the deflection.' },
    { type: 'submit', testResultId: 'test-0001', now: '2026-10-17T09:04:00.000Z' },
  ]
  return actions.reduce((s, a) => sessionReducer(s, a, ch), init.value)
}

describe('recorded v1 Cantilever Beam I save', () => {
  it('still serializes the recorded session to exactly the recorded bytes', () => {
    expect(serializeSession(recordedSession(), SAVED_AT)).toBe(raw)
  })

  it('loads with content identical to the recorded save, and re-serializes stably', () => {
    const restored = deserializeSession(raw, ch)
    if (!restored.ok) throw new Error(restored.error)
    const rewritten = serializeSession(restored.value, SAVED_AT)
    expect(JSON.parse(rewritten)).toEqual(JSON.parse(raw))
    const again = deserializeSession(rewritten, ch)
    if (!again.ok) throw new Error(again.error)
    expect(serializeSession(again.value, SAVED_AT)).toBe(rewritten)
  })

  it('keeps the recorded learning-loop state', () => {
    const restored = deserializeSession(raw, ch)
    if (!restored.ok) throw new Error(restored.error)
    const s = restored.value
    expect(s.history.map((r) => r.id)).toEqual(['baseline-0001', 'test-0001', 'test-0002', 'test-0003'])
    expect(s.history.map((r) => r.evaluation.status)).toEqual(['notAccepted', 'accepted', 'notAccepted', 'accepted'])
    expect(s.history[1]!.predictionOutcome).toMatchObject({ predicted: 'decrease', actual: 'decrease', matched: true })
    expect(s.history[3]!.predictionOutcome).toMatchObject({ predicted: 'same', actual: 'increase', matched: false })
    expect(s.deletedIterationIds).toEqual(['test-0002'])
    expect(s.compareSelection).toEqual(['test-0001', 'test-0003'])
    expect(s.submission?.testResultId).toBe('test-0001')
    expect(s.pendingPrediction).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(s, 'pendingPrediction')).toBe(true)
    expect(s.mode).toBe('parametric')
  })

  it('rejects the same save for a challenge bound to an unregistered model', () => {
    const restored = deserializeSession(raw, { ...ch, model: { id: 'sdofBaseIsolation', version: 2 } })
    expect(restored).toEqual({ ok: false, error: 'Analysis model "sdofBaseIsolation" version 2 is not available.' })
  })

  it('is stored under the version 1 key and never loads into the current (version 3) content', () => {
    expect(current.version).toBe(3)
    expect(sessionKey(ch)).toBe('ei:session:cantilever-beam-1:v1')
    expect(sessionKey(current)).toBe('ei:session:cantilever-beam-1:v3')
    expect(deserializeSession(raw, current)).toEqual({ ok: false, error: 'Saved challenge mismatch' })
  })

  it('never reads a v1 beam save through another registered model', () => {
    const restored = deserializeSession(raw, { ...ch, model: { id: 'circularShaftTorsion', version: 1 } })
    expect(restored).toEqual({ ok: false, error: 'Saved session format is not supported for this model' })
  })
})
