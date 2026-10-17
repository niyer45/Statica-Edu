import { describe, expect, it } from 'vitest'
import {
  STANDARD_GRAVITY_MS2,
  VIBRATION_APPLICABILITY_CODES,
  VIBRATION_ASSUMPTIONS,
  VIBRATION_THRESHOLDS,
  VIBRATION_UNSUPPORTED_EFFECTS,
} from './constants'

// Vibration constants, thresholds and metadata (task 50.2; VIB-03, VIB-10–VIB-12).

describe('vibration model constants', () => {
  it('uses standard gravity 9.80665 m/s²', () => {
    expect(STANDARD_GRAVITY_MS2).toBe(9.80665)
  })

  it('defines SPRING_STROKE 0.8/1.0 and DAMPING_RATIO 0.35/0.5, in that order (VIB-10)', () => {
    expect(VIBRATION_APPLICABILITY_CODES).toEqual(['SPRING_STROKE', 'DAMPING_RATIO'])
    expect(VIBRATION_THRESHOLDS.SPRING_STROKE).toMatchObject({ warning: 0.8, notApplicable: 1.0 })
    expect(VIBRATION_THRESHOLDS.DAMPING_RATIO).toMatchObject({ warning: 0.35, notApplicable: 0.5 })
    for (const code of VIBRATION_APPLICABILITY_CODES) {
      expect(VIBRATION_THRESHOLDS[code].warning).toBeLessThan(VIBRATION_THRESHOLDS[code].notApplicable)
    }
  })

  it('adds no other screen (VIB-11)', () => {
    expect(Object.keys(VIBRATION_THRESHOLDS).sort()).toEqual(['DAMPING_RATIO', 'SPRING_STROKE'])
  })

  it('lists every VIB-12 unsupported effect', () => {
    expect(VIBRATION_UNSUPPORTED_EFFECTS).toEqual([
      'multi-degree-of-freedom response, rocking and coupled modes',
      'nonlinear, amplitude-dependent or hysteretic mount behavior, and friction',
      'frequency-dependent stiffness and damping (elastomer dynamic stiffening)',
      'temperature, creep and ageing of elastomers',
      'coil-spring surge (internal resonances)',
      'shock and transient excitation',
      'startup and run-up transient amplitude (screened only by steady-state peaks)',
      'support or foundation flexibility',
      'acoustic and flanking transmission paths',
      'excitation from the component itself (forced, as opposed to base, excitation)',
      'lift-off and bottoming contact (screened only through SPRING_STROKE)',
    ])
  })

  it('discloses steady-state response, the conservative run-up screen and the lift-off assumption (VIB-02, VIB-11)', () => {
    expect(VIBRATION_ASSUMPTIONS).toContain('steady-state frequency response only, not a simulation of motion over time')
    expect(VIBRATION_ASSUMPTIONS).toContain('run-up through resonance screened by steady-state peaks (a conservative screen)')
    expect(VIBRATION_ASSUMPTIONS).toContain('mounts bonded and linear in both tension and compression (lift-off not screened)')
  })

  it('is frozen', () => {
    for (const v of [VIBRATION_APPLICABILITY_CODES, VIBRATION_THRESHOLDS, VIBRATION_THRESHOLDS.SPRING_STROKE, VIBRATION_UNSUPPORTED_EFFECTS, VIBRATION_ASSUMPTIONS]) {
      expect(Object.isFrozen(v)).toBe(true)
    }
  })
})
