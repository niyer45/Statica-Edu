import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DIAGONAL_IDS } from '../../../geometry/bracedFrame/template'
import Icon from '../../icons/Icon'
import type { ViewportProps } from '../../viewport/FallbackViewport'
import BracedFrameFallback from './BracedFrameFallback'
import BracedFrameScene from './BracedFrameScene'
import { TUBE_DIAMETER_EXAGGERATION } from './frameSceneLayout'
import { FRAME_SUMMARY_ID, MECHANISM_TEXT, memberName, useFrameStore } from './shared'

// Braced Frame I 3D view (task 54.3): the lazy chunk mounted by BracedFrameView inside the
// shared ViewportBoundary and Suspense, mirroring the beam's Viewport3D. Without WebGL2, or after
// a lost context, it renders the main-bundle SVG fallback; a chunk or Canvas creation failure
// is caught by the boundary, which renders the same fallback. Camera controls (below the Canvas) are local view
// state and never dispatch session actions. The canvas is named and described (scene
// description plus the latest-test summary); the pattern key below the Canvas (collapsed, task 56) states
// every pattern in words, so nothing relies on color alone and nothing is written on the model (D-26).

export const FRAME_SCENE_LABEL = '3D braced frame view'
export const FRAME_SCENE_DESCRIPTION_ID = 'frame-scene-description'

const list = (ids: readonly string[]) => (ids.length === 0 ? 'none' : ids.join(', '))

/** Words for what the 3D scene draws, from the draft topology and the latest stored test. */
function SceneDescription() {
  const { state } = useFrameStore()
  const tested = state.history[state.history.length - 1]!.analysis
  const present = DIAGONAL_IDS.filter((id) => state.draft.members[id].present).map((id) => memberName(id).toLowerCase())
  const absent = DIAGONAL_IDS.filter((id) => !state.draft.members[id].present).map((id) => memberName(id).toLowerCase())
  const forces =
    tested.status === 'mechanism'
      ? `The latest test is an ${MECHANISM_TEXT.toLowerCase()}, so no force patterns are drawn.`
      : 'Patterns show the latest tested forces: solid tubes in tension, striped tubes in compression, beaded tubes near zero force, and open wire-mesh tubes for members without a tested force.'
  return (
    <p id={FRAME_SCENE_DESCRIPTION_ID} className="sr-only">
      Two-storey, one-bay steel frame of round tubes on pinned base supports standing on a ground slab, with arrows at the loaded joints. Tube widths follow
      each member&apos;s section, exaggerated {TUBE_DIAMETER_EXAGGERATION} times. Diagonals present: {list(present)}. Diagonals not present, drawn dashed:{' '}
      {list(absent)}. {forces}
    </p>
  )
}

function PatternKey() {
  return (
    <details className="frame-key">
      <summary>Drawing key</summary>
      <ul className="frame-legend" aria-label="3D pattern key">
        <li>
          <svg viewBox="0 0 24 8" aria-hidden="true">
            <line x1={1} y1={4} x2={23} y2={4} className="frame-member-tension" strokeWidth={4} />
          </svg>
          Solid tube: tension
        </li>
        <li>
          <svg viewBox="0 0 24 8" aria-hidden="true">
            <line x1={1} y1={4} x2={23} y2={4} className="frame-glyph-core" strokeWidth={3} />
            <line x1={2} y1={4} x2={22} y2={4} className="frame-glyph-bands" strokeWidth={6} />
          </svg>
          Striped tube: compression
        </li>
        <li>
          <svg viewBox="0 0 24 8" aria-hidden="true">
            <line x1={1} y1={4} x2={23} y2={4} className="frame-glyph-beads" strokeWidth={5} />
          </svg>
          Beaded: ≈ 0
        </li>
        <li>
          <svg viewBox="0 0 24 8" aria-hidden="true">
            <rect x={1} y={1.5} width={22} height={5} className="frame-glyph-plain" />
          </svg>
          Open mesh tube: no tested force
        </li>
        <li>
          <svg viewBox="0 0 24 8" aria-hidden="true">
            <line x1={1} y1={4} x2={23} y2={4} className="frame-member-absent" />
          </svg>
          Dashed: not present
        </li>
        <li>Tube widths ×{TUBE_DIAMETER_EXAGGERATION}, proportional to each section</li>
      </ul>
    </details>
  )
}

export default function BracedFrameViewport3D({ onUnavailable }: ViewportProps = {}) {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [contextLost, setContextLost] = useState(false)
  const onContextLost = useCallback((event: Event) => {
    event.preventDefault()
    setContextLost(true)
  }, [])
  useEffect(() => () => canvas.current?.removeEventListener('webglcontextlost', onContextLost), [onContextLost])
  const [zoom, setZoom] = useState(1)
  const [reset, setReset] = useState(0)
  const [fit, setFit] = useState(0)
  // Three's renderer requires WebGL2. Avoid constructing it in non-WebGL environments.
  const supportsWebGL = typeof WebGL2RenderingContext !== 'undefined'
  if (!supportsWebGL || contextLost) return <BracedFrameFallback onUnavailable={onUnavailable} />
  const resetView = () => {
    setZoom(1)
    setReset((n) => n + 1)
  }
  return (
    <>
      <div className="frame-scene-3d">
        <Canvas
          orthographic
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: [9, 7.5, 14], near: 0.01, far: 100, zoom: 40 }}
          onCreated={({ gl }) => {
            canvas.current = gl.domElement
            gl.domElement.addEventListener('webglcontextlost', onContextLost)
            // Canvas forwards DOM props to its wrapper; name the actual canvas too.
            gl.domElement.setAttribute('role', 'img')
            gl.domElement.setAttribute('aria-label', FRAME_SCENE_LABEL)
            gl.domElement.setAttribute('aria-describedby', `${FRAME_SCENE_DESCRIPTION_ID} ${FRAME_SUMMARY_ID}`)
            gl.domElement.tabIndex = 0
          }}
        >
          <BracedFrameScene zoom={zoom} reset={reset} fit={fit} />
        </Canvas>
      </div>
      {/* Below the Canvas, not over it, so the controls never cover the frame. */}
      <div className="scene-controls frame-scene-controls">
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}>
          <Icon name="plus" size={15} />
        </button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}>
          <Icon name="minus" size={15} />
        </button>
        <span />
        <button type="button" title="Reset view" aria-label="Reset view" onClick={resetView}>
          <Icon name="reset" size={15} />
        </button>
        <button
          type="button"
          title="Fit view"
          aria-label="Fit view"
          onClick={() => {
            setZoom(1)
            setFit((n) => n + 1)
          }}
        >
          <Icon name="expand" size={15} />
        </button>
      </div>
      <SceneDescription />
      <PatternKey />
    </>
  )
}
