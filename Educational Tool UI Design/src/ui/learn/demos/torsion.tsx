import { useState, type ReactNode } from 'react'
import {
  baseShaft,
  DEMO_SHAFT_MATERIAL,
  DEMO_SHAFT_SECTIONS,
  demoMaxTwistRad,
  demoShaftSection,
  shaftResponse,
  shearStressAt,
  solidSection,
  TORSION_DEMO_DEFAULTS,
  type DemoShaftSection,
  type ShaftInput,
} from '../../../learn/torsionDemo'
import type { TorsionDemoKind } from '../../../learn/types'
import { m2ToMm2, m4ToMm4, mToMm, paToMpa, radToDeg } from '../../../units/units'
import { Choice, DemoNote, Readout, Slider } from './controls'
import './torsion.css'

// Torsion demonstrations (task 71, D-61; LRN-04, LRN-05, LRN-09). Every value comes from
// learn/torsionDemo (the physics layer); this file only scales it for drawing and formats it. Each
// drawing is decorative and has a text readout of every value it shows.

const deg = (rad: number) => `${radToDeg(rad).toFixed(2)}°`
const mpa = (pa: number) => `${paToMpa(pa).toFixed(1)} MPa`
const mm = (m: number) => `${mToMm(m).toFixed(1)} mm`
const mm4 = (m4: number) => `${Math.round(m4ToMm4(m4)).toLocaleString('en-US')} mm⁴`
const mm2 = (m2: number) => `${Math.round(m2ToMm2(m2)).toLocaleString('en-US')} mm²`

/** Drawn angle of the largest twist a demonstration can produce (true proportion within a demo). */
const MAX_DRAWN_RAD = (75 * Math.PI) / 180
/** Drawn diameter per millimetre of real diameter (side and end views). */
const PX_PER_MM = 1.6
const ORIGIN_X = 34
const CY = 75

function drawnTwist(input: ShaftInput, kind: TorsionDemoKind): number {
  return (shaftResponse(input).twistRad / demoMaxTwistRad(kind)) * MAX_DRAWN_RAD
}

/**
 * Side view: wall, shaft (bore dashed for a tube), centre line, a surface line that is straight
 * before loading and winds round as the shaft twists (exaggerated), and the torque at the free end.
 */
function ShaftDiagram({ input, kind, pxPerM, torqueScale = 1 }: { input: ShaftInput; kind: TorsionDemoKind; pxPerM: number; torqueScale?: number }) {
  const r = shaftResponse(input)
  const R = (mToMm(r.outerDiameterM) * PX_PER_MM) / 2
  const bore = (mToMm(r.innerDiameterM) * PX_PER_MM) / 2
  const length = input.lengthM * pxPerM
  const end = ORIGIN_X + length
  const theta = drawnTwist(input, kind)
  const samples = 24
  // The front surface line turns by θ·x/L; seen from the side it rises by R·sin of that angle.
  const line = Array.from({ length: samples + 1 }, (_, i) => `${(ORIGIN_X + (length * i) / samples).toFixed(1)},${(CY - R * Math.sin((theta * i) / samples)).toFixed(1)}`)
  const arc = R + 8 + 6 * torqueScale
  return (
    <svg className="learn-diagram" viewBox="0 0 360 150" aria-hidden="true">
      <rect x={ORIGIN_X - 18} y={14} width={18} height={122} className="learn-wall" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line key={i} x1={ORIGIN_X - 18} y1={30 + i * 16} x2={ORIGIN_X - 4} y2={16 + i * 16} className="learn-hatch" />
      ))}
      <rect x={ORIGIN_X} y={CY - R} width={length} height={2 * R} className="learn-shaft" />
      {bore > 0 && (
        <>
          <line x1={ORIGIN_X} y1={CY - bore} x2={end} y2={CY - bore} className="learn-bore-line" />
          <line x1={ORIGIN_X} y1={CY + bore} x2={end} y2={CY + bore} className="learn-bore-line" />
        </>
      )}
      <line x1={ORIGIN_X} y1={CY} x2={end + 10} y2={CY} className="learn-axis" />
      <polyline points={line.join(' ')} className="learn-twist" />
      <path d={`M${end + 6} ${CY + arc}A${arc / 3} ${arc} 0 0 0 ${end + 6} ${CY - arc}m6 -4l-6 4 6 4`} className="learn-load" />
    </svg>
  )
}

/** End view of the free end: the section, the unloaded mark (dashed) and the twisted mark. */
function ShaftEnd({ input, kind }: { input: ShaftInput; kind: TorsionDemoKind }) {
  const r = shaftResponse(input)
  const R = (mToMm(r.outerDiameterM) * PX_PER_MM) / 2
  const bore = (mToMm(r.innerDiameterM) * PX_PER_MM) / 2
  const turned = radToDeg(drawnTwist(input, kind)).toFixed(1)
  return (
    <svg className="learn-section" viewBox="-45 -45 90 90" aria-hidden="true">
      <circle r={R} className="learn-section-shape" />
      {bore > 0 && <circle r={bore} className="learn-bore" />}
      <line x1={0} y1={-bore} x2={0} y2={-R - 4} className="learn-axis" />
      <line x1={0} y1={-bore} x2={0} y2={-R} className="learn-twist-mark" transform={`rotate(${turned})`} />
    </svg>
  )
}

const NOTE = `${DEMO_SHAFT_MATERIAL.label} shaft (shear modulus ${(DEMO_SHAFT_MATERIAL.shearModulusPa / 1e9).toFixed(0)} GPa) fixed at one end with a steady torque at the other, idealized as in Torsion Shaft I. Twist is drawn exaggerated.`

function TorqueDemo() {
  const [torqueNm, setTorque] = useState<number>(TORSION_DEMO_DEFAULTS.torqueNm)
  const input = baseShaft({ torqueNm })
  const r = shaftResponse(input)
  return (
    <>
      <Slider label="Torque" value={torqueNm} unit="N·m" {...TORSION_DEMO_DEFAULTS.torque} onChange={setTorque} />
      <div className="learn-section-row">
        <ShaftDiagram input={input} kind="torsion-torque" pxPerM={260} torqueScale={torqueNm / TORSION_DEMO_DEFAULTS.torque.max} />
        <ShaftEnd input={input} kind="torsion-torque" />
      </div>
      <Readout rows={[['Torque', `${torqueNm} N·m`], ['Angle of twist', deg(r.twistRad)], ['Peak shear stress', mpa(r.maxShearStressPa)]]} />
    </>
  )
}

function LengthDemo() {
  const [lengthM, setLength] = useState<number>(TORSION_DEMO_DEFAULTS.lengthM)
  const input = baseShaft({ lengthM })
  const r = shaftResponse(input)
  return (
    <>
      <Slider label="Length" value={lengthM} unit="m" {...TORSION_DEMO_DEFAULTS.length} onChange={setLength} />
      <ShaftDiagram input={input} kind="torsion-length" pxPerM={140} />
      <Readout rows={[['Length', `${lengthM} m`], ['Angle of twist', deg(r.twistRad)], ['Peak shear stress', mpa(r.maxShearStressPa)]]} />
    </>
  )
}

function DiameterDemo() {
  const [diameterMm, setDiameter] = useState<number>(TORSION_DEMO_DEFAULTS.diameterMm)
  const input = baseShaft({ section: solidSection(diameterMm) })
  const r = shaftResponse(input)
  return (
    <>
      <Slider label="Diameter" value={diameterMm} unit="mm" {...TORSION_DEMO_DEFAULTS.diameter} onChange={setDiameter} />
      <div className="learn-section-row">
        <ShaftDiagram input={input} kind="torsion-diameter" pxPerM={260} />
        <ShaftEnd input={input} kind="torsion-diameter" />
      </div>
      <Readout
        rows={[
          ['Diameter', `${diameterMm} mm`],
          ['Polar moment J', mm4(r.polarMomentM4)],
          ['Angle of twist', deg(r.twistRad)],
          ['Peak shear stress', mpa(r.maxShearStressPa)],
        ]}
      />
    </>
  )
}

function HollowDemo() {
  const [sectionId, setSection] = useState<DemoShaftSection['id']>(TORSION_DEMO_DEFAULTS.sectionId)
  const input = baseShaft({ section: demoShaftSection(sectionId).section })
  const r = shaftResponse(input)
  return (
    <>
      <Choice legend="Cross-section (314 mm² each)" options={DEMO_SHAFT_SECTIONS} value={sectionId} onChange={setSection} />
      <div className="learn-section-row">
        <ShaftDiagram input={input} kind="torsion-hollow" pxPerM={260} />
        <ShaftEnd input={input} kind="torsion-hollow" />
      </div>
      <Readout
        rows={[
          ['Area', mm2(r.areaM2)],
          ['Polar moment J', mm4(r.polarMomentM4)],
          ['Angle of twist', deg(r.twistRad)],
          ['Peak shear stress', mpa(r.maxShearStressPa)],
        ]}
      />
    </>
  )
}

function StressDemo() {
  const input = baseShaft()
  const r = shaftResponse(input)
  const outerMm = mToMm(r.outerDiameterM) / 2
  const [radiusMm, setRadius] = useState<number>(TORSION_DEMO_DEFAULTS.radius.min)
  const here = shearStressAt(input, radiusMm / outerMm)
  const R = outerMm * PX_PER_MM
  const y = -radiusMm * PX_PER_MM
  const width = 36 * (here / r.maxShearStressPa)
  return (
    <>
      <Slider label="Distance from the centre" value={radiusMm} unit="mm" {...TORSION_DEMO_DEFAULTS.radius} onChange={setRadius} />
      <div className="learn-section-row">
        <ShaftDiagram input={input} kind="torsion-stress" pxPerM={260} />
        <svg className="learn-section" viewBox="-45 -45 90 90" aria-hidden="true">
          <circle r={R} className="learn-section-shape" />
          <path d={`M0 0L36 ${-R}H0ZM0 0L-36 ${R}H0Z`} className="learn-stress-profile" />
          <line x1={0} y1={-R - 4} x2={0} y2={R + 4} className="learn-axis" />
          <line x1={-40} y1={y} x2={40} y2={y} className="learn-marker" />
          <circle cx={width} cy={y} r={2.5} className="learn-dot" />
        </svg>
      </div>
      <Readout
        rows={[
          ['Distance from the centre', `${radiusMm} mm of ${outerMm} mm`],
          ['Shear stress here', mpa(here)],
          ['Shear stress at the surface', mpa(r.maxShearStressPa)],
          ['Shaft diameter', mm(r.outerDiameterM)],
        ]}
      />
    </>
  )
}

/** Demo components by kind; each renders its controls, drawing, readout and model note. */
export const TORSION_DEMOS: Readonly<Record<TorsionDemoKind, () => ReactNode>> = {
  'torsion-torque': () => <><TorqueDemo /><DemoNote text={NOTE} /></>,
  'torsion-length': () => <><LengthDemo /><DemoNote text={NOTE} /></>,
  'torsion-diameter': () => <><DiameterDemo /><DemoNote text={NOTE} /></>,
  'torsion-hollow': () => <><HollowDemo /><DemoNote text={NOTE} /></>,
  'torsion-stress': () => <><StressDemo /><DemoNote text={NOTE} /></>,
}
