import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { ViewportProps } from '../../viewport/FallbackViewport'
import ViewportBoundary from '../../viewport/ViewportBoundary'
import ViewportLoading from '../../viewport/ViewportLoading'
import { supportsWebGL2 } from '../../viewport/webgl'
import ColumnElevation, { ColumnSummary } from './ColumnElevation'

// Column design view (task 68; CBK-18, OC-12, D-45). The view is
//   - a lazy 3D scene (ColumnScene3D: the pinned column, its end fittings and the load) where WebGL2
//     is available, or
//   - the main-bundle 2D side view with the cross-section (ColumnElevation) and a notice when WebGL2
//     is missing (checked first, so the chunk is not downloaded), the chunk fails or the context is
//     lost.
// Both end with ColumnSummary, the text equivalent of the drawing.

const ColumnScene3D = lazy(() => import('./ColumnScene3D'))

export const COLUMN_FALLBACK_NOTICE = '3D view is unavailable. Showing the 2D side view of the column instead.'

export function ColumnFallback({ onUnavailable }: ViewportProps) {
  const announced = useRef(false)
  useEffect(() => {
    if (announced.current) return
    announced.current = true
    onUnavailable?.(COLUMN_FALLBACK_NOTICE)
  }, [onUnavailable])
  return (
    <>
      <p className="viewport-label column-fallback-notice">{COLUMN_FALLBACK_NOTICE}</p>
      <ColumnElevation />
      <div className="px-3">
        <ColumnSummary />
      </div>
    </>
  )
}

export default function ColumnView({ onUnavailable }: { onUnavailable: (message: string) => void }) {
  const [lost, setLost] = useState(false)
  const onContextLost = useCallback(() => setLost(true), [])
  return (
    <div className="column-view">
      {supportsWebGL2() && !lost ? (
        <ViewportBoundary onUnavailable={onUnavailable} fallback={ColumnFallback}>
          <Suspense fallback={<ViewportLoading />}>
            <ColumnScene3D onContextLost={onContextLost} />
          </Suspense>
        </ViewportBoundary>
      ) : (
        <ColumnFallback onUnavailable={onUnavailable} />
      )}
    </div>
  )
}
