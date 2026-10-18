import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../../test/arbitraries'
import { UnregisteredModelError } from '../../state/models'
import { initSession } from '../../state/session'
import { torsionChallenge } from '../../../test/fixtures/torsion'
import { beamRuntime, torsionRuntime, type ModelRuntime } from '../../state/runtimes'
import { makeRuntimeReducer, makeStoreReducer, requireRuntime } from './storeReducer'

// The store binds a challenge only through its registered model (task 34.1 step 1; MM-07).

describe('makeStoreReducer model binding', () => {
  const ch = bundledChallenge()

  it('binds the bundled beam challenge and still reduces actions', () => {
    const init = initSession(ch, '2026-10-17T00:00:00.000Z', 'b0')
    if (!init.ok) throw new Error('bundled challenge must initialize')
    const reduce = makeStoreReducer(ch)
    const next = reduce(init.value, { type: 'selectMode', mode: 'parametric' })
    expect(next.mode).toBe('parametric')
  })

  it('refuses a challenge whose model is not registered', () => {
    expect(() => makeStoreReducer({ ...ch, model: { id: 'sdofBaseIsolation', version: 2 } })).toThrow(UnregisteredModelError)
  })

  it('binds each challenge to its own registered runtime by explicit identity', () => {
    expect(requireRuntime(ch)).toBe(beamRuntime)
    expect(requireRuntime(torsionChallenge())).toBe(torsionRuntime)
    expect(() => requireRuntime({ ...ch, model: { id: 'circularShaftTorsion', version: 2 } })).toThrow(UnregisteredModelError)
  })

  it('applies the torsion reducer and mode selection through the runtime reducer', () => {
    const tch = torsionChallenge()
    const init = torsionRuntime.init(tch, '2026-10-17T00:00:00.000Z', 't0')
    if (!init.ok) throw new Error('torsion challenge must initialize')
    const reduce = makeRuntimeReducer(tch, torsionRuntime as unknown as ModelRuntime)
    const edited = reduce(init.value, { type: 'edit', edit: { type: 'setSection', kind: 'tube' } })
    expect(edited.draftStatus).toBe('draft')
    expect(reduce(edited, { type: 'selectMode', mode: 'parametric' }).mode).toBe('parametric')
  })
})
