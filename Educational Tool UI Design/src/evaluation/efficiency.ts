import type { Challenge } from '../challenge/types'
import type { Analysis } from '../physics/types'
import type { Efficiency } from './types'

/**
 * Efficiency indicators (Req 12.5), unclamped: massUsage > 1 or a negative margin means
 * that limit was exceeded. Non-finite inputs propagate as non-finite outputs.
 */
export function efficiency(a: Analysis, ch: Challenge): Efficiency {
  const k = ch.constraints
  return {
    massUsage: a.massKg / k.maxMassKg,
    deflectionMargin: 1 - a.tipDeflectionM / k.maxDeflectionM,
    stressMargin: 1 - a.nominalMaxStressPa / k.maxStressPa,
  }
}
