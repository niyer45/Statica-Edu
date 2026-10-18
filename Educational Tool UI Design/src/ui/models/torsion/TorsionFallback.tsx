import { useEffect, useRef } from 'react'
import { FALLBACK_NOTICE, type ViewportProps } from '../../viewport/FallbackViewport'
import TorsionView from './TorsionView'

// Torsion non-WebGL view (task 54.2; OC-12). Mirrors the beam's FallbackViewport: the same
// visible notice, announced once through the workbench, then the main-bundle SVG shaft view.
// Kept in the main bundle so a failed 3D chunk can still render it.

export default function TorsionFallback({ onUnavailable }: ViewportProps) {
  const announced = useRef(false)
  useEffect(() => {
    if (announced.current) return
    announced.current = true
    onUnavailable?.(FALLBACK_NOTICE)
  }, [onUnavailable])
  return (
    <>
      <p className="m-0 px-3 text-[10px] text-[#345640]">{FALLBACK_NOTICE}</p>
      <TorsionView />
    </>
  )
}
