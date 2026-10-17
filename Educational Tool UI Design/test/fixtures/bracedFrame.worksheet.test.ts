import { describe, expect, it } from 'vitest'
import type { BracedFrameChallenge } from '../../src/challenge/bracedFrame/types'
import { evaluateBracedFrame } from '../../src/evaluation/bracedFrame/evaluate'
import { BRACED_FRAME_PRIMARY_METRIC } from '../../src/evaluation/bracedFrame/metrics'
import { classifyRatio } from '../../src/evaluation/prediction'
import { FRAME_MEMBER_IDS, type FrameMemberId } from '../../src/geometry/bracedFrame/template'
import { validateBracedFrameDesign } from '../../src/geometry/bracedFrame/validate'
import { analyzeBracedFrame } from '../../src/physics/bracedFrame/analyze'
import { chsProperties, criticalSlenderness, eulerLoad } from '../../src/physics/bracedFrame/members'
import type { BracedFrameSolvedAnalysis } from '../../src/physics/bracedFrame/types'
import {
  BRACED_FRAME_UTILIZATION_ABS_TOL,
  BRACED_FRAME_WORKSHEET,
  bracedFrameChallenge,
  LAMBDA_C,
  LAMBDA_Y,
  MEMBER_LENGTH_M,
  PREDICTION_FIXTURES,
  relClose,
  SCREEN_FIXTURES,
  SECTION_TABLE,
  worksheetFixture,
  type BracedFrameFixture,
  type SectionShorthand,
} from './bracedFrame'

// BFR-15: every worksheet row of .kiro/specs/braced-frame-1/design.md. Displacements, drift,
// mass and ratios at 1e-9 relative; forces and reactions within 1e-9 × max|N| of the fixture;
// utilizations within 1e-9 absolute. Expected values are transcribed constants.

const ch = bracedFrameChallenge()

function run(f: BracedFrameFixture, c: BracedFrameChallenge = ch) {
  const analysis = analyzeBracedFrame(f.design, c)
  return { analysis, evaluation: evaluateBracedFrame(f.design, analysis, c) }
}

const expectRel = (actual: number, expected: number, what: string) =>
  expect(relClose(actual, expected), `${what}: ${actual} vs ${expected}`).toBe(true)

const solvedRows = BRACED_FRAME_WORKSHEET.filter((f) => f.expected.status === 'solved')
const mechanismRows = BRACED_FRAME_WORKSHEET.filter((f) => f.expected.status === 'mechanism')
const rows = (fs: readonly BracedFrameFixture[]) => fs.map((f) => [f.name, f] as const)

function solved(f: BracedFrameFixture, c: BracedFrameChallenge = ch): BracedFrameSolvedAnalysis {
  const { analysis } = run(f, c)
  if (analysis.status !== 'solved') throw new Error(`${f.name} did not solve`)
  return analysis
}

describe('Braced Frame I worksheet (BFR-15)', () => {
  it('covers all thirteen worksheet rows', () => {
    expect(BRACED_FRAME_WORKSHEET.map((f) => f.name)).toEqual([
      'baseline', 'reference', 'uniformS3Tension', 'bucklingBeam', 'lightLowerDiagonal', 'xBracedLight',
      'lowerXUpperSingle', 'mixedLight', 'bruteForce', 'upperUnbraced', 'unbraced', 'lowerXOnly', 'upperXOnly',
    ])
  })

  it('uses the worksheet constants E = 200 GPa, f_y = 250 MPa, ρ = 7850 kg/m³, b = 4 m, h = 3 m and the load case', () => {
    expect(ch.material).toMatchObject({ elasticModulusPa: 200e9, yieldStressPa: 250e6, densityKgM3: 7850 })
    expect(ch.frame).toEqual({ template: 'oneBayTwoStorey', bayWidthM: 4, storeyHeightM: 3 })
    expect(ch.loads).toEqual([
      { jointId: 'j3', fxN: 20000, fyN: 0 },
      { jointId: 'j5', fxN: 40000, fyN: -40000 },
      { jointId: 'j6', fxN: 0, fyN: -40000 },
    ])
    expect(ch.constraints).toEqual({ maxRoofDriftM: 0.012, maxUtilization: 1, maxMassKg: 200 })
  })

  it('the bundled initial and reference designs are the worksheet baseline and reference', () => {
    expect(run({ ...worksheetFixture('baseline'), design: ch.initialDesign }).analysis).toEqual(run(worksheetFixture('baseline')).analysis)
    expect(run({ ...worksheetFixture('reference'), design: ch.referenceDesign! }).analysis).toEqual(run(worksheetFixture('reference')).analysis)
  })

  it.each(rows(BRACED_FRAME_WORKSHEET))('%s is a valid design (validated before analysis)', (_n, f) => {
    expect(validateBracedFrameDesign(f.design, ch)).toEqual([])
  })

  it.each(rows(BRACED_FRAME_WORKSHEET))('%s has the worksheet status, mass, failures and applicability', (_n, f) => {
    const { analysis, evaluation } = run(f)
    expect(analysis.status).toBe(f.expected.status)
    expectRel(analysis.massKg, f.expected.massKg, 'mass')
    expect(evaluation.status).toBe(f.expected.evaluation)
    expect(evaluation.accepted).toBe(f.expected.evaluation === 'accepted')
    expect(evaluation.failures).toEqual(f.expected.failures)
    expect(analysis.warnings.map((w) => w.code)).toEqual(f.expected.warningCodes)
    expect(analysis.notApplicableReasons.map((w) => w.code)).toEqual(f.expected.notApplicableCodes)
    expect(analysis.applicable).toBe(f.expected.notApplicableCodes.length === 0)
  })

  it.each(rows(solvedRows))('%s matches drift, utilization, u_J and joint displacements at 1e-9 relative', (_n, f) => {
    const a = solved(f)
    const e = f.expected.solved!
    expectRel(a.roofDriftM, e.roofDriftM, 'roof drift')
    expectRel(a.floorDriftM, e.floorDriftM, 'floor-1 drift')
    expectRel(a.maxStoreyDriftRatio, e.maxStoreyDriftRatio, 'max storey drift ratio')
    expectRel(a.maxUtilization, e.maxUtilization, 'max u')
    expect(a.governingMemberId).toBe(e.governingMemberId)
    if (e.maxInelasticRatio === 'none') expect(Object.prototype.hasOwnProperty.call(a, 'maxInelasticRatio')).toBe(false)
    else expectRel(a.maxInelasticRatio as number, e.maxInelasticRatio, 'max u_J')
    const d = a.displacementsM
    const actual = [d.j3.x, d.j3.y, d.j4.x, d.j4.y, d.j5.x, d.j5.y, d.j6.x, d.j6.y]
    actual.forEach((v, i) => expectRel(v, e.displacementsM[i], `displacement ${i}`))
  })

  it.each(rows(solvedRows))('%s matches member forces and reactions within 1e-9 × max|N|', (_n, f) => {
    const a = solved(f)
    const e = f.expected.solved!
    const expectedIds = Object.keys(e.forcesN).sort()
    expect(Object.keys(a.members).sort()).toEqual(expectedIds)
    const scale = Math.max(...Object.values(e.forcesN).map(Math.abs))
    for (const id of expectedIds as FrameMemberId[]) {
      const actual = a.members[id]!.forceN
      expect(Math.abs(actual - (e.forcesN[id] as number)), `${id}: ${actual}`).toBeLessThanOrEqual(1e-9 * scale)
    }
    const r = a.reactionsN
    ;[r.j1.x, r.j1.y, r.j2.x, r.j2.y].forEach((v, i) => {
      expect(Math.abs(v - e.reactionsN[i]), `reaction ${i}: ${v}`).toBeLessThanOrEqual(1e-9 * scale)
    })
  })

  it.each(rows(solvedRows))('%s matches every member utilization within 1e-9 absolute', (_n, f) => {
    const a = solved(f)
    for (const [id, u] of Object.entries(f.expected.solved!.utilizations) as [FrameMemberId, number][]) {
      expect(Math.abs(a.members[id]!.utilization - u), `${id}`).toBeLessThanOrEqual(BRACED_FRAME_UTILIZATION_ABS_TOL)
    }
  })

  it('classifies the zero-force beam2 of baseline and mixedLight as ≈ 0 with utilization ≈ 0 (BFR-14)', () => {
    for (const name of ['baseline', 'mixedLight']) {
      const m = solved(worksheetFixture(name)).members.beam2!
      expect(m.sense).toBe('zero')
      expect(m.mode).toBe('tensionYield')
      expect(Math.abs(m.utilization)).toBeLessThanOrEqual(1e-9)
      expect(Object.is(m.forceN, -0)).toBe(false)
    }
  })

  it('Euler governs every compression member in this catalog (λ ≥ 100.96 > λ_y)', () => {
    expect(relClose(Math.PI * Math.sqrt(200e9 / 250e6), LAMBDA_Y)).toBe(true)
    for (const f of solvedRows) {
      for (const m of Object.values(solved(f).members)) {
        if (m!.sense === 'compression') expect(m!.mode).toBe('euler')
        expect(m!.slenderness).toBeGreaterThanOrEqual(100.95)
      }
    }
  })

  it.each(rows(mechanismRows))('%s stores no displacement, force, reaction, drift or utilization keys (MM-10)', (_n, f) => {
    const { analysis, evaluation } = run(f)
    expect(Object.keys(analysis).sort()).toEqual(
      ['modelId', 'modelVersion', 'applicable', 'warnings', 'notApplicableReasons', 'unsupportedEffects', 'assumptions', 'massKg', 'unbracedStoreys', 'status'].sort(),
    )
    expect(evaluation.constraints.map((c) => [c.id, c.passed])).toEqual([
      ['stability', false],
      ['mass', f.expected.failures.includes('mass') ? false : true],
      ['applicability', false],
    ])
    expect(Object.keys(evaluation.efficiency)).toEqual(['massUsage'])
    expect(JSON.stringify(analysis)).not.toMatch(/NaN|null|Infinity/)
  })
})

describe('section catalog (ideal annulus)', () => {
  it.each(Object.entries(SECTION_TABLE))('%s matches A, I, r, kg/m, A f_y, P_E and λ at 1e-9', (_k, row) => {
    const s = ch.sections.find((x) => x.id === row.id)!
    const p = chsProperties(s.outerDiameterM, s.wallM)
    expectRel(p.areaM2, row.areaM2, 'A')
    expectRel(p.secondMomentM4, row.secondMomentM4, 'I')
    expectRel(p.radiusOfGyrationM, row.radiusOfGyrationM, 'r')
    expectRel(p.areaM2 * 7850, row.kgPerM, 'kg/m')
    expectRel(p.areaM2 * 250e6, row.squashN, 'A f_y')
    ;[3, 4, 5].forEach((L, i) => {
      expectRel(eulerLoad(200e9, p.secondMomentM4, L), row.eulerN[i], `P_E ${L} m`)
      expectRel(L / p.radiusOfGyrationM, row.slenderness[i], `λ ${L} m`)
    })
  })

  it('λ_c = 125.66 and only CHS76.1x4.0 and CHS88.9x5.0 at 3 m fall below it', () => {
    expectRel(criticalSlenderness(200e9, 250e6), LAMBDA_C, 'λ_c')
    const below = (Object.keys(SECTION_TABLE) as unknown as SectionShorthand[]).flatMap((k) =>
      SECTION_TABLE[k].slenderness.flatMap((lam, i) => (lam < LAMBDA_C ? [`${k}@${[3, 4, 5][i]}`] : [])),
    )
    expect(below).toEqual(['76@3', '89@3'])
  })

  it('member lengths follow the template (columns 3 m, beams 4 m, diagonals 5 m)', () => {
    const a = solved(worksheetFixture('bruteForce'))
    for (const id of FRAME_MEMBER_IDS) {
      expectRel(a.members[id]!.slenderness, SECTION_TABLE[89].slenderness[MEMBER_LENGTH_M[id] - 3], id)
    }
  })
})

describe('reactions (global moment equilibrium fixes the vertical split)', () => {
  it('R_j2y = (20·3 + 40·6 + 40·4)/4 kN and R_j1y = 80 kN − R_j2y for every solved fixture', () => {
    const r2y = ((20 * 3 + 40 * 6 + 40 * 4) / 4) * 1000
    expect(r2y).toBe(115000)
    for (const f of solvedRows) {
      const r = solved(f).reactionsN
      expectRel(r.j2.y, r2y, `${f.name} R_j2y`)
      expectRel(r.j1.y, 80000 - r2y, `${f.name} R_j1y`)
    }
  })
})

describe('screen fixtures (test-only constructed configs)', () => {
  const scaledLoads = (k: number): BracedFrameChallenge => ({ ...ch, loads: ch.loads.map((l) => ({ ...l, fxN: l.fxN * k, fyN: l.fyN * k })) })
  const withE = (E: number): BracedFrameChallenge => ({ ...ch, material: { ...ch.material, elasticModulusPa: E } })

  it('mixedLight with loads × 1.12 is modelNotApplicable (INELASTIC_BUCKLING) although every constraint passes', () => {
    const fx = SCREEN_FIXTURES.mixedLightLoads112
    const c = scaledLoads(fx.loadFactor)
    const { analysis, evaluation } = run(worksheetFixture('mixedLight'), c)
    if (analysis.status !== 'solved') throw new Error('expected solved')
    expectRel(analysis.maxUtilization, fx.maxUtilization, 'max u')
    expect(analysis.governingMemberId).toBe(fx.governingMemberId)
    expectRel(analysis.maxInelasticRatio as number, fx.maxInelasticRatio, 'u_J')
    expectRel(analysis.roofDriftM, fx.roofDriftM, 'roof drift')
    expectRel(analysis.massKg, worksheetFixture('mixedLight').expected.massKg, 'mass unchanged')
    expect(analysis.notApplicableReasons.map((i) => i.code)).toEqual(['INELASTIC_BUCKLING'])
    expect(evaluation.status).toBe('modelNotApplicable')
    expect(evaluation.failures).toEqual(['applicability'])
  })

  it('uniformS3Tension with loads × 1.12 is modelNotApplicable and also fails mass', () => {
    const fx = SCREEN_FIXTURES.uniformLoads112
    const { analysis, evaluation } = run(worksheetFixture('uniformS3Tension'), scaledLoads(fx.loadFactor))
    if (analysis.status !== 'solved') throw new Error('expected solved')
    expectRel(analysis.maxInelasticRatio as number, fx.maxInelasticRatio, 'u_J')
    expect(evaluation.status).toBe('modelNotApplicable')
    expect(evaluation.failures).toEqual(['mass', 'applicability'])
  })

  it('baseline with E = 20 GPa warns LARGE_DRIFT; with E = 10 GPa it is not applicable', () => {
    const warn = solved(worksheetFixture('baseline'), withE(SCREEN_FIXTURES.baselineE20.elasticModulusPa))
    expectRel(warn.maxStoreyDriftRatio, SCREEN_FIXTURES.baselineE20.maxStoreyDriftRatio, 'θ E20')
    expect(warn.warnings.map((i) => i.code)).toEqual(['LARGE_DRIFT'])
    expect(warn.applicable).toBe(true)
    const na = run(worksheetFixture('baseline'), withE(SCREEN_FIXTURES.baselineE10.elasticModulusPa))
    if (na.analysis.status !== 'solved') throw new Error('expected solved')
    expectRel(na.analysis.maxStoreyDriftRatio, SCREEN_FIXTURES.baselineE10.maxStoreyDriftRatio, 'θ E10')
    expect(na.analysis.notApplicableReasons.map((i) => i.code)).toEqual(['LARGE_DRIFT'])
    expect(na.evaluation.status).toBe('modelNotApplicable')
  })
})

describe('prediction fixtures (|roof drift| ratio, band 0.98/1.02)', () => {
  it.each(PREDICTION_FIXTURES.map((p) => [`${p.prev} → ${p.next}`, p] as const))('%s', (_n, p) => {
    const prev = BRACED_FRAME_PRIMARY_METRIC.read(run(worksheetFixture(p.prev)).analysis) as number
    const next = BRACED_FRAME_PRIMARY_METRIC.read(run(worksheetFixture(p.next)).analysis) as number
    expectRel(next / prev, p.ratio, 'ratio')
    expect(classifyRatio(next / prev)).toBe(p.actual)
  })

  it('reference → upperUnbraced and back are not scorable: the mechanism has no roof drift', () => {
    expect(BRACED_FRAME_PRIMARY_METRIC.read(run(worksheetFixture('upperUnbraced')).analysis)).toBeUndefined()
  })
})
