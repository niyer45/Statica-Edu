import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { Raycaster, Vector2, type Camera, type Mesh } from 'three'
import type { SectionKind } from '../../challenge/types'
import { useSectionDrop } from '../palette/useSectionDrop'
import { useChallenge, useDispatch } from '../state/store'
import BeamView from './BeamView'
import FallbackViewport, { type ViewportProps } from './FallbackViewport'
import SceneControls from './SceneControls'
import type { HandleFeedback } from './DimensionHandles'
import { formatMm } from '../../units/units'
import SceneSummary, { SCENE_SUMMARY_ID } from './SceneSummary'

export interface SceneHitTarget {
  camera: Camera
  canvas: HTMLCanvasElement
  beam: Mesh
}

/** Raycast the draft beam without relying on R3F pointer events during an HTML5 drag. */
export function beamContainsPointer(target: SceneHitTarget, clientX: number, clientY: number): boolean {
  const rect = target.canvas.getBoundingClientRect()
  if (!rect.width || !rect.height || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false
  const pointer = new Vector2(
    (2 * (clientX - rect.left)) / rect.width - 1,
    1 - (2 * (clientY - rect.top)) / rect.height,
  )
  const ray = new Raycaster()
  target.camera.updateMatrixWorld()
  ray.setFromCamera(pointer, target.camera)
  target.beam.updateWorldMatrix(true, false)
  return ray.intersectObject(target.beam, false).length > 0
}

// Camera controls are local view state and never dispatch session actions.
export default function Viewport3D({ onUnavailable }: ViewportProps = {}) {
  const { allowedSections } = useChallenge()
  const dispatch = useDispatch()
  const hitTarget = useRef<SceneHitTarget | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [contextLost, setContextLost] = useState(false)
  const onContextLost = useCallback((event: Event) => { event.preventDefault(); setContextLost(true) }, [])
  useEffect(() => () => canvas.current?.removeEventListener('webglcontextlost', onContextLost), [onContextLost])
  const [deformed, setDeformed] = useState(true)
  const [handleFeedback, setHandleFeedback] = useState<HandleFeedback | null>(null)
  const [zoom, setZoom] = useState(1)
  const [reset, setReset] = useState(0)
  const [fit, setFit] = useState(0)
  const applySection = useCallback(
    (kind: SectionKind) => dispatch({ type: 'applySection', kind }),
    [dispatch],
  )
  const isOverBeam = useCallback((e: DragEvent) => {
    const target = hitTarget.current
    // Until Canvas is ready there is no beam to highlight.
    if (!target) return true
    return beamContainsPointer(target, e.clientX, e.clientY)
  }, [])
  const { highlight, dropProps } = useSectionDrop(
    allowedSections,
    applySection,
    isOverBeam,
  )
  // Three's renderer requires WebGL2. Avoid constructing it in non-WebGL environments.
  const supportsWebGL = typeof WebGL2RenderingContext !== 'undefined'
  const resetView = () => {
    setZoom(1)
    setReset((n) => n + 1)
  }
  if (!supportsWebGL || contextLost) return <FallbackViewport onUnavailable={onUnavailable} />
  return (
    <>
      <div
        data-section-drop-target={highlight ? 'active' : 'idle'}
        className={`beam-scene relative flex flex-1 flex-col ${highlight
            ? 'outline-2 -outline-offset-4 outline-dashed outline-[#7f9470]'
            : ''
          }`}
        {...dropProps}
      >
        <Canvas
          className="scene-canvas"
          orthographic
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: [1, 0.55, 1], near: 0.001, far: 20, zoom: 500 }}
          onCreated={({ gl }) => {
            canvas.current = gl.domElement
            gl.domElement.addEventListener('webglcontextlost', onContextLost)
            // Canvas forwards DOM props to its wrapper; name the actual canvas too.
            gl.domElement.setAttribute('role', 'img')
            gl.domElement.setAttribute('aria-label', '3D beam view')
            gl.domElement.setAttribute('aria-describedby', SCENE_SUMMARY_ID)
            gl.domElement.tabIndex = 0
          }}
        >
          <BeamView
            deformed={deformed}
            highlight={highlight}
            zoom={zoom}
            reset={reset}
            fit={fit}
            hitTarget={hitTarget}
            onHandleFeedback={setHandleFeedback}
          />
        </Canvas>

      </div>
      <div data-testid="dimension-feedback" className="h-5 px-3 text-[10px] text-[#345640]">
        {handleFeedback && <>{handleFeedback.label}: {formatMm(handleFeedback.valueM)} mm{handleFeedback.limited && <span role="tooltip"> · Limit reached</span>}</>}
      </div>
      <SceneSummary />
      <SceneControls
        showFixedSupportLabel={false}
        deformed={deformed}
        onToggleDeformed={() => setDeformed((v) => !v)}
        onZoomIn={() => setZoom((v) => Math.min(1.5, v + 0.1))}
        onZoomOut={() => setZoom((v) => Math.max(0.6, v - 0.1))}
        onResetView={resetView}
        onFitView={() => {
          setZoom(1)
          setFit((n) => n + 1)
        }}
      />
    </>
  )
}
