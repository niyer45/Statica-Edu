import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { formatMm, nToKn } from '../../../units/units'
import type { ViewportProps } from '../../viewport/FallbackViewport'
import ViewportBoundary from '../../viewport/ViewportBoundary'
import ViewportLoading from '../../viewport/ViewportLoading'
import { supportsWebGL2 } from '../../viewport/webgl'
import AxialElevation from './AxialElevation'
import { displayedStretch, formatAxial, materialName, useAxialStore } from './shared'
import './axial.css'

// Stress and Strain I design view (task 72; SSR-15, MM-22, OC-12, D-45). The view is
//   - a lazy 3D scene (AxialScene3D: roof beam, clevises, the rod and the hanging load) where
//     WebGL2 is available, or
//   - the main-bundle 2D view (AxialElevation) with a notice when WebGL2 is missing, the chunk
//     fails or the context is lost;
// followed in both cases by AxialSummary, the text equivalent of every drawn value.

const AxialScene3D = lazy(() => import('./AxialScene3D'))

export const AXIAL_SUMMARY_ID = 'axial-view-summary'
export const AXIAL_FALLBACK_NOTICE = '3D view is unavailable. Showing the 2D view of the rod instead.'

/** Text equivalent of both views: the draft rod and the latest tested stretch and stress. */
export function AxialSummary() {
  const { state, challenge: ch } = useAxialStore()
  const draft = state.draft
  const latest = state.history[state.history.length - 1]!
  const a = latest.analysis
  const { capped } = displayedStretch(a.elongationM, ch.lengthM, ch.visualization)
  return (
    <p id={AXIAL_SUMMARY_ID} className="viewport-label axial-summary" aria-live="off">
      {materialName(ch, draft.materialId)} rod, Ø{formatMm(draft.diameterM, 1)} mm and {ch.lengthM} m long, hanging from a roof beam with a{' '}
      {nToKn(ch.forceN)} kN load. Latest tested: elongation {formatAxial(a.elongationM, 'm')}
      {capped ? ' (drawn exaggerated, display capped)' : ` (drawn ×${ch.visualization.elongationExaggerationFactor})`}, stress {formatAxial(a.stressPa, 'Pa')}.
      {' '}The rod&apos;s width is to scale; its length is drawn much shorter than scale.
      {state.draftStatus === 'draft' && ' Draft changed since this test.'}
    </p>
  )
}

function AxialFallback({ onUnavailable }: ViewportProps) {
  const announced = useRef(false)
  useEffect(() => {
    if (announced.current) return
    announced.current = true
    onUnavailable?.(AXIAL_FALLBACK_NOTICE)
  }, [onUnavailable])
  return (
    <>
      <p className="viewport-label axial-fallback-notice">{AXIAL_FALLBACK_NOTICE}</p>
      <AxialElevation />
    </>
  )
}

export default function AxialView({ onUnavailable }: { onUnavailable: (message: string) => void }) {
  const [lost, setLost] = useState(false)
  const onContextLost = useCallback(() => setLost(true), [])
  return (
    <div className="axial-view">
      {supportsWebGL2() && !lost ? (
        <ViewportBoundary onUnavailable={onUnavailable} fallback={AxialFallback}>
          <Suspense fallback={<ViewportLoading />}>
            <AxialScene3D onContextLost={onContextLost} />
          </Suspense>
        </ViewportBoundary>
      ) : (
        <AxialFallback onUnavailable={onUnavailable} />
      )}
      <AxialSummary />
    </div>
  )
}
