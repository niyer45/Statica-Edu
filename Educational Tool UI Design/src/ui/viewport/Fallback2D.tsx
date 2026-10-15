import { useId, useRef, useState } from 'react'
import { sectionOutline } from '../../geometry/outline'
import { selectDraftEnvelope, selectLatestResult } from '../../state/selectors'
import { formatMm, mToMm } from '../../units/units'
import { useChallenge, useSession } from '../state/store'
import { beamSurfaces, cameraDirection, clampElevation, DEFAULT_ORBIT, project } from './projection'
import { deformedOutline, localToGlobalYZ, sectionParamValues, type Vec3 } from './sceneLayout'
import { SCENE_SUMMARY_ID } from './SceneSummary'

export interface Fallback2DProps {
  deformed: boolean
  zoom: number
  reset: number
}

export default function Fallback2D({ deformed, zoom, reset }: Fallback2DProps) {
  const session = useSession()
  const { draft } = session
  const ch = useChallenge()
  const [orbit, setOrbit] = useState(DEFAULT_ORBIT)
  const [previousReset, setPreviousReset] = useState(reset)
  if (previousReset !== reset) { setPreviousReset(reset); setOrbit(DEFAULT_ORBIT) }
  const drag = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const id = useId().replace(/:/g, '')
  const camera = cameraDirection(orbit.angle, orbit.elevation)
  const at = (p: Vec3) => project(p, draft.lengthM, orbit.angle, orbit.elevation, zoom)
  const points = (ps: Vec3[]) => ps.map((p) => at(p).join(',')).join(' ')
  const path = (ps: Vec3[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${at(p).join(' ')}`).join(' ') + ' Z'
  const surfaces = beamSurfaces(draft, camera)
  const latest = selectLatestResult(session)
  const outline = deformedOutline(latest.designSnapshot, {
    forceN: ch.load.forceN, lengthM: latest.designSnapshot.lengthM, elasticModulusPa: ch.material.elasticModulusPa,
    bendingInertiaM4: latest.analysis.bendingInertiaM4, tipDeflectionM: latest.analysis.tipDeflectionM, ...ch.visualization,
  })
  const env = selectDraftEnvelope(session)
  const tip = at([draft.lengthM, Math.max(env.heightYM / 2, ch.constraints.maxHeightM / 2) + 0.025, 0])
  const section = sectionOutline(draft.section)
  const sectionPath = [section.outer, ...section.holes].map((contour) => contour.map((p, i) => {
    const g = localToGlobalYZ(p.u, p.v, draft.orientationDeg)
    return `${i ? 'L' : 'M'}${mToMm(g.z)} ${-mToMm(g.y)}`
  }).join(' ') + ' Z').join(' ')
  const release = (target: SVGSVGElement, pointerId: number) => {
    if (drag.current?.pointerId !== pointerId) return
    drag.current = null
    if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId)
  }
  return <>
    <svg className="beam-scene" viewBox="0 0 900 500" role="img" tabIndex={0}
      aria-label="2D cantilever beam projection. Drag or use arrow keys to orbit."
      aria-describedby={SCENE_SUMMARY_ID}
      onPointerDown={(e) => {
        if (drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return
        drag.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        const prev = drag.current
        if (prev?.pointerId !== e.pointerId) return
        setOrbit((v) => ({ angle: v.angle + (e.clientX - prev.x) * 0.008, elevation: clampElevation(v.elevation + (e.clientY - prev.y) * 0.008) }))
        drag.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
      }}
      onPointerUp={(e) => release(e.currentTarget, e.pointerId)}
      onPointerCancel={(e) => release(e.currentTarget, e.pointerId)}
      onLostPointerCapture={() => { drag.current = null }}
      onKeyDown={(e) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
        e.preventDefault()
        setOrbit((v) => ({ angle: v.angle + (e.key === 'ArrowLeft' ? -0.1 : e.key === 'ArrowRight' ? 0.1 : 0), elevation: clampElevation(v.elevation + (e.key === 'ArrowUp' ? -0.1 : e.key === 'ArrowDown' ? 0.1 : 0)) }))
      }}>
      <defs>
        <pattern id={`${id}-floor`} width="38" height="22" patternUnits="userSpaceOnUse" patternTransform="matrix(1 -.25 1 .5 -50 380)"><path d="M38 0 L0 0 0 22" fill="none" stroke="#d9dfd9" strokeWidth=".7" /></pattern>
        <pattern id={`${id}-hatch`} width="9" height="9" patternUnits="userSpaceOnUse"><path d="M-2 9L9-2M7 11L11 7" stroke="#a4aaa3" /></pattern>
        <marker id={`${id}-arrow`} markerWidth="9" markerHeight="9" refX="5" refY="4" orient="auto"><path d="M0 0L7 4L0 8" fill="none" stroke="#cf744b" strokeWidth="1.6" /></marker>
        <mask id={`${id}-wall`} maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="500"><rect width="900" height="500" fill="white" />{surfaces.filter((s) => s.wall).map((s, i) => <polygon key={i} points={points(s.points)} fill="black" />)}</mask>
      </defs>
      <rect width="900" height="500" fill={`url(#${id}-floor)`} opacity=".6" />
      <ellipse cx="508" cy="351" rx="194" ry="23" fill="#304b3c" opacity=".045" />
      {surfaces.map((s, i) => <g key={i}><path d={[path(s.points), ...(s.holes ?? []).map(path)].join(' ')} fill={s.fill} fillRule="evenodd" stroke={s.stroke} strokeWidth=".8" strokeLinejoin="round" />{s.wall && <path d={path(s.points)} fill={`url(#${id}-hatch)`} />}</g>)}
      {deformed && <g mask={`url(#${id}-wall)`} data-testid="fallback-deformation">
        {outline.lines.map((line, i) => <polyline key={i} points={points(line)} fill="none" stroke="#cf744b" strokeWidth="1.4" strokeDasharray="5 4" />)}
        <polygon points={points(outline.tip)} fill="#e5ba96" fillOpacity=".25" stroke="#cf744b" strokeDasharray="4 3" />
      </g>}
      <path d={`M${tip[0]} ${tip[1] - 102}V${tip[1] - 12}`} stroke="#cf744b" strokeWidth="2" markerEnd={`url(#${id}-arrow)`} />
      <text x={tip[0] + 15} y={tip[1] - 75} fill="#ad5e3c" fontSize="15">{ch.load.forceN} N</text><text x={tip[0] + 15} y={tip[1] - 56} fill="#626b5e" fontSize="10">TIP LOAD</text>
      <polyline points={points([[0, -0.19, 0.018], [draft.lengthM, -0.19, 0.018]])} stroke="#9ba89b" fill="none" />
      <text x={at([draft.lengthM / 2, -0.23, 0.018])[0]} y={at([draft.lengthM / 2, -0.23, 0.018])[1]} textAnchor="middle" fill="#626b5e" fontSize="12">{formatMm(draft.lengthM, 0)} mm · fixed span</text>
      <g transform="translate(46 421)"><path d="M0 30V-5M0 30L33 39M0 30L-18 42" fill="none" stroke="#758773" /><text y="-14" x="-3" fontSize="10">Y</text><text x="39" y="43" fontSize="10">X</text><text x="-29" y="49" fontSize="10">Z</text></g>
      <text x="450" y="473" textAnchor="middle" fill="#626b5e" fontSize="11">Bending axis (resists vertical load) · Drag or use arrow keys to orbit</text>
    </svg>
    <div className="flex items-center gap-3 px-3 text-[9px] text-[#345640]">
      <svg viewBox="-70 -70 140 140" width="100" height="100" role="img" aria-label="2D section view" aria-describedby={SCENE_SUMMARY_ID}>
        <rect x={-mToMm(ch.constraints.maxWidthM) / 2} y={-mToMm(ch.constraints.maxHeightM) / 2} width={mToMm(ch.constraints.maxWidthM)} height={mToMm(ch.constraints.maxHeightM)} fill="none" stroke="#617453" strokeDasharray="3 2" />
        <path data-testid="fallback-section-outline" d={sectionPath} fill="#91a99b" stroke="#345640" fillRule="evenodd" />
        <text x="0" y="65" textAnchor="middle" fontSize="8">{formatMm(ch.constraints.maxWidthM, 0)} × {formatMm(ch.constraints.maxHeightM, 0)} mm limit</text>
      </svg>
      <p>{sectionParamValues(draft.section).map((p) => `${p.label} ${formatMm(p.valueM)} mm`).join(' · ')}<br />Envelope {formatMm(env.widthZM)} × {formatMm(env.heightYM)} mm</p>
    </div>
  </>
}
