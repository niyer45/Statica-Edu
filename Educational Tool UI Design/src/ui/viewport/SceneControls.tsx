import { paToMpa } from '../../units/units'
import Icon from '../icons/Icon'
import { useChallenge } from '../state/store'

// Template viewport chrome (task 14.3; Req 25.4, 25.13, 25.14, 25.15). Shared by Viewport3D and
// the 2D fallback (task 14.4). Purely presentational: every handler is local view state owned by
// the caller, and nothing here dispatches a session action.

export interface SceneControlsProps {
  deformed: boolean
  showFixedSupportLabel?: boolean
  onToggleDeformed: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onFitView: () => void
}

export const MATERIAL_LOCK_LABEL = 'Material is fixed by the challenge'

export default function SceneControls({
  deformed,
  showFixedSupportLabel = true,
  onToggleDeformed,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitView,
}: SceneControlsProps) {
  const { material, visualization } = useChallenge()
  const elasticModulusGpa = paToMpa(material.elasticModulusPa) / 1e3
  return (
    <>
      {showFixedSupportLabel && <div className="scene-label fixed-label">
        <Icon name="lock" size={10} />
        Fixed support
      </div>}
      <div className="scene-controls">
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={onZoomIn}>
          <Icon name="plus" size={15} />
        </button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={onZoomOut}>
          <Icon name="minus" size={15} />
        </button>
        <span />
        <button type="button" title="Reset view" aria-label="Reset view" onClick={onResetView}>
          <Icon name="reset" size={15} />
        </button>
        <button type="button" title="Fit view" aria-label="Fit view" onClick={onFitView}>
          <Icon name="expand" size={15} />
        </button>
      </div>
      <div className="viewport-bottom">
        <button type="button" className="toggle-row" onClick={onToggleDeformed} aria-pressed={deformed}>
          <span className={`toggle ${deformed ? 'on' : ''}`} />
          <span>Show deformation</span>
        </button>
        {deformed && (
          <span className="exaggerated">
            <span />
            Exaggerated visualization (×{visualization.exaggerationFactor})
          </span>
        )}
      </div>
      <div className="material-strip">
        <span>
          <span className="material-dot" />
          {material.name}
        </span>
        <span>E = {elasticModulusGpa.toFixed(0)} GPa</span>
        <span>ρ = {material.densityKgM3.toLocaleString('en-US')} kg/m³</span>
        <span role="img" aria-label={MATERIAL_LOCK_LABEL} title={MATERIAL_LOCK_LABEL} className="inline-flex">
          <Icon name="lock" size={12} />
        </span>
      </div>
    </>
  )
}
