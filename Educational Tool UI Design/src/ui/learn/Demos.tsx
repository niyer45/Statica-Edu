import { useId, useState, type ReactNode } from 'react'
import { sectionOutline } from '../../geometry/outline'
import type { Vec2 } from '../../geometry/sections'
import {
  baseInput,
  cantileverResponse,
  deflectedShape,
  DEMO_DEFAULTS,
  DEMO_MATERIALS,
  DEMO_SECTIONS,
  demoMaterial,
  demoMaxDeflectionM,
  demoSection,
  momentAt,
  stressAt,
  type CantileverInput,
  type DemoMaterial,
  type DemoSection,
} from '../../learn/beamDemo'
import type { DemoKind } from '../../learn/types'

// Interactive demonstrations for the Beam bending module (task 67; LRN-04, LRN-05, LRN-09). Every
// value comes from learn/beamDemo (the physics layer); this file only scales it for drawing and
// formats it. Each drawing is decorative and has a text readout of every value it shows.

const mm = (m: number) => `${(m * 1000).toFixed(1)} mm`
const mpa = (pa: number) => `${(pa / 1e6).toFixed(1)} MPa`
const nm = (v: number) => `${v.toFixed(0)} N·m`
const mm4 = (m4: number) => `${Math.round(m4 * 1e12).toLocaleString('en-US')} mm⁴`
const mm2 = (m2: number) => `${Math.round(m2 * 1e6).toLocaleString('en-US')} mm²`

/** Pixel height that the demo's largest possible deflection is drawn at. */
const MAX_DROP_PX = 70
const ORIGIN = { x: 34, y: 52 }

function Readout({ rows }: { rows: readonly [string, string][] }) {
  return (
    <dl className="learn-readout">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Side view of the cantilever: wall, unloaded outline, exaggerated deflected shape and tip load. */
function CantileverDiagram({ input, kind, pxPerM, arrowScale = 1, children }: { input: CantileverInput; kind: DemoKind; pxPerM: number; arrowScale?: number; children?: ReactNode }) {
  const drop = MAX_DROP_PX / demoMaxDeflectionM(kind)
  const points = deflectedShape(input).map((p) => [ORIGIN.x + p.xM * pxPerM, ORIGIN.y + p.deflectionM * drop] as const)
  const [tipX, tipY] = points[points.length - 1]!
  const arrow = 22 + 22 * arrowScale
  return (
    <svg className="learn-diagram" viewBox="0 0 360 150" aria-hidden="true">
      <rect x={ORIGIN.x - 18} y={14} width={18} height={96} className="learn-wall" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1={ORIGIN.x - 18} y1={30 + i * 16} x2={ORIGIN.x - 4} y2={16 + i * 16} className="learn-hatch" />
      ))}
      <rect x={ORIGIN.x} y={ORIGIN.y - 5} width={input.lengthM * pxPerM} height={10} className="learn-unloaded" />
      {children}
      <polyline points={points.map((p) => p.join(',')).join(' ')} className="learn-beam" />
      <path d={`M${tipX} ${tipY - 7 - arrow}V${tipY - 7}m-5-7 5 7 5-7`} className="learn-load" />
    </svg>
  )
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  const id = useId()
  return (
    <div className="learn-slider">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={`${value} ${unit}`} onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor={id}>
        {value} {unit}
      </output>
    </div>
  )
}

function Choice<T extends string>({ legend, options, value, onChange }: { legend: string; options: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const name = useId()
  return (
    <fieldset className="learn-choice">
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.id}>
          <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  )
}

function LoadDemo() {
  const [forceN, setForce] = useState<number>(DEMO_DEFAULTS.forceN)
  const input = baseInput({ forceN })
  const r = cantileverResponse(input)
  return (
    <>
      <Slider label="Tip load" value={forceN} unit="N" {...DEMO_DEFAULTS.force} onChange={setForce} />
      <CantileverDiagram input={input} kind="load" pxPerM={280} arrowScale={forceN / DEMO_DEFAULTS.force.max} />
      <Readout rows={[['Tip load', `${forceN} N`], ['Tip deflection', mm(r.tipDeflectionM)]]} />
    </>
  )
}

function LengthDemo() {
  const [lengthM, setLength] = useState<number>(DEMO_DEFAULTS.lengthM)
  const input = baseInput({ lengthM })
  const r = cantileverResponse(input)
  return (
    <>
      <Slider label="Length" value={lengthM} unit="m" {...DEMO_DEFAULTS.length} onChange={setLength} />
      <CantileverDiagram input={input} kind="length" pxPerM={150} />
      <Readout rows={[['Length', `${lengthM} m`], ['Tip deflection', mm(r.tipDeflectionM)]]} />
    </>
  )
}

function MaterialDemo() {
  const [materialId, setMaterial] = useState<DemoMaterial['id']>('steel')
  const material = demoMaterial(materialId)
  const input = baseInput({ youngsModulusPa: material.youngsModulusPa })
  const r = cantileverResponse(input)
  return (
    <>
      <Choice legend="Material" options={DEMO_MATERIALS} value={materialId} onChange={setMaterial} />
      <CantileverDiagram input={input} kind="material" pxPerM={280} />
      <Readout rows={[["Young's modulus E", `${(material.youngsModulusPa / 1e9).toFixed(0)} GPa`], ['Tip deflection', mm(r.tipDeflectionM)]]} />
    </>
  )
}

const path = (pts: Vec2[], scale: number) => `M${pts.map((p) => `${(p.u * scale).toFixed(2)} ${(-p.v * scale).toFixed(2)}`).join('L')}Z`

function SectionDemo() {
  const [sectionId, setSection] = useState<DemoSection['id']>('flat')
  const section = demoSection(sectionId).section
  const input = baseInput({ section })
  const r = cantileverResponse(input)
  const outline = sectionOutline(section)
  const scale = 1100 // px per metre: 60 mm → 66 px
  return (
    <>
      <Choice legend="Cross-section (about 800 mm² each)" options={DEMO_SECTIONS} value={sectionId} onChange={setSection} />
      <div className="learn-section-row">
        <svg className="learn-section" viewBox="-45 -45 90 90" aria-hidden="true">
          <line x1={-44} y1={0} x2={44} y2={0} className="learn-axis" />
          <path d={[outline.outer, ...outline.holes].map((p) => path(p, scale)).join('')} fillRule="evenodd" className="learn-section-shape" />
        </svg>
        <CantileverDiagram input={input} kind="section" pxPerM={280} />
      </div>
      <Readout rows={[['Area', mm2(r.areaM2)], ['Second moment of area I', mm4(r.secondMomentM4)], ['Tip deflection', mm(r.tipDeflectionM)]]} />
    </>
  )
}

function StressDemo() {
  const input = baseInput()
  const L = input.lengthM
  const [xM, setX] = useState(L)
  const maxMoment = momentAt(input, 0)
  const pxPerM = 280
  const segments = 20
  const moment = momentAt(input, xM)
  const share = moment / maxMoment
  return (
    <>
      <Slider label="Position from the fixed end" value={xM} min={0} max={L} step={0.1} unit="m" onChange={(v) => setX(Math.round(v * 10) / 10)} />
      <div className="learn-section-row">
        <CantileverDiagram input={input} kind="stress" pxPerM={pxPerM}>
          {Array.from({ length: segments }, (_, i) => (
            <rect
              key={i}
              x={ORIGIN.x + (i * L * pxPerM) / segments}
              y={ORIGIN.y - 5}
              width={(L * pxPerM) / segments + 0.5}
              height={10}
              className="learn-moment"
              opacity={momentAt(input, ((i + 0.5) * L) / segments) / maxMoment}
            />
          ))}
          <line x1={ORIGIN.x + xM * pxPerM} y1={ORIGIN.y - 30} x2={ORIGIN.x + xM * pxPerM} y2={ORIGIN.y + 40} className="learn-marker" />
        </CantileverDiagram>
        <svg className="learn-section" viewBox="-45 -45 90 90" aria-hidden="true">
          <line x1={0} y1={-36} x2={0} y2={36} className="learn-axis" />
          <path d={`M0 -32H${(36 * share).toFixed(1)}L${(-36 * share).toFixed(1)} 32H0Z`} className="learn-stress-profile" />
        </svg>
      </div>
      <Readout
        rows={[
          ['Bending moment here', nm(moment)],
          ['Stress, top surface (tension)', mpa(Math.abs(stressAt(input, xM, 1)))],
          ['Stress, neutral axis', mpa(Math.abs(stressAt(input, xM, 0)))],
          ['Stress, bottom surface (compression)', mpa(Math.abs(stressAt(input, xM, -1)))],
        ]}
      />
    </>
  )
}

export default function Demo({ kind }: { kind: DemoKind }) {
  const body = { load: <LoadDemo />, length: <LengthDemo />, material: <MaterialDemo />, section: <SectionDemo />, stress: <StressDemo /> }[kind]
  return (
    <div className="learn-demo">
      {body}
      <p className="learn-demo-note">Cantilever with a tip load, idealized as in Cantilever Beam I. Deflection is drawn exaggerated.</p>
    </div>
  )
}
