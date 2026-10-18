import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../test/arbitraries'
import { heatSinkChallenge } from '../../test/fixtures/heatSink'
import { torsionChallenge } from '../../test/fixtures/torsion'
import { cantileverBeam1Json } from '../challenge/content'
import { initSessionWith } from './engine'
import { heatSinkModel } from './heatSinkModel'
import { beamModel } from './models'
import { sessionKey } from './persistence'
import { beamRuntime, heatSinkRuntime, runtimeFor, runtimeForJson, torsionRuntime, vibrationRuntime } from './runtimes'
import { torsionModel } from './torsionModel'
import { vibrationModel } from './vibrationModel'
import { vibrationChallenge } from '../../test/fixtures/vibration'

// Model runtimes (task 34.2; MM-05, MM-15–MM-18): dispatch by explicit identity only, and each
// runtime's persistence uses its own envelope.

const T0 = '2026-10-17T00:00:00.000Z'

describe('runtime dispatch', () => {
  it('resolves exact registered identities only', () => {
    expect(runtimeFor(beamModel.ref)).toBe(beamRuntime)
    expect(runtimeFor(torsionModel.ref)).toBe(torsionRuntime)
    expect(runtimeFor(heatSinkModel.ref)).toBe(heatSinkRuntime)
    expect(runtimeFor({ id: 'circularShaftTorsion', version: 2 })).toBeUndefined()
    expect(runtimeFor(vibrationModel.ref)).toBe(vibrationRuntime)
    expect(runtimeFor({ id: 'sdofBaseIsolation', version: 2 })).toBeUndefined()
    expect(runtimeFor({ id: 'notARegisteredModel', version: 1 })).toBeUndefined()
    expect(runtimeFor({ id: 'plateFinHeatSink', version: 2 })).toBeUndefined()
  })

  it.each([
    ['a beam config without model', cantileverBeam1Json, beamRuntime],
    ['an explicit torsion model', { model: { id: 'circularShaftTorsion', version: 1 } }, torsionRuntime],
    ['an explicit vibration model', { model: { id: 'sdofBaseIsolation', version: 1 } }, vibrationRuntime],
    ['an unregistered model', { model: { id: 'notARegisteredModel', version: 1 } }, undefined],
    ['an unregistered model version', { model: { id: 'sdofBaseIsolation', version: 2 } }, undefined],
    ['an explicit heat sink model', { model: { id: 'plateFinHeatSink', version: 1 } }, heatSinkRuntime],
    ['a malformed model', { model: 'circularShaftTorsion' }, undefined],
    ['a model with a non-numeric version', { model: { id: 'circularShaftTorsion', version: '1' } }, undefined],
    ['a non-object config', [1, 2], beamRuntime],
  ])('reads %s from raw config', (_name, json, expected) => {
    expect(runtimeForJson(json)).toBe(expected)
  })
})

describe('runtime persistence', () => {
  it('beam runtime writes the frozen v1 envelope under the shared key', () => {
    const ch = bundledChallenge()
    const s = beamRuntime.init(ch, T0, 'b0')
    if (!s.ok) throw new Error(s.error.message)
    expect(beamRuntime.key(ch)).toBe(sessionKey(ch))
    const raw = beamRuntime.serialize(s.value, T0)
    expect(JSON.parse(raw).schemaVersion).toBe(1)
    expect(beamRuntime.deserialize(raw, ch)).toEqual({ ok: true, value: s.value })
  })

  it('torsion runtime round-trips a v2 envelope and refuses the beam format', () => {
    const ch = torsionChallenge()
    const s = torsionRuntime.init(ch, T0, 't0', 'parametric')
    if (!s.ok) throw new Error(s.error.message)
    expect(s.value.mode).toBe('parametric')
    expect(torsionRuntime.key(ch)).toBe('ei:session:torsion-shaft-1:v1')
    const raw = torsionRuntime.serialize(s.value, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: torsionModel.ref })
    const back = torsionRuntime.deserialize(raw, ch)
    if (!back.ok) throw new Error(back.error)
    expect(back.value).toEqual(s.value)
    expect(torsionRuntime.load(JSON.parse(JSON.stringify(ch))).ok).toBe(true)
  })

  it('heat sink runtime round-trips a v2 envelope under its own key and refuses another model', () => {
    const ch = heatSinkChallenge()
    const s = heatSinkRuntime.init(ch, T0, 'h0', 'guided')
    if (!s.ok) throw new Error(s.error.message)
    expect(s.value.mode).toBe('guided')
    expect(heatSinkRuntime.key(ch)).toBe('ei:session:heat-sink-1:v1')
    const raw = heatSinkRuntime.serialize(s.value, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: heatSinkModel.ref })
    const back = heatSinkRuntime.deserialize(raw, ch)
    if (!back.ok) throw new Error(back.error)
    expect(back.value).toEqual(s.value)
    expect(heatSinkRuntime.load(JSON.parse(JSON.stringify(ch))).ok).toBe(true)
    // A torsion envelope is never read as a heat sink session (MM-07).
    const t = torsionRuntime.init(torsionChallenge(), T0, 't0')
    if (!t.ok) throw new Error(t.error.message)
    expect(heatSinkRuntime.deserialize(torsionRuntime.serialize(t.value, T0), ch).ok).toBe(false)
  })
})

describe('initSessionWith failures (MM-10)', () => {
  it('reports an invalid initial design without a session', () => {
    const ch = torsionChallenge()
    const broken = { ...ch, initialDesign: { ...ch.initialDesign, section: { kind: 'circle' as const, diameterM: 0.2 } } }
    const r = initSessionWith(torsionModel, broken, T0, 'x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toMatch(/initial design is invalid \(\d+ problems?\)/)
  })

  it('reports an analysis failure without throwing', () => {
    const ch = torsionChallenge()
    const throwing = { ...torsionModel, analyze: () => { throw new Error('boom') } }
    const r = initSessionWith(throwing, ch, T0, 'x')
    expect(r).toEqual({ ok: false, error: { source: 'initialDesign', message: 'The challenge initial design could not be analyzed.', details: ['boom'] } })
  })

  it('vibration runtime round-trips a v2 envelope under its own key and refuses another model', () => {
    const ch = vibrationChallenge()
    const s = vibrationRuntime.init(ch, T0, 'v0', 'parametric')
    if (!s.ok) throw new Error(s.error.message)
    expect(s.value.mode).toBe('parametric')
    expect(vibrationRuntime.key(ch)).toBe('ei:session:vibration-isolation-1:v1')
    const raw = vibrationRuntime.serialize(s.value, T0)
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: 2, model: vibrationModel.ref })
    const back = vibrationRuntime.deserialize(raw, ch)
    if (!back.ok) throw new Error(back.error)
    expect(back.value).toEqual(s.value)
    expect(vibrationRuntime.load(JSON.parse(JSON.stringify(ch))).ok).toBe(true)
    const torsion = torsionChallenge()
    const t = torsionRuntime.init(torsion, T0, 't0')
    if (!t.ok) throw new Error(t.error.message)
    expect(vibrationRuntime.deserialize(torsionRuntime.serialize(t.value, T0), ch).ok).toBe(false)
  })
})
