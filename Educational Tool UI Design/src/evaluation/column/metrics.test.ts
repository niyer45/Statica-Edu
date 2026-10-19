import { describe, expect, it } from 'vitest'
import { columnChallenge } from '../../../test/fixtures/column'
import { analyzeColumn } from '../../physics/column/analyze'
import type { ColumnAnalysis } from '../../physics/column/types'
import { COLUMN_COMPARISON_METRICS, COLUMN_PRIMARY_METRIC } from './metrics'

// Column prediction and comparison metrics (task 68; CBK-09, MM-13, MM-14).

const ch = columnChallenge()

describe('column metrics', () => {
  it('scores predictions on the critical buckling load', () => {
    expect(COLUMN_PRIMARY_METRIC.id).toBe('criticalLoadN')
    expect(COLUMN_PRIMARY_METRIC.label).toBe('critical buckling load')
    const a = analyzeColumn(ch.initialDesign, ch)
    expect(COLUMN_PRIMARY_METRIC.read(a)).toBe(a.criticalLoadN)
  })

  it('reads undefined for a stored value that is not finite and positive (not scorable)', () => {
    const a = analyzeColumn(ch.initialDesign, ch)
    for (const v of [Number.NaN, 0, -1, Infinity]) expect(COLUMN_PRIMARY_METRIC.read({ ...a, criticalLoadN: v } as ColumnAnalysis)).toBeUndefined()
  })

  it('compares stored values with digit-free labels', () => {
    expect(COLUMN_COMPARISON_METRICS[0]).toBe(COLUMN_PRIMARY_METRIC)
    for (const m of COLUMN_COMPARISON_METRICS) expect(m.label).not.toMatch(/\d/)
    expect(COLUMN_COMPARISON_METRICS.map((m) => m.id)).toContain('criticalLoadPerMassNPerKg')
  })
})
