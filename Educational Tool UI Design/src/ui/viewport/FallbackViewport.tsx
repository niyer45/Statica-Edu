import { useCallback, useEffect, useRef, useState } from 'react'
import type { SectionKind } from '../../challenge/types'
import { useSectionDrop } from '../palette/useSectionDrop'
import { useChallenge, useDispatch } from '../state/store'
import Fallback2D from './Fallback2D'
import SceneControls from './SceneControls'
import SceneSummary from './SceneSummary'

export const FALLBACK_NOTICE = '3D view is unavailable. Use the 2D view and numeric controls instead.'
export interface ViewportProps { onUnavailable?: (message: string) => void }

// Kept in the main bundle so a failed 3D chunk can still render the complete fallback.
export default function FallbackViewport({ onUnavailable }: ViewportProps) {
  const { allowedSections } = useChallenge()
  const dispatch = useDispatch()
  const [deformed, setDeformed] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [reset, setReset] = useState(0)
  const announced = useRef(false)
  useEffect(() => {
    if (announced.current) return
    announced.current = true
    onUnavailable?.(FALLBACK_NOTICE)
  }, [onUnavailable])
  const apply = useCallback((kind: SectionKind) => dispatch({ type: 'applySection', kind }), [dispatch])
  const { highlight, dropProps } = useSectionDrop(allowedSections, apply)
  const resetView = () => { setZoom(1); setReset((v) => v + 1) }
  return <>
    <p className="m-0 px-3 text-[10px] text-[#345640]">{FALLBACK_NOTICE}</p>
    <div className={`flex flex-1 flex-col ${highlight ? 'outline-2 -outline-offset-4 outline-dashed outline-[#7f9470]' : ''}`} data-section-drop-target={highlight ? 'active' : 'idle'} {...dropProps}>
      <Fallback2D deformed={deformed} zoom={zoom} reset={reset} />
    </div>
    <SceneSummary />
    <SceneControls deformed={deformed} onToggleDeformed={() => setDeformed((v) => !v)} onZoomIn={() => setZoom((v) => Math.min(1.5, v + 0.1))} onZoomOut={() => setZoom((v) => Math.max(0.6, v - 0.1))} onResetView={resetView} onFitView={resetView} />
  </>
}
