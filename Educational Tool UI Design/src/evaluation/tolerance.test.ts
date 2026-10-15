import { describe, expect, it } from 'vitest'
import * as physicsTolerance from '../physics/tolerance'
import { REL_TOL, withinLimit } from './tolerance'

describe('evaluation/tolerance', () => {
  it('re-exports REL_TOL and withinLimit from physics/ unchanged', () => {
    expect(withinLimit).toBe(physicsTolerance.withinLimit)
    expect(REL_TOL).toBe(physicsTolerance.REL_TOL)
  })
})
