import { describe, expect, it } from 'vitest'
import { bracedFrameChallenge, frameDesign, worksheetFixture as frameFixture } from '../fixtures/bracedFrame'
import { heatSink, heatSinkChallenge } from '../fixtures/heatSink'
import { shaft, solid, torsionChallenge } from '../fixtures/torsion'
import { vibrationChallenge } from '../fixtures/vibration'
import { bracedFrameModel } from '../../src/state/bracedFrameModel'
import { heatSinkModel } from '../../src/state/heatSinkModel'
import { bracedFrameRuntime, heatSinkRuntime, torsionRuntime } from '../../src/state/runtimes'
import { torsionModel } from '../../src/state/torsionModel'
import { vibrationModel } from '../../src/state/vibrationModel'

// Task 59 (owner requirement): every challenge baseline fails as many of its design checks as
// any valid, in-range design can, while staying applicable (no model-validity failure or warning)
// and leaving the reference design reachable and Accepted. "Design checks" are the challenge
// limits; the applicability check is a model-validity gate, not a design task, so it is excluded
// and the baseline must pass it. Each search walks the challenge's own step grid exhaustively.

/** Every valid design's applicable/failure summary, from the registered model's pure functions. */
interface ModelFns<D, Ch> {
  validateDesign(d: D, ch: Ch): readonly unknown[]
  analyze(d: D, ch: Ch): { applicable: boolean; warnings?: readonly unknown[] }
  evaluate(d: D, a: never, ch: Ch): { failures: readonly string[]; status: string }
}

function designChecksFailed<D, Ch>(model: ModelFns<D, Ch>, d: D, ch: Ch): { applicable: boolean; warnings: number; failed: string[]; status: string } {
  const a = model.analyze(d, ch)
  const e = model.evaluate(d, a as never, ch)
  return { applicable: a.applicable, warnings: a.warnings?.length ?? 0, failed: e.failures.filter((f) => f !== 'applicability'), status: e.status }
}

/** The most design checks any valid, applicable design in `designs` fails. */
function maxFailed<D, Ch>(model: ModelFns<D, Ch>, ch: Ch, designs: Iterable<D>): { max: number; searched: number } {
  let max = 0
  let searched = 0
  for (const d of designs) {
    if (model.validateDesign(d, ch).length > 0) continue
    searched++
    const r = designChecksFailed(model, d, ch)
    if (r.applicable) max = Math.max(max, r.failed.length)
  }
  return { max, searched }
}

const grid = (min: number, max: number, step: number): number[] =>
  Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => Math.round((min + i * step) * 1e9) / 1e9)

/** The runtime surface used below; every registered runtime satisfies it. */
interface SaveRuntime {
  init(ch: never, now: string, id: string): { ok: true; value: unknown } | { ok: false }
  key(ch: never): string
  serialize(s: never, savedAt: string): string
  deserialize(raw: string, ch: never): { ok: boolean }
}

/** A save written for the previous content version must not load into the new one (MM-04). */
function expectStaleSaveIgnored<Ch extends { version: number }>(rt: SaveRuntime, ch: Ch, previous: Ch) {
  const old = rt.init(previous as never, '2026-10-17T09:00:00.000Z', 'old-baseline')
  if (!old.ok) throw new Error('previous content must initialize')
  expect(previous.version).toBe(ch.version - 1)
  expect(rt.key(previous as never)).not.toBe(rt.key(ch as never))
  const raw = rt.serialize(old.value as never, '2026-10-17T09:00:00.000Z')
  expect(rt.deserialize(raw, previous as never).ok).toBe(true)
  expect(rt.deserialize(raw, ch as never)).toEqual({ ok: false, error: 'Saved challenge mismatch' })
}

describe('Torsion Shaft I baseline difficulty', () => {
  const ch = torsionChallenge()
  const base = designChecksFailed(torsionModel, ch.initialDesign, ch)

  it('fails twist and shear stress, applicable and without warnings', () => {
    expect(base).toEqual({ applicable: true, warnings: 0, failed: ['twist', 'shearStress'], status: 'notAccepted' })
  })

  it('no valid shaft on the step grid fails more design checks', () => {
    const L = ch.sectionLimits
    function* designs() {
      for (const d of grid(L.circle!.diameterM.minM, L.circle!.diameterM.maxM, L.circle!.diameterM.stepM)) yield shaft('s', solid(d))
      for (const D of grid(L.tube!.outerDiameterM.minM, L.tube!.outerDiameterM.maxM, L.tube!.outerDiameterM.stepM)) {
        for (const d of grid(0.0005, D - 2 * L.tube!.minWallM, 0.0005)) yield shaft('t', { kind: 'tube', outerDiameterM: D, innerDiameterM: d })
      }
    }
    const r = maxFailed(torsionModel, ch, designs())
    expect(r.searched).toBeGreaterThan(6000)
    expect(r.max).toBe(base.failed.length)
  })

  it('keeps the reference Accepted', () => {
    expect(designChecksFailed(torsionModel, ch.referenceDesign!, ch)).toMatchObject({ applicable: true, failed: [], status: 'accepted' })
  })

  it('moves saves to a new key so a previous-version save is never re-scored', () => {
    expectStaleSaveIgnored(torsionRuntime, ch, { ...ch, version: 1, initialDesign: { ...ch.initialDesign, section: solid(0.03) } })
  })
})

describe('Heat Sink I baseline difficulty', () => {
  const ch = heatSinkChallenge()
  const base = designChecksFailed(heatSinkModel, ch.initialDesign, ch)

  it('fails base temperature, mass and fin height, applicable and without warnings', () => {
    expect(base).toEqual({ applicable: true, warnings: 0, failed: ['baseTemperature', 'mass', 'finHeight'], status: 'notAccepted' })
  })

  it('no valid fin array on the step grid fails more design checks', () => {
    const L = ch.designLimits
    function* designs() {
      for (let n = L.finCount.min; n <= L.finCount.max; n += L.finCount.step) {
        for (const t of grid(L.finThicknessM.minM, L.finThicknessM.maxM, L.finThicknessM.stepM)) {
          for (const h of grid(L.finHeightM.minM, L.finHeightM.maxM, L.finHeightM.stepM)) yield heatSink('h', n, t, h)
        }
      }
    }
    const r = maxFailed(heatSinkModel, ch, designs())
    expect(r.searched).toBe(5289)
    expect(r.max).toBe(base.failed.length)
  })

  it('keeps the reference Accepted', () => {
    expect(designChecksFailed(heatSinkModel, ch.referenceDesign!, ch)).toMatchObject({ applicable: true, failed: [], status: 'accepted' })
  })

  it('moves saves to a new key so a previous-version save is never re-scored', () => {
    expectStaleSaveIgnored(heatSinkRuntime, ch, { ...ch, version: 1, initialDesign: heatSink('baseline', 4, 0.003, 0.015) })
  })
})

describe('Vibration Isolation I baseline difficulty (unchanged: already the maximum)', () => {
  const ch = vibrationChallenge()
  const base = designChecksFailed(vibrationModel, ch.initialDesign, ch)

  it('fails in-band transmissibility, peak transmissibility and clearance, applicable and without warnings', () => {
    expect(base).toEqual({
      applicable: true,
      warnings: 0,
      failed: ['worstInBandTransmissibility', 'peakTransmissibility', 'relativeDisplacement'],
      status: 'notAccepted',
    })
  })

  it('no valid mount on the step grid fails more design checks (sag fails only when the mount is soft enough to isolate)', () => {
    const L = ch.stiffnessLimits
    function* designs() {
      for (const m of ch.materials) for (const k of grid(L.minNPerM, L.maxNPerM, L.stepNPerM)) yield { id: 'v', stiffnessNPerM: k, materialId: m.id }
    }
    const r = maxFailed(vibrationModel, ch, designs())
    expect(r.searched).toBe(19805)
    expect(r.max).toBe(base.failed.length)
  })

  it('keeps the reference Accepted', () => {
    expect(designChecksFailed(vibrationModel, ch.referenceDesign!, ch)).toMatchObject({ applicable: true, failed: [], status: 'accepted' })
  })
})

describe('Braced Frame I baseline difficulty', () => {
  const ch = bracedFrameChallenge()
  const base = designChecksFailed(bracedFrameModel, ch.initialDesign, ch)

  it('is stable and applicable without warnings but fails roof drift, utilization and mass: every numeric check a stable frame has', () => {
    expect(base).toEqual({ applicable: true, warnings: 0, failed: ['roofDrift', 'utilization', 'mass'], status: 'notAccepted' })
    // A stable frame reports exactly stability plus these three design checks, so none can fail more.
    const a = bracedFrameModel.analyze(ch.initialDesign, ch)
    const e = bracedFrameModel.evaluate(ch.initialDesign, a, ch)
    expect(e.constraints.map((c) => c.id)).toEqual(['stability', 'roofDrift', 'utilization', 'mass', 'applicability'])
  })

  it('a mechanism has only stability and mass as design checks, so it fails fewer', () => {
    const heavyMechanism = frameDesign('m', [89, 89, 89, 89, 89, 89], { diag1a: 89 })
    const r = designChecksFailed(bracedFrameModel, heavyMechanism, ch)
    expect(r.applicable).toBe(false)
    expect(r.failed).toEqual(['stability', 'mass'])
    expect(r.failed.length).toBeLessThan(base.failed.length)
  })

  it('is the worksheet baseline row and keeps the reference Accepted', () => {
    expect(ch.initialDesign.members).toEqual(frameFixture('baseline').design.members)
    expect(designChecksFailed(bracedFrameModel, ch.referenceDesign!, ch)).toMatchObject({ applicable: true, failed: [], status: 'accepted' })
  })

  it('moves saves to a new key so a previous-version save is never re-scored', () => {
    expectStaleSaveIgnored(bracedFrameRuntime, ch, { ...ch, version: 1, initialDesign: frameFixture('uniform60').design })
  })
})
