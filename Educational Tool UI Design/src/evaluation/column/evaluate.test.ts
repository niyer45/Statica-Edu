import { describe, expect, it } from 'vitest'
import { column, columnChallenge, tube, worksheetRow } from '../../../test/fixtures/column'
import type { ColumnChallenge } from '../../challenge/column/types'
import { analyzeColumn } from '../../physics/column/analyze'
import type { ColumnAnalysis } from '../../physics/column/types'
import { REL_TOL } from '../tolerance'
import { COLUMN_CONSTRAINT_LABELS, COLUMN_CONSTRAINT_ORDER, evaluateColumnConstraints, requiredCriticalLoadN } from './constraints'
import { evaluateColumn } from './evaluate'

// Column evaluation (task 68; CBK-07, MM-11).

const ch = columnChallenge()
const tested = (name: string) => {
  const d = worksheetRow(name).design
  const a = analyzeColumn(d, ch)
  return { a, e: evaluateColumn(d, a, ch) }
}

describe('evaluateColumn', () => {
  it('reports four constraints in a fixed order with digit-free labels', () => {
    const { e } = tested('baseline')
    expect(e.constraints.map((c) => c.id)).toEqual(['buckling', 'axialStress', 'mass', 'applicability'])
    expect(COLUMN_CONSTRAINT_ORDER).toEqual(e.constraints.map((c) => c.id))
    for (const label of Object.values(COLUMN_CONSTRAINT_LABELS)) expect(label).not.toMatch(/\d/)
  })

  it('the baseline fails buckling and mass; its buckling check is a minimum of twice the load', () => {
    const { a, e } = tested('baseline')
    expect(e.status).toBe('notAccepted')
    expect(e.failures).toEqual(['buckling', 'mass'])
    const b = e.constraints[0]!
    expect(b).toMatchObject({ id: 'buckling', sense: 'min', unit: 'N', limit: 20000, value: a.criticalLoadN, passed: false })
    expect(b.utilization).toBeCloseTo(20000 / a.criticalLoadN, 12)
    expect(e.constraints[1]).toMatchObject({ id: 'axialStress', sense: 'max', unit: 'Pa', limit: 120e6, passed: true })
    expect(requiredCriticalLoadN(ch)).toBe(20000)
  })

  it('accepts the reference, with unclamped margins', () => {
    const { a, e } = tested('reference')
    expect(e).toMatchObject({ status: 'accepted', accepted: true, failures: [] })
    expect(e.efficiency.massUsage).toBeCloseTo(a.massKg / 2.5, 12)
    expect(e.efficiency.bucklingMargin).toBeCloseTo(1 - 20000 / a.criticalLoadN, 12)
    expect(e.efficiency.stressMargin).toBeCloseTo(1 - a.axialStressPa / 120e6, 12)
  })

  it('never accepts a not-applicable design, and warnings never affect acceptance', () => {
    expect(tested('eulerNotApplicable').e).toMatchObject({ status: 'modelNotApplicable', accepted: false })
    expect(tested('eulerWarning').e).toMatchObject({ status: 'accepted', accepted: true })
  })

  it('the buckling minimum passes exactly at the limit (within REL_TOL) and fails just below', () => {
    const d = column('r', tube(0.06, 0.002))
    const a = analyzeColumn(d, ch)
    const atLimit = { ...ch, constraints: { ...ch.constraints, minBucklingSafetyFactor: a.criticalLoadN / ch.load.forceN } } as ColumnChallenge
    expect(evaluateColumn(d, a, atLimit).constraints[0]!.passed).toBe(true)
    const beyond = { ...ch, constraints: { ...ch.constraints, minBucklingSafetyFactor: (a.criticalLoadN / ch.load.forceN) * (1 + 10 * REL_TOL) } } as ColumnChallenge
    expect(evaluateColumn(d, a, beyond).constraints[0]!.passed).toBe(false)
  })

  it('fails every numeric check for non-finite values without throwing', () => {
    const a = analyzeColumn(column('r', tube(0.06, 0.002)), ch)
    const broken = { ...a, criticalLoadN: Number.NaN, axialStressPa: Infinity, massKg: Number.NaN } as ColumnAnalysis
    const c = evaluateColumnConstraints(broken, ch)
    expect(c.map((x) => x.passed)).toEqual([false, false, false, true])
  })

  it('is deep-frozen and includes the model-limits fact last', () => {
    const { e } = tested('reference')
    expect(Object.isFrozen(e)).toBe(true)
    expect(e.facts.at(-1)!.id).toBe('model.idealizedColumn')
  })
})
