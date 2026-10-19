import { columnInnerDiameterM, columnOuterDiameterM, type ColumnSection } from '../../../geometry/column/design'

// Display-only layout for the Column Buckling I views (task 68; CBK-18). No physics here: the
// column is drawn from the draft diameters, and the dashed curve is the shape a pinned–pinned
// column buckles into (half a sine wave between the pins). Euler theory gives that shape but no
// amplitude, so the amplitude is a fixed display value, disclosed as not to scale; the shape is the
// same for every design, so it never suggests a computed deflection.

/** The diameter is drawn this many times larger than to scale; a 60 mm × 2 m column is a line otherwise. */
export const DIAMETER_DISPLAY_SCALE = 3

/** Mode-shape amplitude as a fraction of the length (display only). */
export const MODE_AMPLITUDE_FRACTION = 0.09

/** Samples along the mode shape. */
export const MODE_SAMPLES = 40

/** Words for the display rules, shown under both views. */
export const DISPLAY_NOTE = `Diameter drawn ×${DIAMETER_DISPLAY_SCALE} for visibility, length to scale. Dashed line: the buckling mode shape, half a sine wave between the pins (amplitude not to scale).`

/** Displayed outer and inner radii of a section, m (already multiplied by DIAMETER_DISPLAY_SCALE). */
export function displayedRadii(section: Readonly<ColumnSection>): { outer: number; inner: number } {
  return {
    outer: (columnOuterDiameterM(section) / 2) * DIAMETER_DISPLAY_SCALE,
    inner: (columnInnerDiameterM(section) / 2) * DIAMETER_DISPLAY_SCALE,
  }
}

/**
 * Points of the buckling mode shape, as [sideways offset, height] pairs from the bottom pin
 * (height 0) to the top pin (height `lengthM`): offset = amplitude · sin(π · height / length).
 */
export function modeShapePoints(lengthM: number, amplitudeM: number, samples = MODE_SAMPLES): [number, number][] {
  return Array.from({ length: samples + 1 }, (_, i) => {
    const h = (i / samples) * lengthM
    return [amplitudeM * Math.sin((Math.PI * i) / samples), h]
  })
}
