import { sectionBoundingBox, type Orientation, type Section } from './sections'

/**
 * Space the section occupies in the global scene (see design "Coordinate and Axis Convention").
 * 0°:  u ≡ Z, v ≡ Y → width (Z) = b, height (Y) = h.
 * 90°: rotation about X maps u onto Y → width (Z) = h, height (Y) = b.
 */
export function orientedEnvelope(
  s: Section,
  o: Orientation,
): { widthZM: number; heightYM: number } {
  const { widthM: b, heightM: h } = sectionBoundingBox(s)
  return o === 0 ? { widthZM: b, heightYM: h } : { widthZM: h, heightYM: b }
}
