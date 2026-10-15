import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import { initSession } from '../../state/session'
import { visualOffset } from '../mesh'
import {
  deformedOutline,
  dimensionGuides,
  localToGlobalYZ,
} from './sceneLayout'

if (!bundledChallengeResult.ok) throw new Error('Invalid bundled challenge')
const ch = bundledChallengeResult.value
const initial = initSession(ch, '2026-10-15T00:00:00.000Z', 'baseline')
if (!initial.ok) throw new Error('Invalid initial session')
const latest = initial.value.history[0]!

describe('scene layout', () => {
  it('maps section axes exactly as the extruded mesh at both orientations', () => {
    expect(localToGlobalYZ(0.02, 0.03, 0)).toEqual({ y: 0.03, z: 0.02 })
    expect(localToGlobalYZ(0.02, 0.03, 90)).toEqual({ y: 0.02, z: -0.03 })
  })
  it('measures independent I-section thicknesses without collapsing them', () => {
    const section = {
      kind: 'iSection',
      widthM: 0.04,
      heightM: 0.06,
      flangeThicknessM: 0.004,
      webThicknessM: 0.003,
    } as const
    const guides = dimensionGuides(section, 90, 0.6, {
      widthZM: 0.06,
      heightYM: 0.04,
    })
    expect(guides.map((g) => g.valueM)).toEqual([0.04, 0.06, 0.004, 0.003])
    for (const g of guides)
      expect(Math.hypot(...g.to.map((v, i) => v - g.from[i]))).toBeCloseTo(
        g.valueM,
        12,
      )
  })
  it('draws the stored snapshot with a fixed root and the same capped tip offset as mesh deformation', () => {
    const p = {
      forceN: ch.load.forceN,
      lengthM: latest.designSnapshot.lengthM,
      elasticModulusPa: ch.material.elasticModulusPa,
      bendingInertiaM4: latest.analysis.bendingInertiaM4,
      tipDeflectionM: latest.analysis.tipDeflectionM,
      ...ch.visualization,
    }
    const outline = deformedOutline(latest.designSnapshot, p)
    const staticOutline = deformedOutline(latest.designSnapshot, p, 0)
    outline.lines.forEach((line, i) => {
      expect(line[0]).toEqual(staticOutline.lines[i][0])
      const last = line.length - 1
      expect(staticOutline.lines[i][last][1] - line[last][1]).toBeCloseTo(
        visualOffset(p.lengthM, p),
        12,
      )
      expect(
        staticOutline.lines[i][last][1] - line[last][1],
      ).toBeLessThanOrEqual(0.3 * p.lengthM)
    })
    expect(outline.tip[0]).toEqual(outline.tip.at(-1))
  })
})
