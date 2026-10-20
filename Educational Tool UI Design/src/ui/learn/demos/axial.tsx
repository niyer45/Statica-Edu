import { useState, type ReactNode } from 'react'
import {
  AXIAL_DEMO_DEFAULTS,
  AXIAL_DEMO_MATERIALS,
  baseRod,
  demoMaterial,
  demoMaxElongationM,
  rodResponse,
  strainOf,
  stressForStrain,
  yieldStrain,
  type DemoMaterialId,
} from '../../../learn/axialDemo'
import type { AxialDemoKind } from '../../../learn/types'
import { Choice, DemoNote, Readout, Slider } from './controls'
import './axial.css'

// Stress and strain demonstrations (task 72; SSL-02–SSL-04, LRN-09). Every value comes from
// learn/axialDemo (the shared physics layer); this file only scales it for drawing and formats it.
// Drawings are decorative (aria-hidden) and each demo has a text readout of every value it draws.
// A state beyond yield is labelled in text and its linear-model numbers are not shown as real.
// The small Readout/Slider/Choice helpers mirror the beam demos' private ones.

const mm = (m: number) => `${(m * 1000).toFixed(2)} mm`
const mpa = (pa: number) => `${(pa / 1e6).toFixed(1)} MPa`
const gpa = (pa: number) => `${(pa / 1e9).toFixed(0)} GPa`
const mm2 = (m2: number) => `${(m2 * 1e6).toFixed(1)} mm²`
const pct = (strain: number) => `${(strain * 100).toFixed(3)} %`
const BEYOND = 'Beyond yield: not modeled'

/** Pixel stretch that a demo's largest possible elongation is drawn at (exaggerated). */
const MAX_STRETCH_PX = 36
const ROD_TOP = 22

/**
 * A rod hanging from a support with a load block: width to a fixed scale, length `lengthPx` (not to
 * scale), stretched by `stretchPx` (exaggerated). A dashed line marks the unstretched end; a rod
 * past yield gets a dashed outline (the readout says why).
 */
function RodDiagram({ diameterM, lengthPx, stretchPx, beyondYield = false, children }: { diameterM: number; lengthPx: number; stretchPx: number; beyondYield?: boolean; children?: ReactNode }) {
  const cx = 60
  const width = Math.max(diameterM * 1600, 2)
  const end = ROD_TOP + lengthPx + stretchPx
  return (
    <svg className="learn-diagram learn-rod-diagram" viewBox={`0 0 120 ${Math.max(150, end + 46)}`} aria-hidden="true">
      <rect x={20} y={6} width={80} height={12} className="learn-wall" />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={24 + i * 16} y1={18} x2={34 + i * 16} y2={6} className="learn-hatch" />
      ))}
      <rect x={cx - width / 2} y={ROD_TOP - 4} width={width} height={lengthPx + stretchPx + 4} className={beyondYield ? 'learn-rod learn-rod-yielded' : 'learn-rod'} />
      <line x1={cx - width / 2 - 8} y1={ROD_TOP + lengthPx} x2={cx + width / 2 + 8} y2={ROD_TOP + lengthPx} className="learn-unstretched" />
      <rect x={cx - 16} y={end} width={32} height={18} rx={2} className="learn-weight" />
      <path d={`M${cx} ${end + 22}v14m-5-7 5 7 5-7`} className="learn-load" />
      {children}
    </svg>
  )
}

const stretchPx = (elongationM: number, kind: AxialDemoKind) => (elongationM / demoMaxElongationM(kind)) * MAX_STRETCH_PX

function AreaDemo() {
  const [diameterMm, setDiameter] = useState(AXIAL_DEMO_DEFAULTS.diameterM * 1000)
  const input = baseRod({ diameterM: diameterMm / 1000 })
  const r = rodResponse(input)
  return (
    <>
      <Slider label="Diameter" value={diameterMm} unit="mm" {...AXIAL_DEMO_DEFAULTS.diameterMm} onChange={setDiameter} />
      <div className="learn-section-row">
        <svg className="learn-section" viewBox="-45 -45 90 90" aria-hidden="true">
          <circle r={(input.diameterM * 1000 * 36) / AXIAL_DEMO_DEFAULTS.diameterMm.max} className="learn-section-shape" />
        </svg>
        <RodDiagram diameterM={input.diameterM} lengthPx={100} stretchPx={stretchPx(r.elongationM, 'axial-area')} beyondYield={r.beyondYield} />
      </div>
      <Readout
        rows={[
          ['Load', `${input.forceN / 1000} kN`],
          ['Diameter', `${diameterMm} mm`],
          ['Area', mm2(r.areaM2)],
          ['Stress', mpa(r.stressPa)],
          ['Elongation', r.beyondYield ? BEYOND : mm(r.elongationM)],
          ['State (steel)', r.beyondYield ? BEYOND : 'Elastic, below yield'],
        ]}
      />
    </>
  )
}

function StrainDemo() {
  const [elongationMm, setElongation] = useState(1)
  const [lengthM, setLength] = useState(AXIAL_DEMO_DEFAULTS.strainLengths[1]!)
  const strain = strainOf(elongationMm / 1000, lengthM)
  const steel = demoMaterial('steel')
  const needed = stressForStrain(strain, steel)
  const lengths = AXIAL_DEMO_DEFAULTS.strainLengths.map((l) => ({ id: l, label: `${l} m rod` }))
  return (
    <>
      <Slider label="Stretch" value={elongationMm} unit="mm" {...AXIAL_DEMO_DEFAULTS.elongationMm} onChange={setElongation} />
      <Choice legend="Rod length" options={lengths} value={lengthM} onChange={setLength} />
      <RodDiagram diameterM={AXIAL_DEMO_DEFAULTS.diameterM} lengthPx={lengthM * 50} stretchPx={stretchPx(elongationMm / 1000, 'axial-strain')} beyondYield={needed.beyondYield} />
      <Readout
        rows={[
          ['Stretch δ', `${elongationMm} mm`],
          ['Length L', `${lengthM} m`],
          ['Strain ε = δ ÷ L', pct(strain)],
          ['Stress this needs in steel', needed.beyondYield ? BEYOND : mpa(needed.stressPa)],
        ]}
      />
    </>
  )
}

function HookeDemo() {
  const [materialId, setMaterial] = useState<DemoMaterialId>('steel')
  const material = demoMaterial(materialId)
  const r = rodResponse(baseRod({ material }))
  return (
    <>
      <Choice legend="Material" options={AXIAL_DEMO_MATERIALS.map((m) => ({ id: m.id, label: m.label }))} value={materialId} onChange={setMaterial} />
      <RodDiagram diameterM={AXIAL_DEMO_DEFAULTS.diameterM} lengthPx={100} stretchPx={stretchPx(r.elongationM, 'axial-hooke')} />
      <Readout
        rows={[
          ["Young's modulus E", gpa(material.elasticModulusPa)],
          ['Stress', mpa(r.stressPa)],
          ['Strain', pct(r.strain)],
          ['Elongation', mm(r.elongationM)],
        ]}
      />
    </>
  )
}

const DASHES: Readonly<Record<DemoMaterialId, string | undefined>> = { steel: undefined, aluminium: '6 3', titanium: '2 3' }

function YieldDemo() {
  const [forceKn, setForce] = useState(AXIAL_DEMO_DEFAULTS.forceN / 1000)
  const responses = AXIAL_DEMO_MATERIALS.map((m) => ({ m, r: rodResponse(baseRod({ forceN: forceKn * 1000, material: m })) }))
  const stressPa = responses[0]!.r.stressPa
  // Chart: strain → x (0 … 1.1 × the largest yield strain), stress → y (0 … 1.1 × the largest yield strength).
  const maxStrain = 1.1 * Math.max(...AXIAL_DEMO_MATERIALS.map(yieldStrain))
  const maxStress = 1.1 * Math.max(...AXIAL_DEMO_MATERIALS.map((m) => m.yieldStressPa))
  const X0 = 26
  const Y0 = 130
  const W = 260
  const H = 116
  const px = (strain: number) => X0 + (strain / maxStrain) * W
  const py = (stress: number) => Y0 - (stress / maxStress) * H
  return (
    <>
      <Slider label="Load" value={forceKn} unit="kN" {...AXIAL_DEMO_DEFAULTS.forceKn} onChange={setForce} />
      <svg className="learn-diagram learn-chart" viewBox="0 0 300 140" aria-hidden="true">
        <line x1={X0} y1={Y0} x2={X0 + W} y2={Y0} className="learn-axis" />
        <line x1={X0} y1={Y0} x2={X0} y2={Y0 - H} className="learn-axis" />
        {AXIAL_DEMO_MATERIALS.map((m) => (
          <g key={m.id}>
            <line x1={px(0)} y1={py(0)} x2={px(yieldStrain(m))} y2={py(m.yieldStressPa)} className="learn-curve" strokeDasharray={DASHES[m.id]} />
            <circle cx={px(yieldStrain(m))} cy={py(m.yieldStressPa)} r={3} className="learn-yield-point" />
          </g>
        ))}
        <line x1={X0} y1={py(stressPa)} x2={X0 + W} y2={py(stressPa)} className="learn-marker" />
      </svg>
      <ul className="learn-legend" aria-label="Chart lines">
        {AXIAL_DEMO_MATERIALS.map((m) => (
          <li key={m.id}>
            <svg viewBox="0 0 24 6" aria-hidden="true">
              <line x1={0} y1={3} x2={24} y2={3} className="learn-curve" strokeDasharray={DASHES[m.id]} />
            </svg>
            {m.label}: straight line up to its yield point (circle)
          </li>
        ))}
        <li>Horizontal line: the stress in the rod now</li>
      </ul>
      <Readout
        rows={[
          ['Load', `${forceKn} kN on a 10 mm rod`],
          ['Stress (same in every material)', mpa(stressPa)],
          ...responses.map(({ m, r }): [string, string] => [
            `${m.label}: yield ${mpa(m.yieldStressPa)}, E ${gpa(m.elasticModulusPa)}`,
            r.beyondYield ? BEYOND : `Elastic, strain ${pct(r.strain)}`,
          ]),
        ]}
      />
    </>
  )
}

function LengthDemo() {
  const [lengthM, setLength] = useState<number>(AXIAL_DEMO_DEFAULTS.lengthM)
  const r = rodResponse(baseRod({ lengthM }))
  return (
    <>
      <Slider label="Length" value={lengthM} unit="m" {...AXIAL_DEMO_DEFAULTS.lengthRange} onChange={setLength} />
      <RodDiagram diameterM={AXIAL_DEMO_DEFAULTS.diameterM} lengthPx={lengthM * 30} stretchPx={stretchPx(r.elongationM, 'axial-length')} />
      <Readout
        rows={[
          ['Length', `${lengthM} m`],
          ['Stress', mpa(r.stressPa)],
          ['Strain', pct(r.strain)],
          ['Elongation', mm(r.elongationM)],
        ]}
      />
    </>
  )
}

const NOTE = 'Straight round steel rod in tension unless chosen otherwise, linear elastic up to yield, as in Stress and Strain I. Rod length not to scale; stretch drawn exaggerated. Typical textbook material values.'

/** Demo components by kind; each renders its controls, drawing, readout and model note. */
export const AXIAL_DEMOS: Readonly<Record<AxialDemoKind, () => ReactNode>> = {
  'axial-area': () => <><AreaDemo /><DemoNote text={NOTE} /></>,
  'axial-strain': () => <><StrainDemo /><DemoNote text={NOTE} /></>,
  'axial-hooke': () => <><HookeDemo /><DemoNote text={NOTE} /></>,
  'axial-yield': () => <><YieldDemo /><DemoNote text={NOTE} /></>,
  'axial-length': () => <><LengthDemo /><DemoNote text={NOTE} /></>,
}

