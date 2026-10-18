import { DataTexture, RepeatWrapping, RGBAFormat } from 'three'

// Wall hatch texture shared by 3D scenes (moved from BeamView, task 54.1). Lives in the lazy
// 3D chunks only; it imports three.js.

/** Procedural RGBA hatch; no fetches, canvas serialization, or data URLs. */
export function wallHatchTexture() {
  const side = 16
  const pixels = new Uint8Array(side * side * 4)
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const i = (y * side + x) * 4
      pixels.set(
        (x + y) % 8 < 2 ? [151, 161, 144, 255] : [214, 221, 205, 255],
        i,
      )
    }
  const texture = new DataTexture(pixels, side, side, RGBAFormat)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(8, 12)
  texture.needsUpdate = true
  return texture
}
