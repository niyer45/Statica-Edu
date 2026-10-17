import { describe, expect, it } from 'vitest'
import {
  HEAT_SINK_APPLICABILITY_CODES,
  HEAT_SINK_ASSUMPTIONS,
  HEAT_SINK_THRESHOLDS,
  HEAT_SINK_UNSUPPORTED_EFFECTS,
} from './constants'

// Heat sink thresholds and metadata (task 48.2; HSK-10–HSK-12).

describe('heat sink applicability constants', () => {
  it('defines FIN_GAP 3/2 mm (lower), CHANNEL_ASPECT 8/12 and FIN_BIOT 0.01/0.1, in that order', () => {
    expect(HEAT_SINK_APPLICABILITY_CODES).toEqual(['FIN_GAP', 'CHANNEL_ASPECT', 'FIN_BIOT'])
    expect(HEAT_SINK_THRESHOLDS.FIN_GAP).toMatchObject({ direction: 'lower', warning: 0.003, notApplicable: 0.002 })
    expect(HEAT_SINK_THRESHOLDS.CHANNEL_ASPECT).toMatchObject({ direction: 'upper', warning: 8, notApplicable: 12, metric: 'H / s' })
    expect(HEAT_SINK_THRESHOLDS.FIN_BIOT).toMatchObject({ direction: 'upper', warning: 0.01, notApplicable: 0.1, metric: 'h t / (2 k)' })
    for (const code of HEAT_SINK_APPLICABILITY_CODES) {
      const th = HEAT_SINK_THRESHOLDS[code]
      // The not-applicable threshold is always past the warning threshold in the screen's direction.
      if (th.direction === 'upper') expect(th.warning).toBeLessThan(th.notApplicable)
      else expect(th.warning).toBeGreaterThan(th.notApplicable)
    }
  })

  it('keeps both gap screens below the 4 mm gap constraint (HSK-10)', () => {
    expect(HEAT_SINK_THRESHOLDS.FIN_GAP.warning).toBeLessThan(0.004)
    expect(HEAT_SINK_THRESHOLDS.FIN_GAP.notApplicable).toBeLessThan(0.004)
  })

  it('adds no fin-aspect (H/t), depth or tip screen (HSK-11)', () => {
    expect(Object.keys(HEAT_SINK_THRESHOLDS).sort()).toEqual(['CHANNEL_ASPECT', 'FIN_BIOT', 'FIN_GAP'])
  })

  it('lists every HSK-12 unsupported effect and assumption', () => {
    expect(HEAT_SINK_UNSUPPORTED_EFFECTS).toHaveLength(12)
    for (const fragment of ['radiation', 'spreading', 'spacing- and flow-dependent convection', 'air temperature rise', 'natural convection', 'fan curve', 'interface', 'transient', 'temperature-dependent', 'hot spots', 'two-dimensional conduction', 'fin end edges']) {
      expect(HEAT_SINK_UNSUPPORTED_EFFECTS.some((e) => e.includes(fragment)), fragment).toBe(true)
    }
    expect(HEAT_SINK_ASSUMPTIONS).toEqual([
      'steady state',
      'uniform heat flux over the base footprint',
      'one-dimensional conduction through the base',
      'one-dimensional fin conduction',
      'constant properties',
      'uniform specified convection coefficient',
      'air at ambient temperature everywhere',
      'corrected-length adiabatic-tip fins',
      'perfect fin-base contact',
    ])
  })

  it('is frozen', () => {
    for (const v of [HEAT_SINK_APPLICABILITY_CODES, HEAT_SINK_THRESHOLDS, HEAT_SINK_THRESHOLDS.FIN_GAP, HEAT_SINK_UNSUPPORTED_EFFECTS, HEAT_SINK_ASSUMPTIONS]) {
      expect(Object.isFrozen(v)).toBe(true)
    }
  })
})
