import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import ModelViewBoundary from '../../viewport/ModelViewBoundary'
import ViewportLoading from '../../viewport/ViewportLoading'
import { supportsWebGL2 } from '../../viewport/webgl'
import BracketDetails from './BracketDetails'
import BracketElevation from './BracketElevation'

// Bracket design view (tasks 46.3, 54.1; MBR-18, MM-22, OC-12). Owner feedback on the first
// version: the flat elevation did not show what the component is. The view is now
//   - a lazy 3D scene (BracketScene3D: wall, mounting plate and bolts, the extruded draft bar and
//     the hanging tip load) where WebGL2 is available, or
//   - the main-bundle 2D side view (BracketElevation) with a notice when WebGL2 is missing, the
//     chunk fails or the context is lost;
// followed in both cases by BracketDetails (summary, moment strip with section markers, table).

const BracketScene3D = lazy(() => import('./BracketScene3D'))

export const BRACKET_FALLBACK_NOTICE = '3D view is unavailable. Showing the 2D side view of the bracket instead.'

function Fallback({ onUnavailable }: { onUnavailable: (message: string) => void }) {
  const announced = useRef(false)
  useEffect(() => {
    if (announced.current) return
    announced.current = true
    onUnavailable(BRACKET_FALLBACK_NOTICE)
  }, [onUnavailable])
  return (
    <>
      <p className="viewport-label bracket-fallback-notice">{BRACKET_FALLBACK_NOTICE}</p>
      <BracketElevation />
    </>
  )
}

export default function BracketView({ onUnavailable }: { onUnavailable: (message: string) => void }) {
  const [lost, setLost] = useState(false)
  const onContextLost = useCallback(() => setLost(true), [])
  const fallback = <Fallback onUnavailable={onUnavailable} />
  return (
    <div className="bracket-view">
      {supportsWebGL2() && !lost ? (
        <ModelViewBoundary fallback={fallback}>
          <Suspense fallback={<ViewportLoading />}>
            <BracketScene3D onContextLost={onContextLost} />
          </Suspense>
        </ModelViewBoundary>
      ) : (
        fallback
      )}
      <BracketDetails />
    </div>
  )
}
