import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import { sectionOutline } from '../../geometry/outline'
import { orientedEnvelope } from '../../geometry/envelope'
import { PARAM_LABELS, SECTION_PARAMS } from '../../geometry/params'
import type { Section } from '../../geometry/sections'
import { formatMm, mToMm } from '../../units/units'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { useSession } from '../state/store'
import { buildBeamGeometry } from '../mesh'
import Workbench from './Workbench'

// Milestone 2 gate (task 18, Requirement 33.8). Real Workbench + palette + numeric controls +
// lazy viewport/fallback, with the rendered geometry checked against the same typed state.
let state: ReturnType<typeof useSession>
function Probe() { state = useSession(); return null }
const profiles: { tile: string; section: Section }[] = [
  { tile: 'Solid circle', section: { kind: 'circle', diameterM: 0.04 } },
  { tile: 'Hollow circle', section: { kind: 'tube', outerDiameterM: 0.05, innerDiameterM: 0.03 } },
  { tile: 'Rectangle', section: { kind: 'rectangle', widthM: 0.025, heightM: 0.045 } },
  { tile: 'I-section', section: { kind: 'iSection', widthM: 0.04, heightM: 0.06, flangeThicknessM: 0.004, webThicknessM: 0.0035 } },
]
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Milestone 2 component gate', () => {
  it.each(profiles)('$section.kind: editable fields, SVG view and Three mesh agree with typed state', async ({ tile, section }) => {
    vi.stubGlobal('WebGL2RenderingContext', undefined)
    const boot = bootstrap(bundledChallengeResult, () => '2026-10-15T00:00:00.000Z', () => 'baseline')
    if (!boot.ok) throw new Error(boot.error.message)
    render(<StoreProvider challenge={boot.value.challenge} initialSession={boot.value.session}>
      <Workbench onExit={() => {}} /><Probe />
    </StoreProvider>)
    await screen.findByRole('img', { name: '2D section view' }, { timeout: 5000 })
    const history = state.history
    const deformation = screen.getByTestId('fallback-deformation').innerHTML
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${tile}`) }))
    const values = section as unknown as Record<string, number>
    for (const param of SECTION_PARAMS[section.kind]) {
      const input = screen.getByRole('spinbutton', { name: new RegExp(`^${PARAM_LABELS[param]}`) }) as HTMLInputElement
      fireEvent.change(input, { target: { value: String(mToMm(values[param])) } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(input.getAttribute('aria-invalid')).toBeNull()
    }
    expect(state.draft.section).toEqual(section)
    const orientations = section.kind === 'circle' || section.kind === 'tube' ? [0] as const : [0, 90] as const
    for (const orientation of orientations) {
      if (orientation === 90) fireEvent.click(screen.getByRole('radio', { name: '90°' }))
      expect(state.draft.orientationDeg).toBe(orientation)
      expect(screen.getAllByRole('spinbutton')).toHaveLength(SECTION_PARAMS[section.kind].length)
      for (const param of SECTION_PARAMS[section.kind]) {
        const label = PARAM_LABELS[param]
        const input = screen.getByRole('spinbutton', { name: new RegExp(`^${label}`) }) as HTMLInputElement
        expect(input.value).toBe(formatMm(values[param]))
        expect(screen.getByTestId('scene-summary').textContent).toContain(`${label} ${formatMm(values[param])} mm`)
      }
      const shape = sectionOutline(state.draft.section)
      const expected = [shape.outer, ...shape.holes].map((contour) => contour.map((p, i) => {
        const y = orientation === 0 ? p.v : p.u
        const z = orientation === 0 ? p.u : -p.v
        return `${i ? 'L' : 'M'}${mToMm(z)} ${-mToMm(y)}`
      }).join(' ') + ' Z').join(' ')
      expect(screen.getByTestId('fallback-section-outline').getAttribute('d')).toBe(expected)
      const env = orientedEnvelope(section, orientation)
      expect(screen.getByTestId('scene-summary').textContent).toContain(`Envelope ${formatMm(env.widthZM)} mm wide (Z) by ${formatMm(env.heightYM)} mm high (Y)`)
      const mesh = buildBeamGeometry(section, orientation, state.draft.lengthM)
      try {
        const bounds = mesh.boundingBox!
        expect(bounds.max.x - bounds.min.x).toBeCloseTo(state.draft.lengthM, 6)
        expect(bounds.max.y - bounds.min.y).toBeCloseTo(env.heightYM, 6)
        expect(bounds.max.z - bounds.min.z).toBeCloseTo(env.widthZM, 6)
      } finally { mesh.dispose() }
    }
    expect(state.history).toBe(history)
    expect(screen.getByTestId('fallback-deformation').innerHTML).toBe(deformation)
    const designTools = screen.getByRole('region', { name: 'Design tools' })
    expect(within(designTools).getAllByText('Fixed by challenge')).toHaveLength(4)
    // Results/prediction are Milestone 3; the M2 editing gate must not enable them prematurely.
    expect((screen.getByRole('button', { name: /Run test/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})
