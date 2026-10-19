import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../arbitraries'
import { baseline as beamBaseline, reference as beamReference, sidewaysI } from '../fixtures/designs'
import type { BeamDesign, Section } from '../../src/geometry/sections'
import { beamModel } from '../../src/state/models'
import { bracedFrameChallenge, frameDesign, worksheetFixture as frameFixture } from '../fixtures/bracedFrame'
import { heatSink, heatSinkChallenge } from '../fixtures/heatSink'
import { shaft, solid, torsionChallenge } from '../fixtures/torsion'
import { vibrationChallenge } from '../fixtures/vibration'
import { bracedFrameModel } from '../../src/state/bracedFrameModel'
import { fatigueModel } from '../../src/state/fatigueModel'
import { fatigueChallenge, spindle } from '../fixtures/fatigue'
import { heatSinkModel } from '../../src/state/heatSinkModel'
import { beamRuntime, bracedFrameRuntime, heatSinkRuntime, torsionRuntime } from '../../src/state/runtimes'
import { torsionModel } from '../../src/state/torsionModel'
import { vibrationModel } from '../../src/state/vibrationModel'
import { axialModel } from '../../src/state/axialModel'
import { axialChallenge, gridDesigns } from '../fixtures/axial'

// Task 59 (owner requirement): every challenge baseline fails as many of its design checks as
// any valid, in-range design can, while staying applicable (no model-validity failure or warning)
// and leaving the reference design reachable and Accepted. "Design checks" are the challenge
// limits; the applicability check is a model-validity gate, not a design task, so it is excluded
// and the baseline must pass it (as must the beam's feature-geometry validity check). Each search
// walks the challenge's own step grid exhaustively, except the beam, which is bounded by argument.

/** Every valid design's applicable/failure summary, from the registered model's pure functions. */
interface ModelFns<D, Ch> {
  validateDesign(d: D, ch: Ch): readonly unknown[]
  analyze(d: D, ch: Ch): { applicable: boolean; warnings?: readonly unknown[] }
  evaluate(d: D, a: never, ch: Ch): { failures: readonly string[]; status: string }
}

function designChecksFailed<D, Ch>(model: ModelFns<D, Ch>, d: D, ch: Ch): { applicable: boolean; warnings: number; failed: string[]; status: string } {
  const a = model.analyze(d, ch)
  const e = model.evaluate(d, a as never, ch)
  return { applicable: a.applicable, warnings: a.warnings?.length ?? 0, failed: e.failures.filter((f) => f !== 'applicability' && f !== 'featureGeometry'), status: e.status }
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

describe('Cantilever Beam I baseline difficulty (a solid circle, D-47 amendment)', () => {
  const ch = bundledChallenge()
  const base = designChecksFailed(beamModel, ch.initialDesign, ch)
  const circle = (diameterM: number): BeamDesign => ({ ...ch.initialDesign, id: 'c', section: { kind: 'circle', diameterM }, orientationDeg: 0 })
  const r = ch.sectionLimits.circle.diameterM
  const circles = grid(r.minM, r.maxM, r.stepM).map((d) => ({ d, ...designChecksFailed(beamModel, circle(d), ch) }))

  it('is a solid Ø31 mm circle failing deflection and mass, applicable without warnings', () => {
    expect(ch.initialDesign).toMatchObject({ section: beamBaseline.design.section, orientationDeg: 0 })
    expect(base).toEqual({ applicable: true, warnings: 0, failed: ['deflection', 'mass'], status: 'notAccepted' })
  })

  it('no circle on the step grid fails more design checks without a warning; ties go to the most flexible', () => {
    expect(circles).toHaveLength(191)
    const clean = circles.filter((c) => c.applicable && c.warnings === 0)
    const max = Math.max(...clean.map((c) => c.failed.length))
    expect(max).toBe(base.failed.length)
    const tied = clean.filter((c) => c.failed.length === max)
    // Every tie fails deflection and mass (Ø31–35.5 mm); the smallest misses deflection by most.
    expect(tied.map((c) => c.d)).toEqual(grid(0.031, 0.0355, 0.0005))
    for (const c of tied) expect(c.failed).toEqual(['deflection', 'mass'])
    expect(tied[0]!.d).toBe((ch.initialDesign.section as { diameterM: number }).diameterM)
  })

  it('records the circles that fail more only with a model warning', () => {
    // Small circles fail deflection and stress but deflect beyond small-deflection accuracy; circles
    // above 80 mm fail mass and both envelope checks but are deep for their span.
    const at = (d: number) => circles.find((c) => Math.abs(c.d - d) < 1e-9)!
    expect(at(0.0245)).toMatchObject({ applicable: true, warnings: 1, failed: ['deflection', 'stress'] })
    expect(at(0.0805)).toMatchObject({ applicable: true, warnings: 1, failed: ['mass', 'envelopeWidth', 'envelopeHeight'] })
    expect(Math.max(...circles.filter((c) => c.applicable).map((c) => c.failed.length))).toBe(3)
  })

  it('global maximum over every section kind: 4 (the v2 sideways I-section), never 5', () => {
    expect(designChecksFailed(beamModel, sidewaysI.design, ch)).toEqual({ applicable: true, warnings: 0, failed: ['deflection', 'stress', 'mass', 'envelopeWidth'], status: 'notAccepted' })
    // Failing both envelope checks needs both outer dimensions above 80 mm. The bending inertia of
    // every allowed kind grows with each dimension and thickness, so the least stiff such sections
    // are these minimum-thickness 80.5 mm profiles (the next 0.5 mm step), in either orientation.
    const d = (section: Section, orientationDeg: 0 | 90): BeamDesign => ({ ...ch.initialDesign, id: 'min', section, orientationDeg })
    const weakest: Section[] = [
      { kind: 'circle', diameterM: 0.0805 },
      { kind: 'tube', outerDiameterM: 0.0805, innerDiameterM: 0.0805 - 2 * ch.sectionLimits.tube.minWallM },
      { kind: 'rectangle', widthM: 0.0805, heightM: 0.0805 },
      { kind: 'iSection', widthM: 0.0805, heightM: 0.0805, flangeThicknessM: 0.003, webThicknessM: 0.003 },
    ]
    for (const section of weakest) {
      for (const o of [0, 90] as const) {
        const f = designChecksFailed(beamModel, d(section, o), ch)
        expect(f.failed, `${section.kind} at ${o}°`).toEqual(expect.arrayContaining(['envelopeWidth', 'envelopeHeight']))
        expect(f.failed, `${section.kind} at ${o}°`).not.toContain('deflection')
      }
    }
  })

  it('keeps the I-section reference Accepted and reachable (change shape, then resize)', () => {
    expect(designChecksFailed(beamModel, beamReference.design, ch)).toMatchObject({ applicable: true, failed: [], status: 'accepted' })
    expect(ch.allowedSections).toContain(beamReference.design.section.kind)
    expect(beamReference.design.orientationDeg).toBe(ch.initialDesign.orientationDeg)
  })

  it('moves saves to a new key so a version 2 save is never re-scored', () => {
    expectStaleSaveIgnored(beamRuntime, ch, { ...ch, version: 2, initialDesign: { ...sidewaysI.design, id: 'baseline' } })
  })
})

describe('Torsion Shaft I baseline difficulty', () => {
  const ch = torsionChallenge()
  const base = designChecksFailed(torsionModel, ch.initialDesign, ch)
  const L = ch.sectionLimits

  // Version 3 (task 71, D-61, introductory): among the tied two-check designs, the baseline is the
  // solid that fails twist and mass, the pair a hollow section fixes, and of those the one furthest
  // from passing twist (the smallest solid over the mass limit), as for the beam (D-47 amendment).
  it('fails twist and mass, applicable and without warnings', () => {
    expect(base).toEqual({ applicable: true, warnings: 0, failed: ['twist', 'mass'], status: 'notAccepted' })
  })

  it('is the smallest solid on the grid that fails twist and mass', () => {
    const solids = grid(L.circle.diameterM.minM, L.circle.diameterM.maxM, L.circle.diameterM.stepM)
      .map((d) => ({ d, ...designChecksFailed(torsionModel, shaft('s', solid(d)), ch) }))
      .filter((r) => r.applicable && r.warnings === 0 && r.failed.join() === 'twist,mass')
    expect(solids[0]!.d).toBe(0.0305)
    expect(ch.initialDesign.section).toEqual(solid(solids[0]!.d))
  })

  it('no valid shaft on the step grid fails more design checks', () => {
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
    expectStaleSaveIgnored(torsionRuntime, ch, { ...ch, version: 2, initialDesign: { ...ch.initialDesign, section: solid(0.0265) } })
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

describe('Fatigue Analysis I baseline difficulty (task 70, D-47)', () => {
  const ch = fatigueChallenge()
  const L = ch.designLimits
  // Exhaustive walk of the configured grid through the registered model's pure functions. The
  // totals are the standalone script's (.kiro/specs/fatigue-analysis-1/design.md).
  const summary = (() => {
    let valid = 0
    let applicable = 0
    let accepted = 0
    let max = 0
    let atMax = 0
    for (const d of grid(L.neckDiameterM.minM, L.neckDiameterM.maxM, L.neckDiameterM.stepM))
      for (const D of grid(L.collarDiameterM.minM, L.collarDiameterM.maxM, L.collarDiameterM.stepM))
        for (const r of grid(L.filletRadiusM.minM, L.filletRadiusM.maxM, L.filletRadiusM.stepM))
          for (const finish of ch.allowedFinishes) {
            const design = spindle('g', d, D, r, finish)
            if (fatigueModel.validateDesign(design, ch).length > 0) continue
            valid++
            const res = designChecksFailed(fatigueModel, design, ch)
            if (!res.applicable) continue
            applicable++
            if (res.status === 'accepted') accepted++
            if (res.failed.length > max) {
              max = res.failed.length
              atMax = 0
            }
            if (res.failed.length === max) atMax++
          }
    return { valid, applicable, accepted, max, atMax }
  })()

  it('walks the same design space as the worksheet script', () => {
    expect(summary).toEqual({ valid: 111606, applicable: 106449, accepted: 270, max: 3, atMax: 14012 })
  })

  it('the Baseline fails the maximum (fatigue, yield, mass), applicable without warnings', () => {
    expect(designChecksFailed(fatigueModel, ch.initialDesign, ch)).toEqual({ applicable: true, warnings: 0, failed: ['fatigueSafetyFactor', 'yieldSafetyFactor', 'mass'], status: 'notAccepted' })
    expect(summary.max).toBe(3)
  })

  it('the reference is Accepted and no single change from the Baseline is', () => {
    expect(designChecksFailed(fatigueModel, ch.referenceDesign!, ch).status).toBe('accepted')
    const b = ch.initialDesign
    const singles = [
      ...grid(L.neckDiameterM.minM, L.neckDiameterM.maxM, L.neckDiameterM.stepM).map((v) => ({ ...b, neckDiameterM: v })),
      ...grid(L.collarDiameterM.minM, L.collarDiameterM.maxM, L.collarDiameterM.stepM).map((v) => ({ ...b, collarDiameterM: v })),
      ...grid(L.filletRadiusM.minM, L.filletRadiusM.maxM, L.filletRadiusM.stepM).map((v) => ({ ...b, filletRadiusM: v })),
      ...ch.allowedFinishes.map((f) => ({ ...b, surfaceFinish: f })),
    ].filter((d) => fatigueModel.validateDesign(d, ch).length === 0)
    expect(singles.length).toBeGreaterThan(50)
    for (const d of singles) expect(designChecksFailed(fatigueModel, d, ch).status).not.toBe('accepted')
  })
})

describe('Stress and Strain I baseline difficulty (task 72, D-62; SSR-14)', () => {
  const ch = axialChallenge()
  const base = designChecksFailed(axialModel, ch.initialDesign, ch)

  it('is steel Ø13 mm failing stress and mass, applicable and without warnings', () => {
    expect(ch.initialDesign).toMatchObject({ diameterM: 0.013, materialId: 'steel' })
    expect(base).toEqual({ applicable: true, warnings: 0, failed: ['stress', 'mass'], status: 'notAccepted' })
  })

  it('no valid rod on the 147-design grid fails more design checks without a warning; the steel ties fail stress and mass', () => {
    const rows = gridDesigns(ch).map((d) => ({ d, ...designChecksFailed(axialModel, d, ch) }))
    expect(rows).toHaveLength(147)
    expect(maxFailed(axialModel, ch, gridDesigns(ch))).toEqual({ max: 2, searched: 147 })
    const clean = rows.filter((r) => r.applicable && r.warnings === 0)
    expect(Math.max(...clean.map((r) => r.failed.length))).toBe(base.failed.length)
    const tied = clean.filter((r) => r.failed.length === base.failed.length)
    const label = (r: (typeof tied)[number]) => `${r.d.materialId} ${Math.round(r.d.diameterM * 1e4) / 10}`
    expect(tied.map(label)).toEqual([
      'steel 13', 'steel 13.5', 'steel 14',
      'aluminium 11', 'aluminium 11.5', 'aluminium 12', 'aluminium 12.5', 'aluminium 13', 'aluminium 13.5',
      'titanium 6.5', 'titanium 7', 'titanium 7.5',
    ])
    // The baseline is the smallest (furthest from passing stress) steel rod in the tie (design.md "Baseline choice").
    expect(tied.find((r) => r.d.materialId === 'steel')!.d.diameterM).toBe(ch.initialDesign.diameterM)
    // No rod fails stretch and mass together, with or without a warning.
    for (const r of rows) expect(r.failed.includes('elongation') && r.failed.includes('mass')).toBe(false)
  })

  it('needs both levers: no single-parameter change from the baseline is Accepted', () => {
    for (const d of gridDesigns(ch).filter((g) => g.materialId === ch.initialDesign.materialId || g.diameterM === ch.initialDesign.diameterM)) {
      expect(designChecksFailed(axialModel, d, ch).status).not.toBe('accepted')
    }
  })

  it('keeps the aluminium reference Accepted', () => {
    expect(designChecksFailed(axialModel, ch.referenceDesign!, ch)).toMatchObject({ applicable: true, failed: [], status: 'accepted' })
  })
})
