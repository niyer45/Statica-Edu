import { describe, expect, it } from 'vitest'
import { orientedEnvelope } from './envelope'
import { sectionBoundingBox, type Section } from './sections'

const circle: Section = { kind: 'circle', diameterM: 0.05 }
const tube: Section = { kind: 'tube', outerDiameterM: 0.06, innerDiameterM: 0.04 }
const rect: Section = { kind: 'rectangle', widthM: 0.02, heightM: 0.08 }
const iSec: Section = {
  kind: 'iSection',
  widthM: 0.05,
  heightM: 0.1,
  flangeThicknessM: 0.008,
  webThicknessM: 0.005,
}

describe('sectionBoundingBox', () => {
  it('uses the diameter for circles', () => {
    expect(sectionBoundingBox(circle)).toEqual({ widthM: 0.05, heightM: 0.05 })
  })
  it('uses the outer diameter for tubes', () => {
    expect(sectionBoundingBox(tube)).toEqual({ widthM: 0.06, heightM: 0.06 })
  })
  it('uses width × height for rectangles', () => {
    expect(sectionBoundingBox(rect)).toEqual({ widthM: 0.02, heightM: 0.08 })
  })
  it('uses width × height for I-sections', () => {
    expect(sectionBoundingBox(iSec)).toEqual({ widthM: 0.05, heightM: 0.1 })
  })
})

describe('orientedEnvelope', () => {
  it('at 0° maps b → Z and h → Y', () => {
    expect(orientedEnvelope(rect, 0)).toEqual({ widthZM: 0.02, heightYM: 0.08 })
    expect(orientedEnvelope(iSec, 0)).toEqual({ widthZM: 0.05, heightYM: 0.1 })
  })
  it('at 90° swaps: h → Z and b → Y', () => {
    expect(orientedEnvelope(rect, 90)).toEqual({ widthZM: 0.08, heightYM: 0.02 })
    expect(orientedEnvelope(iSec, 90)).toEqual({ widthZM: 0.1, heightYM: 0.05 })
  })
  it('is orientation-independent for circles and tubes', () => {
    expect(orientedEnvelope(circle, 90)).toEqual(orientedEnvelope(circle, 0))
    expect(orientedEnvelope(tube, 90)).toEqual(orientedEnvelope(tube, 0))
  })
})
