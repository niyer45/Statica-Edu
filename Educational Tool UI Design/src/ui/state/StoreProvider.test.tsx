import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import type { Challenge } from '../../challenge/types'
import { BASELINE_LABEL } from '../../state/session'
import { bootstrap } from './bootstrap'
import { useStore, type Store } from './store'
import StoreProvider from './StoreProvider'

// Task 13.2: store provider (Req 3.7, 23.10, 35.1, 35.4).

const clock = () => '2025-01-01T00:00:00.000Z'
let n = 0
const newId = () => `id-${++n}`

function setup(initialMode?: Challenge['allowedModes'][number]) {
  const boot = bootstrap(bundledChallengeResult, clock, newId)
  if (!boot.ok) throw new Error(boot.error.message)
  const ref: { current: Store | null } = { current: null }
  function Probe() {
    ref.current = useStore()
    return null
  }
  const utils = render(
    <StoreProvider
      challenge={boot.value.challenge}
      initialSession={boot.value.session}
      initialMode={initialMode}
      clock={clock}
      newId={newId}
    >
      <Probe />
    </StoreProvider>,
  )
  const store = () => {
    if (ref.current === null) throw new Error('store not mounted')
    return ref.current
  }
  return { ...utils, store, challenge: boot.value.challenge }
}

afterEach(cleanup)

describe('StoreProvider', () => {
  it('provides the baseline session and the student challenge', () => {
    const { store, challenge } = setup()
    const s = store().state
    expect(s.challengeId).toBe(challenge.id)
    expect(s.history).toHaveLength(1)
    expect(s.history[0]?.label).toBe(BASELINE_LABEL)
    expect(s.history[0]?.iteration).toBe(0)
    expect(s.history[0]?.timestamp).toBe(clock())
    expect(s.draftStatus).toBe('tested')
    expect(s.mode).toBe(challenge.allowedModes[0])
    // Req 3.7: referenceDesign is structurally absent from the student view.
    expect(Object.prototype.hasOwnProperty.call(store().challenge, 'referenceDesign')).toBe(false)
  })

  it('sets the selected mode and rejects modes outside allowedModes', () => {
    const { store } = setup('parametric')
    expect(store().state.mode).toBe('parametric')
    const before = store().state
    let ok = true
    act(() => {
      ok = store().selectMode('freeform')
    })
    expect(ok).toBe(false)
    expect(store().state).toBe(before)
    act(() => {
      ok = store().selectMode('guided')
    })
    expect(ok).toBe(true)
    expect(store().state.mode).toBe('guided')
    // Only the mode changes (Req 35.3).
    expect(store().state.draft).toEqual(before.draft)
    expect(store().state.history).toBe(before.history)
  })

  it('ignores a disallowed initial mode', () => {
    const { store, challenge } = setup('freeform')
    expect(store().state.mode).toBe(challenge.allowedModes[0])
  })

  it('dispatches reducer actions', () => {
    const { store } = setup()
    const orientation = store().state.draft.orientationDeg === 0 ? 90 : 0
    act(() => store().dispatch({ type: 'setOrientation', orientationDeg: orientation }))
    expect(store().state.draft.orientationDeg).toBe(orientation)
    expect(store().state.draftStatus).toBe('draft')
  })

  it('exposes a frozen read-only snapshot on window.__EI_STATE__ in test builds', () => {
    const { store, unmount } = setup()
    const snap = window.__EI_STATE__
    expect(snap).toBeDefined()
    expect(snap).toEqual(store().state)
    expect(snap).not.toBe(store().state)
    expect(Object.isFrozen(snap)).toBe(true)
    expect(Object.isFrozen(snap?.draft.section)).toBe(true)
    // Cannot be reassigned or mutated.
    expect(() => {
      ;(window as unknown as Record<string, unknown>).__EI_STATE__ = { hacked: true }
    }).toThrow(TypeError)
    expect(() => {
      ;(snap as unknown as { mode: string }).mode = 'freeform'
    }).toThrow(TypeError)
    expect(window.__EI_STATE__).toBe(snap)

    // Updates follow the store.
    act(() => store().dispatch({ type: 'setOrientation', orientationDeg: store().state.draft.orientationDeg === 0 ? 90 : 0 }))
    expect(window.__EI_STATE__?.draft).toEqual(store().state.draft)

    unmount()
    expect(window.__EI_STATE__).toBeUndefined()
  })
})
