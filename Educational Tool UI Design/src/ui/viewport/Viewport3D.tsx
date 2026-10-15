import { useCallback, useState } from 'react'
import BeamScene from '../../BeamScene'
import type { SectionKind } from '../../challenge/types'
import type { Section } from '../../geometry/sections'
import { mToMm, paToMpa } from '../../units/units'
import Icon from '../icons/Icon'
import { useSectionDrop } from '../palette/useSectionDrop'
import { useChallenge, useDispatch, useSession } from '../state/store'

// STUB (task 13.3): lazy-loaded content of the template `section.viewport`.
// Task 14.3 replaces this file with the R3F canvas and moves the chrome below into
// `SceneControls`; task 14.4 replaces BeamScene with `Fallback2D` behind `ViewportBoundary`.
// Until then it renders the template SVG scene so the Workbench stays visually complete.
// View state (zoom, reset, deformation toggle) is local and never dispatches session actions.

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

export default function Viewport3D() {
  const { draft } = useSession()
  const { material, allowedSections } = useChallenge()
  const dispatch = useDispatch()
  const applySection = useCallback((kind: SectionKind) => dispatch({ type: 'applySection', kind }), [dispatch])
  const { highlight, dropProps } = useSectionDrop(allowedSections, applySection)
  const [deformed, setDeformed] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [reset, setReset] = useState(0)
  const resetView = () => {
    setReset((r) => r + 1)
    setZoom(1)
  }
  return (
    <>
      {/* Section_Palette drop zone (task 15.1); whole-scene fallback until 14.3 adds a beam raycast. */}
      <div
        data-section-drop-target={highlight ? 'active' : 'idle'}
        className={`flex flex-1 flex-col rounded-md ${highlight ? 'outline-2 -outline-offset-4 outline-dashed outline-[#7f9470] bg-[#f0f4e9]' : ''}`}
        {...dropProps}
      >
        <BeamScene design={templateDesign(draft.section, draft.orientationDeg)} deformed={deformed} zoom={zoom} reset={reset} />
      </div>
      <div className="scene-label fixed-label">
        <Icon name="lock" size={10} />
        Fixed support
      </div>
      <div className="scene-controls">
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom((v) => Math.min(1.5, v + 0.1))}>
          <Icon name="plus" size={15} />
        </button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom((v) => Math.max(0.6, v - 0.1))}>
          <Icon name="minus" size={15} />
        </button>
        <span />
        <button type="button" title="Reset view" aria-label="Reset view" onClick={resetView}>
          <Icon name="reset" size={15} />
        </button>
        <button type="button" title="Fit view" aria-label="Fit view" onClick={() => setZoom(0.9)}>
          <Icon name="expand" size={15} />
        </button>
      </div>
      <div className="viewport-bottom">
        <button type="button" className="toggle-row" onClick={() => setDeformed(!deformed)} aria-pressed={deformed}>
          <span className={`toggle ${deformed ? 'on' : ''}`} />
          <span>Show deformation</span>
        </button>
        <span className="exaggerated">
          <span />
          Exaggerated visualization
        </span>
      </div>
      <div className="material-strip">
        <span>
          <span className="material-dot" />
          {material.name}
        </span>
        <span>E = {(paToMpa(material.elasticModulusPa) / 1e3).toFixed(0)} GPa</span>
        <span>ρ = {material.densityKgM3.toLocaleString('en-US')} kg/m³</span>
        <Icon name="lock" size={12} />
      </div>
    </>
  )
}
