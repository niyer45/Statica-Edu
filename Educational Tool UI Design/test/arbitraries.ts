import fc from 'fast-check'
import { bundledChallengeResult } from '../src/challenge/content'
import type { Challenge, SectionKind, SectionLimits } from '../src/challenge/types'
import type { BeamDesign, Orientation, Section } from '../src/geometry/sections'

// Shared fast-check arbitraries (task 5.3, Req 33.1, 33.2).
//
// "Valid" arbitraries are valid by construction (Req 5 rules), not by filtering through the
// validator, so the validator can be tested against them. Bounds are inclusive and fast-check
// biases toward them, so range edges, minimum walls/thicknesses, d = 0, and tw = b all appear.

export const SECTION_KINDS: readonly SectionKind[] = ['circle', 'tube', 'rectangle', 'iSection']

/** Parameter names per section kind, in the validator's fixed order. */
export const SECTION_PARAMS = {
  circle: ['diameterM'],
  tube: ['outerDiameterM', 'innerDiameterM'],
  rectangle: ['widthM', 'heightM'],
  iSection: ['widthM', 'heightM', 'flangeThicknessM', 'webThicknessM'],
} as const satisfies Record<SectionKind, readonly string[]>

export type SectionOfKind<K extends SectionKind> = Extract<Section, { kind: K }>
export type ParamOf<K extends SectionKind> = (typeof SECTION_PARAMS)[K][number]

/** Margin used to step clearly past a rule boundary (well above GEOM_TOL and float noise). */
const VIOLATION_MARGIN = 1e-6

/** The bundled challenge, or a thrown error if it fails to load (tests cannot proceed without it). */
export function bundledChallenge(): Challenge {
  if (!bundledChallengeResult.ok) {
    throw new Error(`bundled challenge failed to load: ${JSON.stringify(bundledChallengeResult.error)}`)
  }
  return bundledChallengeResult.value
}

/** Finite double in [lo, hi] (inclusive). Throws if the interval is empty (infeasible limits). */
function between(lo: number, hi: number): fc.Arbitrary<number> {
  if (!(Number.isFinite(lo) && Number.isFinite(hi) && lo <= hi)) {
    throw new Error(`infeasible range [${lo}, ${hi}]`)
  }
  return fc.double({ min: lo, max: hi, noNaN: true, noDefaultInfinity: true })
}

export const arbOrientation: fc.Arbitrary<Orientation> = fc.constantFrom<Orientation>(0, 90)

export const arbAnyKind: fc.Arbitrary<SectionKind> = fc.constantFrom(...SECTION_KINDS)

/** A section kind allowed by the challenge. */
export function arbKind(ch: Challenge): fc.Arbitrary<SectionKind> {
  return fc.constantFrom(...ch.allowedSections)
}

/** Arbitrary over the parameter names of a section kind. */
export function arbParamFor<K extends SectionKind>(kind: K): fc.Arbitrary<ParamOf<K>> {
  return fc.constantFrom(...(SECTION_PARAMS[kind] as readonly ParamOf<K>[]))
}

// ---------------------------------------------------------------------------
// Valid sections (valid by construction)
// ---------------------------------------------------------------------------

function arbValidCircle(limits: SectionLimits): fc.Arbitrary<SectionOfKind<'circle'>> {
  const r = limits.circle.diameterM
  return between(r.minM, r.maxM).map((diameterM) => ({ kind: 'circle', diameterM }))
}

function arbValidTube(limits: SectionLimits): fc.Arbitrary<SectionOfKind<'tube'>> {
  const { outerDiameterM: r, minWallM } = limits.tube
  // d = 0 needs wall D/2 ≥ minWall, so D ≥ 2·minWall for every valid tube.
  return between(Math.max(r.minM, 2 * minWallM), r.maxM).chain((D) => {
    // d ∈ [0, D − 2·minWall] gives wall ∈ [minWall, D/2]. Clamp so rounding cannot push the
    // wall below minWall by more than float noise (the validator allows GEOM_TOL).
    const dMax = Math.max(0, D - 2 * minWallM)
    const arbD = dMax > 0 ? fc.oneof(fc.constant(0), between(0, dMax)) : fc.constant(0)
    return arbD.map((d) => {
      const innerDiameterM = Math.min(d, dMax)
      return { kind: 'tube' as const, outerDiameterM: D, innerDiameterM }
    })
  })
}

function arbValidRectangle(limits: SectionLimits): fc.Arbitrary<SectionOfKind<'rectangle'>> {
  const { widthM, heightM } = limits.rectangle
  return fc
    .tuple(between(widthM.minM, widthM.maxM), between(heightM.minM, heightM.maxM))
    .map(([w, h]) => ({ kind: 'rectangle', widthM: w, heightM: h }))
}

function arbValidISection(limits: SectionLimits): fc.Arbitrary<SectionOfKind<'iSection'>> {
  const lim = limits.iSection
  const minTf = lim.minFlangeThicknessM
  const minTw = lim.minWebThicknessM
  const minClear = lim.minClearWebHeightM
  // b ≥ minTw (so tw ∈ [minTw, b] is non-empty); h ≥ 2·minTf + minClear (so tf range is non-empty).
  const arbB = between(Math.max(lim.widthM.minM, minTw), lim.widthM.maxM)
  const arbH = between(Math.max(lim.heightM.minM, 2 * minTf + minClear), lim.heightM.maxM)
  return fc.tuple(arbB, arbH).chain(([b, h]) => {
    const tfMax = Math.max(minTf, (h - minClear) / 2)
    return fc.tuple(between(minTf, tfMax), between(minTw, b)).map(([tf, tw]) => ({
      kind: 'iSection' as const,
      widthM: b,
      heightM: h,
      flangeThicknessM: Math.min(tf, tfMax),
      webThicknessM: Math.min(tw, b),
    }))
  })
}

/** A valid section of the given kind under `limits`. */
export function arbSectionOfKind<K extends SectionKind>(
  kind: K,
  limits: SectionLimits,
): fc.Arbitrary<SectionOfKind<K>> {
  const byKind: { [P in SectionKind]: () => fc.Arbitrary<SectionOfKind<P>> } = {
    circle: () => arbValidCircle(limits),
    tube: () => arbValidTube(limits),
    rectangle: () => arbValidRectangle(limits),
    iSection: () => arbValidISection(limits),
  }
  return byKind[kind]() as fc.Arbitrary<SectionOfKind<K>>
}

/** A valid section of any kind (optionally restricted to `kinds`). validateSection returns []. */
export function arbValidSection(
  limits: SectionLimits,
  kinds: readonly SectionKind[] = SECTION_KINDS,
): fc.Arbitrary<Section> {
  return fc.oneof(...kinds.map((k) => arbSectionOfKind(k, limits) as fc.Arbitrary<Section>))
}

// ---------------------------------------------------------------------------
// Designs
// ---------------------------------------------------------------------------

export interface DesignOverrides {
  kinds?: readonly SectionKind[]
  orientation?: Orientation
  id?: string
}

/**
 * A design valid for `ch`, with optional restrictions. Kind is from `ch.allowedSections`
 * (intersected with `overrides.kinds`); length and material equal ch.initialDesign's.
 */
export function arbDesignWith(ch: Challenge, overrides: DesignOverrides = {}): fc.Arbitrary<BeamDesign> {
  const only = overrides.kinds
  const kinds = only ? ch.allowedSections.filter((k) => only.includes(k)) : ch.allowedSections
  if (kinds.length === 0) throw new Error('arbDesignWith: no allowed section kinds')
  return fc
    .record({
      id: overrides.id !== undefined ? fc.constant(overrides.id) : fc.string({ minLength: 1, maxLength: 12 }),
      section: arbValidSection(ch.sectionLimits, kinds),
      orientationDeg: overrides.orientation !== undefined ? fc.constant(overrides.orientation) : arbOrientation,
    })
    .map(({ id, section, orientationDeg }) => ({
      id,
      section,
      orientationDeg,
      lengthM: ch.initialDesign.lengthM,
      materialId: ch.initialDesign.materialId,
    }))
}

/** A design valid for `ch` by construction. validateDesign returns []. */
export function arbDesign(ch: Challenge): fc.Arbitrary<BeamDesign> {
  return arbDesignWith(ch)
}

// ---------------------------------------------------------------------------
// Hostile numbers and invalid sections
// ---------------------------------------------------------------------------

/** Special values every numeric boundary should survive. */
export const HOSTILE_SPECIALS: readonly number[] = [
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  -0,
  0,
  1e308,
  5e-324,
]

/** NaN, ±Infinity, −0, 0, negatives, 1e308, 5e-324 (plus Number.MAX_VALUE). */
export const arbHostileNumber: fc.Arbitrary<number> = fc.oneof(
  { arbitrary: fc.constantFrom(...HOSTILE_SPECIALS, Number.MAX_VALUE), weight: 3 },
  { arbitrary: fc.double({ max: -Number.MIN_VALUE, noNaN: true }), weight: 1 },
)

/** Hostile values that are invalid for `param` (0 and tiny positives are valid tube inner diameters). */
function arbHostileInvalidFor(param: string, outerDiameterM?: number): fc.Arbitrary<number> {
  if (param !== 'innerDiameterM') return arbHostileNumber
  const D = outerDiameterM ?? Number.POSITIVE_INFINITY
  return arbHostileNumber.filter((v) => !(Number.isFinite(v) && v >= 0 && v < D))
}

/** A valid section with one parameter replaced by a hostile number. */
function arbWithHostileParam(limits: SectionLimits): fc.Arbitrary<Section> {
  return arbAnyKind.chain((kind) =>
    fc.tuple(arbSectionOfKind(kind, limits), arbParamFor(kind)).chain(([s, param]) => {
      const D = s.kind === 'tube' ? s.outerDiameterM : undefined
      return arbHostileInvalidFor(param, D).map((v) => ({ ...s, [param]: v }) as Section)
    }),
  )
}

/** A valid section with one ranged parameter pushed outside its range (still finite, positive). */
function arbOutOfRange(limits: SectionLimits): fc.Arbitrary<Section> {
  const ranged: { kind: SectionKind; param: string; min: number; max: number }[] = [
    { kind: 'circle', param: 'diameterM', ...rangeOf(limits.circle.diameterM) },
    { kind: 'tube', param: 'outerDiameterM', ...rangeOf(limits.tube.outerDiameterM) },
    { kind: 'rectangle', param: 'widthM', ...rangeOf(limits.rectangle.widthM) },
    { kind: 'rectangle', param: 'heightM', ...rangeOf(limits.rectangle.heightM) },
    { kind: 'iSection', param: 'widthM', ...rangeOf(limits.iSection.widthM) },
    { kind: 'iSection', param: 'heightM', ...rangeOf(limits.iSection.heightM) },
  ]
  return fc.constantFrom(...ranged).chain(({ kind, param, min, max }) => {
    const above = between(max + VIOLATION_MARGIN, max * 10 + 1)
    const arbV = min > 2 * VIOLATION_MARGIN ? fc.oneof(above, between(Number.MIN_VALUE, min - VIOLATION_MARGIN)) : above
    return fc.tuple(arbSectionOfKind(kind, limits), arbV).map(([s, v]) => ({ ...s, [param]: v }) as Section)
  })
}

function rangeOf(r: { minM: number; maxM: number }): { min: number; max: number } {
  return { min: r.minM, max: r.maxM }
}

/** Tube with d ≥ D, or with a wall thinner than minWall. */
function arbBadTube(limits: SectionLimits): fc.Arbitrary<Section> {
  const minWall = limits.tube.minWallM
  return arbValidTube(limits).chain((s) => {
    const D = s.outerDiameterM
    const innerTooBig = between(D, 2 * D)
    const wallTooThin = between(VIOLATION_MARGIN, minWall - 2 * VIOLATION_MARGIN).map((w) => D - 2 * w)
    return fc.oneof(innerTooBig, wallTooThin).map((d) => ({ ...s, innerDiameterM: d }))
  })
}

/** I-section with h − 2·tf below the minimum clear web (h ≤ 2tf + small), or tw > b. */
function arbBadISection(limits: SectionLimits): fc.Arbitrary<Section> {
  const minClear = limits.iSection.minClearWebHeightM
  return arbValidISection(limits).chain((s) => {
    const flangesOverlap = between(VIOLATION_MARGIN, s.heightM).map((delta) => ({
      ...s,
      flangeThicknessM: (s.heightM - minClear) / 2 + delta,
    }))
    const webTooWide = between(VIOLATION_MARGIN, s.widthM).map((delta) => ({
      ...s,
      webThicknessM: s.widthM + delta,
    }))
    return fc.oneof(flangesOverlap, webTooWide)
  })
}

/** A section violating at least one Req 5 rule under `limits`. validateSection returns ≥ 1 error. */
export function arbInvalidSection(limits: SectionLimits): fc.Arbitrary<Section> {
  return fc.oneof(
    arbWithHostileParam(limits),
    arbOutOfRange(limits),
    arbBadTube(limits),
    arbBadISection(limits),
  )
}

/** Any finite-or-hostile number: ordinary doubles mixed with hostile values. */
export const arbAnyNumber: fc.Arbitrary<number> = fc.oneof(
  arbHostileNumber,
  fc.double(),
  fc.double({ min: 0, max: 1, noNaN: true }),
)

/** Any structurally-typed section: valid, invalid, or with arbitrary numbers in every field. */
export function arbAnySection(limits: SectionLimits): fc.Arbitrary<Section> {
  const wild = arbAnyKind.chain((kind) =>
    fc
      .tuple(...SECTION_PARAMS[kind].map(() => arbAnyNumber))
      .map((values) => {
        const s: Record<string, unknown> = { kind }
        SECTION_PARAMS[kind].forEach((p, i) => (s[p] = values[i]))
        return s as unknown as Section
      }),
  )
  return fc.oneof(arbValidSection(limits), arbInvalidSection(limits), wild)
}

// ---------------------------------------------------------------------------
// Untrusted JSON-ish input (import / persistence totality)
// ---------------------------------------------------------------------------

export const POLLUTION_KEYS = ['__proto__', 'constructor', 'prototype'] as const

/** Object parsed from JSON text with an own prototype-pollution key (as JSON.parse produces it). */
const arbPollutedObject: fc.Arbitrary<unknown> = fc
  .tuple(fc.constantFrom(...POLLUTION_KEYS), fc.jsonValue({ maxDepth: 2 }), fc.dictionary(fc.string(), fc.jsonValue({ maxDepth: 1 }), { maxKeys: 3 }))
  .map(([key, value, rest]) => {
    const body = JSON.stringify(rest).slice(1, -1)
    return JSON.parse(`{${JSON.stringify(key)}:${JSON.stringify(value) ?? 'null'}${body ? ',' + body : ''}}`) as unknown
  })

/** Arbitrary untrusted input: JSON values, arbitrary JS values, and prototype-pollution shapes. */
export const arbAnyJson: fc.Arbitrary<unknown> = fc.oneof(
  fc.jsonValue({ maxDepth: 3 }),
  fc.anything({
    maxDepth: 3,
    key: fc.oneof(fc.string(), fc.constantFrom(...POLLUTION_KEYS)),
    withNullPrototype: true,
  }),
  arbPollutedObject,
)
