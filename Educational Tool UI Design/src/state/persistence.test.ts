import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../test/arbitraries'
import { sequenceHarness } from '../../test/state/sequence'
import { createHarness } from '../../test/state/model'
import { createPersistence, deserializeSession, RESTORE_FAILURE, serializeSession, sessionKey, STORAGE_FAILURE, type SessionStorage } from './persistence'
import { migrateEnvelope } from './migrations'
const ch = bundledChallenge()
function memory() {
  const values = new Map<string, string>()
  const storage: SessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v) }, removeItem: (k) => { values.delete(k) } }
  return { values, storage }
}
describe('persistence validation and failure handling', () => {
  it.each(['truncated', 'version', 'analysis', 'snapshot', 'evaluation', 'missing', 'submission', 'selection', 'prototype'])('rejects %s corruption and removes the entire entry', (kind) => {
    const state = sequenceHarness(() => {}).real.state
    const data = JSON.parse(serializeSession(state))
    if (kind === 'version') data.schemaVersion = 999
    if (kind === 'analysis') data.session.history[1].analysis.tipDeflectionM *= 2
    if (kind === 'snapshot') data.session.history[1].designSnapshot.lengthM = -1
    if (kind === 'evaluation') data.session.history[1].evaluation.status = 'accepted'
    if (kind === 'missing') delete data.session.history
    if (kind === 'submission') data.session.submission = { testResultId: 'missing', status: 'accepted', reflection: 'text', efficiency: { massUsage: 1, deflectionMargin: 1, stressMargin: 1 }, submittedAt: 't' }
    if (kind === 'selection') data.session.compareSelection = ['missing']
    const raw = kind === 'truncated' ? '{' : kind === 'prototype' ? '{"__proto__":{},"schemaVersion":1}' : JSON.stringify(data)
    const { values, storage } = memory()
    values.set(sessionKey(ch), raw)
    const notices: string[] = []
    const controller = createPersistence(ch, storage, (s) => notices.push(s))
    const fresh = createHarness(ch).real.state
    expect(controller.load(fresh)).toBe(fresh)
    expect(notices).toEqual([RESTORE_FAILURE])
    expect(values.size).toBe(0)
  })
  it('uses one challenge/version key, replaces saves, and loads a valid session silently', () => {
    const { values, storage } = memory()
    const notices: string[] = []
    const controller = createPersistence(ch, storage, (s) => notices.push(s))
    const fresh = createHarness(ch).real.state
    expect(controller.load(fresh)).toBe(fresh)
    controller.save(fresh, '2026-10-15T00:00:00.000Z')
    const state = sequenceHarness(() => {}).real.state
    controller.save(state, '2026-10-15T01:00:00.000Z')
    expect(values.size).toBe(1)
    expect(JSON.parse(values.get(sessionKey(ch))!).savedAt).toBe('2026-10-15T01:00:00.000Z')
    expect(controller.load(fresh)).toEqual(state)
    expect(notices).toEqual([])
  })
  it('read/write/remove exceptions preserve in-memory state and emit the storage warning once', () => {
    const notices: string[] = []
    const fail = () => { throw new Error('storage blocked') }
    const controller = createPersistence(ch, { getItem: fail, setItem: fail, removeItem: fail }, (s) => notices.push(s))
    const fresh = createHarness(ch).real.state
    expect(controller.load(fresh)).toBe(fresh)
    controller.save(fresh, 't')
    controller.save(fresh, 't')
    expect(notices).toEqual([STORAGE_FAILURE])
    const removeNotices: string[] = []
    const brokenRemove = createPersistence(ch, { getItem: () => '{', setItem: fail, removeItem: fail }, (s) => removeNotices.push(s))
    expect(brokenRemove.load(fresh)).toBe(fresh)
    expect(removeNotices).toEqual([RESTORE_FAILURE, STORAGE_FAILURE])
  })
  it('accepts analysis differences within 1e-9 relative and rejects differences outside it', () => {
    const data = JSON.parse(serializeSession(createHarness(ch).real.state))
    data.session.history[0].analysis.tipDeflectionM *= 1 + 5e-10
    expect(deserializeSession(JSON.stringify(data), ch).ok).toBe(true)
    data.session.history[0].analysis.tipDeflectionM *= 1 + 2e-9
    expect(deserializeSession(JSON.stringify(data), ch).ok).toBe(false)
  })
  it('applies registered migrations in version order and rejects unknown or non-advancing versions', () => {
    expect(migrateEnvelope({ schemaVersion: 0 }, { 0: (value) => ({ ...value, schemaVersion: 1 }) }).schemaVersion).toBe(1)
    expect(() => migrateEnvelope({ schemaVersion: 0 })).toThrow(/migration/)
    expect(() => migrateEnvelope({ schemaVersion: 0 }, { 0: (value) => value })).toThrow(/advance/)
    expect(() => migrateEnvelope({ schemaVersion: -1 })).toThrow()
  })
})
