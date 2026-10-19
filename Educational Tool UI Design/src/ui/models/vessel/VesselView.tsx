import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { ViewportProps } from '../../viewport/FallbackViewport'
import ViewportBoundary from '../../viewport/ViewportBoundary'
import ViewportLoading from '../../viewport/ViewportLoading'
import { supportsWebGL2 } from '../../viewport/webgl'
import VesselDetails from './VesselDetails'
import VesselElevation, { WALL_EXAGGERATION } from './VesselElevation'

// Pressure vessel design view (task 69; MM-22, OC-12, D-45 pattern). The view is
//   - a lazy 3D cutaway (VesselScene3D) where WebGL2 is available, or
//   - the main-bundle 2D section (VesselElevation) with a notice when WebGL2 is missing, the chunk
//     fails or the context is lost;
// followed in both cases by VesselDetails (summary and checked-stress table).

const VesselScene3D = lazy(() => import('./VesselScene3D'))

export const VESSEL_FALLBACK_NOTICE = '3D view is unavailable. Showing the 2D section of the vessel instead.'

/** Caption of the 2D section: what is to scale and what is exaggerated. */
export const ELEVATION_CAPTION = `Section along the axis. Lengths and the inner diameter are to scale; wall thicknesses are drawn ${WALL_EXAGGERATION} times thicker so both walls stay visible.`

function VesselFallback({ onUnavailable }: ViewportProps) {
  const announced = useRef(false)
  useEffect(() => {
    if (announced.current) return
    announced.current = true
    onUnavailable?.(VESSEL_FALLBACK_NOTICE)
  }, [onUnavailable])
  return (
    <>
      <p className="viewport-label vessel-fallback-notice">{VESSEL_FALLBACK_NOTICE}</p>
      <VesselElevation />
      <p className="viewport-label vessel-caption">{ELEVATION_CAPTION}</p>
    </>
  )
}

export default function VesselView({ onUnavailable }: { onUnavailable: (message: string) => void }) {
  const [lost, setLost] = useState(false)
  const onContextLost = useCallback(() => setLost(true), [])
  return (
    <div className="vessel-view">
      {supportsWebGL2() && !lost ? (
        <ViewportBoundary onUnavailable={onUnavailable} fallback={VesselFallback}>
          <Suspense fallback={<ViewportLoading />}>
            <VesselScene3D onContextLost={onContextLost} />
          </Suspense>
        </ViewportBoundary>
      ) : (
        <VesselFallback onUnavailable={onUnavailable} />
      )}
      <VesselDetails />
    </div>
  )
}
