import { describe, expect, it, vi } from 'vitest'
import { projectToAxis, parameterDeltaScale, createFrameQueue, dragLimit } from './handleDrag'

describe('handle projection (16.2)', () => {
  it('projects a perpendicular ray to the editing axis in metres', () => {
    expect(projectToAxis([1, 0.03, 2], [0, 0, -1], [1, 0, 0], [0, 1, 0])).toBeCloseTo(0.03, 12)
    expect(projectToAxis([1, 2, -0.02], [0, -1, 0], [1, 0, 0], [0, 0, 1])).toBeCloseTo(-0.02, 12)
  })
  it('handles oblique and unnormalized rays/axes', () => {
    expect(projectToAxis([0, 0.04, 2], [0.3, 0, -2], [0, 0, 0], [0, 2, 0])).toBeCloseTo(0.04, 12)
  })
  it('skips non-finite, degenerate, and parallel projections', () => {
    expect(projectToAxis([NaN, 0, 0], [0, 0, -1], [0, 0, 0], [0, 1, 0])).toBeNull()
    expect(projectToAxis([0, 0, 0], [0, Infinity, -1], [0, 0, 0], [0, 1, 0])).toBeNull()
    expect(projectToAxis([0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0])).toBeNull()
    expect(projectToAxis([0, 0, 0], [0, 1, 0], [0, 0, 0], [0, 1, 0])).toBeNull()
  })
  it('maps handle motion to full dimensions at either orientation, including inward flange motion', () => {
    expect(parameterDeltaScale('diameterM', 0)).toBe(2)
    expect(parameterDeltaScale('outerDiameterM', 90)).toBe(2)
    expect(parameterDeltaScale('widthM', 90)).toBe(2)
    expect(parameterDeltaScale('heightM', 90)).toBe(-2)
    expect(parameterDeltaScale('flangeThicknessM', 0)).toBe(-1)
    expect(parameterDeltaScale('flangeThicknessM', 90)).toBe(1)
    expect(parameterDeltaScale('webThicknessM', 0)).toBe(2)
  })
})

describe('frame throttle and limit feedback (16.2)', () => {
  function setup() {
    const frames = new Map<number, FrameRequestCallback>()
    let next = 0
    const apply = vi.fn()
    const queue = createFrameQueue<number>(apply, (callback) => { frames.set(++next, callback); return next }, (id) => { frames.delete(id) })
    const tick = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((f) => f(0)) }
    return { queue, apply, frames, tick }
  }
  it('applies once per frame with the most recent value', () => {
    const { queue, apply, frames, tick } = setup()
    queue.push(0.02); queue.push(0.03); queue.push(0.04)
    expect(frames.size).toBe(1)
    expect(apply).not.toHaveBeenCalled()
    tick()
    expect(apply.mock.calls).toEqual([[0.04]])
    queue.push(0.05); tick()
    expect(apply.mock.calls).toEqual([[0.04], [0.05]])
  })
  it('discards pending motion on release/cancel and can start a new drag', () => {
    const { queue, apply, frames, tick } = setup()
    queue.push(0.02); queue.cancel()
    expect(frames.size).toBe(0)
    tick(); expect(apply).not.toHaveBeenCalled()
    queue.push(0.03); tick(); expect(apply.mock.calls).toEqual([[0.03]])
  })
  it('shows limit feedback only outside the permissible range and resumes inside', () => {
    expect(dragLimit(0.002, 0.003, 0.1)).toEqual({ value: 0.003, limited: true })
    expect(dragLimit(0.12, 0.003, 0.1)).toEqual({ value: 0.1, limited: true })
    expect(dragLimit(0.05, 0.003, 0.1)).toEqual({ value: 0.05, limited: false })
    expect(dragLimit(0.003, 0.003, 0.1).limited).toBe(false)
    expect(dragLimit(0.1, 0.003, 0.1).limited).toBe(false)
  })
})
