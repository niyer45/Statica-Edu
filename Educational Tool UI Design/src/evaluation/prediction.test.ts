import { describe, expect, it } from 'vitest'
import { SAME_BAND_HIGH, SAME_BAND_LOW, classifyRatio, scorePrediction } from './prediction'
import type { Prediction, PredictionDirection, TestResult } from './types'

// Only `analysis.tipDeflectionM` is read from `prev`.
const prevWith = (tipDeflectionM: number): TestResult =>
  ({ analysis: { tipDeflectionM } }) as unknown as TestResult

const predict = (direction: PredictionDirection): Prediction => ({
  iteration: 1,
  direction,
  createdAt: '2024-01-01T00:00:00.000Z',
})

describe('scorePrediction (smoke)', () => {
  it('exports the same-band thresholds', () => {
    expect(SAME_BAND_LOW).toBe(0.98)
    expect(SAME_BAND_HIGH).toBe(1.02)
  })

  it('classifies a halved deflection as decrease and matches', () => {
    const out = scorePrediction(predict('decrease'), prevWith(0.02), { tipDeflectionM: 0.01 })
    expect(out).toEqual({ predicted: 'decrease', actual: 'decrease', ratio: 0.5, matched: true })
    expect(Object.isFrozen(out)).toBe(true)
  })

  it('classifies a doubled deflection as increase; wrong prediction does not match', () => {
    const out = scorePrediction(predict('same'), prevWith(0.01), { tipDeflectionM: 0.02 })
    expect(out).toMatchObject({ predicted: 'same', actual: 'increase', ratio: 2, matched: false })
  })

  it('treats an unchanged deflection as same', () => {
    const out = scorePrediction(predict('same'), prevWith(0.01), { tipDeflectionM: 0.01 })
    expect(out).toMatchObject({ actual: 'same', ratio: 1, matched: true })
  })

  it('treats a NaN ratio as same with matched false', () => {
    expect(classifyRatio(Number.NaN)).toBe('same')
    const out = scorePrediction(predict('same'), prevWith(0), { tipDeflectionM: 0 })
    expect(out.actual).toBe('same')
    expect(out.matched).toBe(false)
  })
})
