import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../../test/arbitraries'
import { UnregisteredModelError } from '../../state/models'
import { initSession } from '../../state/session'
import { makeStoreReducer } from './storeReducer'

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
    expect(() => makeStoreReducer({ ...ch, model: { id: 'sdofBaseIsolation', version: 1 } })).toThrow(UnregisteredModelError)
  })

  it('refuses a registered model without an integrated workbench', () => {
    expect(() => makeStoreReducer({ ...ch, model: { id: 'circularShaftTorsion', version: 1 } })).toThrow('beam model only')
  })
})
