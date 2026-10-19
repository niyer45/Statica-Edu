import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { ViewportProps } from '../../viewport/FallbackViewport'
import ViewportBoundary from '../../viewport/ViewportBoundary'
import ViewportLoading from '../../viewport/ViewportLoading'
import { supportsWebGL2 } from '../../viewport/webgl'
import FatigueDetails from './FatigueDetails'
import FatigueElevation from './FatigueElevation'

// Fatigue design view (task 70; FAT-16, D-45, OC-12): a lazy 3D spindle where WebGL2 is available,
// or the main-bundle 2D side view with a notice when WebGL2 is missing, the chunk fails or the
// context is lost; followed in both cases by FatigueDetails (summary, S-N diagram, table).

const FatigueScene3D = lazy(() => import('./FatigueScene3D'))

export const FATIGUE_FALLBACK_NOTICE = '3D view is unavailable. Showing the 2D side view of the spindle instead.'

function FatigueFallback({ onUnavailable }: ViewportProps) {
  const announced = useRef(false)
  useEffect(() => {
    if (announced.current) return
    announced.current = true
    onUnavailable?.(FATIGUE_FALLBACK_NOTICE)
  }, [onUnavailable])
  return (
    <>
      <p className="viewport-label bracket-fallback-notice">{FATIGUE_FALLBACK_NOTICE}</p>
      <FatigueElevation />
    </>
  )
}

export default function FatigueView({ onUnavailable }: { onUnavailable: (message: string) => void }) {
  const [lost, setLost] = useState(false)
  const onContextLost = useCallback(() => setLost(true), [])
  return (
    <div className="bracket-view fatigue-view">
      {supportsWebGL2() && !lost ? (
        <ViewportBoundary onUnavailable={onUnavailable} fallback={FatigueFallback}>
          <Suspense fallback={<ViewportLoading />}>
            <FatigueScene3D onContextLost={onContextLost} />
          </Suspense>
        </ViewportBoundary>
      ) : (
        <FatigueFallback onUnavailable={onUnavailable} />
      )}
      <FatigueDetails />
    </div>
  )
}
