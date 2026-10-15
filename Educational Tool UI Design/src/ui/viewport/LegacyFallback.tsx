import BeamScene from '../../BeamScene'
import type { Section } from '../../geometry/sections'
import { mToMm } from '../../units/units'
import { useSession } from '../state/store'

// TEMPORARY (task 14.3): the template SVG scene shown when WebGL is unavailable (and in jsdom).
// Moved unchanged from the 13.3 Viewport3D stub. Task 14.4 replaces this file with Fallback2D
// behind ViewportBoundary and deletes BeamScene.tsx. View state comes from the caller.

/** Display-only adapter from the typed draft section to the template scene's mm model. */
function templateDesign(section: Section, orientationDeg: 0 | 90) {
  const rotated = orientationDeg === 90
  switch (section.kind) {
    case 'circle': {
      const d = mToMm(section.diameterM)
      return { kind: section.kind, width: d, height: d, thickness: 0, rotated }
    }
    case 'tube': {
      const outer = mToMm(section.outerDiameterM)
      const wall = (outer - mToMm(section.innerDiameterM)) / 2
      return { kind: section.kind, width: outer, height: outer, thickness: wall, rotated }
    }
    case 'rectangle':
      return { kind: section.kind, width: mToMm(section.widthM), height: mToMm(section.heightM), thickness: 0, rotated }
    case 'iSection':
      return {
        kind: section.kind,
        width: mToMm(section.widthM),
        height: mToMm(section.heightM),
        thickness: mToMm(section.flangeThicknessM),
        rotated,
      }
  }
}

export default function LegacyFallback({ deformed, zoom, reset }: { deformed: boolean; zoom: number; reset: number }) {
  const { draft } = useSession()
  return <BeamScene design={templateDesign(draft.section, draft.orientationDeg)} deformed={deformed} zoom={zoom} reset={reset} />
}
