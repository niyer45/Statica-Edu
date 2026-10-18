import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../icons/Icon'
import type { ViewportProps } from '../../viewport/FallbackViewport'
import { supportsWebGL2 } from '../../viewport/webgl'
import TorsionFallback from './TorsionFallback'
import TorsionScene from './TorsionScene'
import { TORSION_SUMMARY_ID, TorsionSummary } from './TorsionView'
import { useTorsionStore } from './shared'

// Lazy 3D design view for Torsion Shaft I (task 54.2; TSH-14, OC-12). Mirrors the beam's
// Viewport3D: WebGL2 detection and context loss fall back to the main-bundle SVG view, the
// canvas is named and described by the visible text summary, and every camera control is
// local view state that never dispatches a session action.

export const TORSION_CANVAS_LABEL = '3D shaft view'

function TorsionSceneControls({ twisted, onToggleTwisted, onZoomIn, onZoomOut, onResetView, onFitView }: {
  twisted: boolean
  onToggleTwisted: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onFitView: () => void
}) {
  const { challenge } = useTorsionStore()
  return (
    <>
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
        <button type="button" className="toggle-row" onClick={onToggleTwisted} aria-pressed={twisted}>
          <span className={`toggle ${twisted ? 'on' : ''}`} />
          <span>Show twist</span>
        </button>
        {twisted && (
          <span className="exaggerated">
            <span />
            Exaggerated visualization (×{challenge.visualization.twistExaggerationFactor})
          </span>
        )}
      </div>
    </>
  )
}

export default function TorsionViewport3D({ onUnavailable }: ViewportProps = {}) {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [contextLost, setContextLost] = useState(false)
  const onContextLost = useCallback((event: Event) => { event.preventDefault(); setContextLost(true) }, [])
  useEffect(() => () => canvas.current?.removeEventListener('webglcontextlost', onContextLost), [onContextLost])
  const [twisted, setTwisted] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [reset, setReset] = useState(0)
  const [fit, setFit] = useState(0)
  if (!supportsWebGL2() || contextLost) return <TorsionFallback onUnavailable={onUnavailable} />
  return (
    <>
      <div className="beam-scene relative flex flex-1 flex-col">
        <Canvas
          orthographic
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: [1, 0.45, 1], near: 0.001, far: 20, zoom: 500 }}
          onCreated={({ gl }) => {
            canvas.current = gl.domElement
            gl.domElement.addEventListener('webglcontextlost', onContextLost)
            // Canvas forwards DOM props to its wrapper; name the actual canvas too.
            gl.domElement.setAttribute('role', 'img')
            gl.domElement.setAttribute('aria-label', TORSION_CANVAS_LABEL)
            gl.domElement.setAttribute('aria-describedby', TORSION_SUMMARY_ID)
            gl.domElement.tabIndex = 0
          }}
        >
          <TorsionScene twisted={twisted} zoom={zoom} reset={reset} fit={fit} />
        </Canvas>
      </div>
      <div className="px-3">
        <TorsionSummary />
      </div>
      <TorsionSceneControls
        twisted={twisted}
        onToggleTwisted={() => setTwisted((v) => !v)}
        onZoomIn={() => setZoom((v) => Math.min(1.5, v + 0.1))}
        onZoomOut={() => setZoom((v) => Math.max(0.6, v - 0.1))}
        onResetView={() => { setZoom(1); setReset((n) => n + 1) }}
        onFitView={() => { setZoom(1); setFit((n) => n + 1) }}
      />
    </>
  )
}
