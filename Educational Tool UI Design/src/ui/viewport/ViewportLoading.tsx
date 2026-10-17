// Same-footprint placeholder while a lazy viewport chunk loads (Req 24.6, 24.7). Moved from
// Workbench (task 34.2) so model UI modules can share it; Workbench re-exports the names.

export const VIEWPORT_LOADING_TEXT = '3D view is loading'

/** Same footprint as the scene: fills the `.viewport` flex column like `.beam-scene`. */
export default function ViewportLoading() {
  return (
    <div className="beam-scene viewport-loading grid place-items-center cursor-default!" role="status">
      <span className="viewport-label">{VIEWPORT_LOADING_TEXT}</span>
    </div>
  )
}
