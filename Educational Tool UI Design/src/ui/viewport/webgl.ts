// WebGL2 availability (task 54.2): the same check Viewport3D makes before constructing three's
// renderer, which requires WebGL2. Shared so a model view can choose its main-bundle fallback
// without downloading a lazy 3D chunk. Evaluated on every call so tests can stub the global.

export function supportsWebGL2(): boolean {
  return typeof WebGL2RenderingContext !== 'undefined'
}
