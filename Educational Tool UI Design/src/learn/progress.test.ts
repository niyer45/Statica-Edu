import { describe, expect, it } from 'vitest'
import { beamBending } from './modules/beamBending'
import { commitPrediction, learnKey, moduleStatus, readProgress, writeProgress, type LearnStorage } from './progress'

// Task 67 (LRN-03, LRN-07): Learn progress is saved per module version, committed predictions are
// final, and unknown or corrupt data is ignored.

function memory(): LearnStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }
}

describe('Learn progress', () => {
  it('uses a versioned ei:learn key', () => {
    expect(learnKey(beamBending)).toBe('ei:learn:beam-bending:v1')
  })

  it('round-trips committed predictions and reports the next step', () => {
    const storage = memory()
    let p = readProgress(storage, beamBending)
    expect(moduleStatus(beamBending, p)).toEqual({ completed: 0, total: 5, done: false, nextStep: 0 })
    p = commitPrediction(beamBending, p, 'load', 'same') // a wrong prediction still completes the step
    p = commitPrediction(beamBending, p, 'length', 'x8')
    expect(writeProgress(storage, beamBending, p)).toBe(true)
    expect(readProgress(storage, beamBending)).toEqual({ load: 'same', length: 'x8' })
    expect(moduleStatus(beamBending, p)).toEqual({ completed: 2, total: 5, done: false, nextStep: 2 })
    for (const s of beamBending.steps) p = commitPrediction(beamBending, p, s.id, s.question.answerId)
    expect(moduleStatus(beamBending, p)).toEqual({ completed: 5, total: 5, done: true, nextStep: 5 })
  })

  it('keeps a committed prediction and ignores unknown steps or options', () => {
    const p = commitPrediction(beamBending, {}, 'load', 'double')
    expect(commitPrediction(beamBending, p, 'load', 'half')).toBe(p)
    expect(commitPrediction(beamBending, p, 'nope', 'double')).toEqual(p)
    expect(commitPrediction(beamBending, p, 'length', 'nope')).toEqual(p)
  })

  it('ignores corrupt, foreign or partly unknown saved data', () => {
    const storage = memory()
    const key = learnKey(beamBending)
    storage.map.set(key, '{not json')
    expect(readProgress(storage, beamBending)).toEqual({})
    storage.map.set(key, JSON.stringify({ schemaVersion: 2, answers: { load: 'double' } }))
    expect(readProgress(storage, beamBending)).toEqual({})
    storage.map.set(key, JSON.stringify({ schemaVersion: 1, answers: { load: 'double', length: 'x99', ghost: 'x8' } }))
    expect(readProgress(storage, beamBending)).toEqual({ load: 'double' })
  })

  it('survives storage that throws', () => {
    const broken: LearnStorage = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('quota') } }
    expect(readProgress(broken, beamBending)).toEqual({})
    expect(writeProgress(broken, beamBending, { load: 'double' })).toBe(false)
  })
})
