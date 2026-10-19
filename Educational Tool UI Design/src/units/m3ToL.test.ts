import { describe, expect, it } from 'vitest'
import { m3ToL } from './units'

// Task 69: litres for displaying stored Pressure Vessel I volumes.
describe('m3ToL', () => {
  it('converts cubic metres to litres', () => {
    expect(m3ToL(0.1)).toBe(100)
    expect(m3ToL(0)).toBe(0)
    expect(m3ToL(0.0615249505279025)).toBeCloseTo(61.5249505279025, 12)
  })
})
