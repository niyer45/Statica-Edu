// Three's renderer requires WebGL2. Checked synchronously in the main bundle so a device without
// it renders a model's 2D fallback immediately, without loading a 3D chunk (task 54).
export const supportsWebGL2 = (): boolean => typeof WebGL2RenderingContext !== 'undefined'
