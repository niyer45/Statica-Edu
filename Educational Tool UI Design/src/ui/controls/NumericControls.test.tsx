import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import { formatMm, mToMm } from '../../units/units'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { useDispatch, useSession } from '../state/store'
import NumericControls from './NumericControls'

// Task 17.1 smoke tests (full component tests: task 17.2). The bundled baseline is a circle.

const clock = () => '2025-01-01T00:00:00.000Z'
const newId = () => 'baseline-id'

let latest: ReturnType<typeof useSession> | null = null
let dispatch: ReturnType<typeof useDispatch> | null = null
function Probe() {
  latest = useSession()
  dispatch = useDispatch()
  return null
}

function setup() {
  const boot = bootstrap(bundledChallengeResult, clock, newId)
  if (!boot.ok) throw new Error(boot.error.message)
  const onAnnounce = vi.fn()
  render(
    <StoreProvider challenge={boot.value.challenge} initialSession={boot.value.session} clock={clock} newId={newId}>
      <NumericControls onAnnounce={onAnnounce} />
      <Probe />
    </StoreProvider>,
  )
  return { onAnnounce, challenge: boot.value.challenge }
}

afterEach(() => {
  cleanup()
  latest = null
  dispatch = null
})

const section = () => latest!.draft.section as unknown as Record<string, number>
const field = (name: RegExp) => screen.getByLabelText(name, { selector: 'input[type="number"]' }) as HTMLInputElement

describe('NumericControls', () => {
  it('renders one mm field per draft parameter with challenge min/max/step', () => {
    const { challenge } = setup()
    const d = field(/^Diameter/)
    const r = challenge.sectionLimits.circle.diameterM
    expect(d.value).toBe(formatMm(section().diameterM))
    expect(Number(d.min)).toBe(mToMm(r.minM))
    expect(Number(d.max)).toBe(mToMm(r.maxM))
    expect(Number(d.step)).toBe(mToMm(r.stepM))
    expect(screen.getAllByText('Fixed by challenge')).toHaveLength(4)
    // Circle: orientation radios disabled and out of tab order (Req 7.4).
    for (const radio of screen.getAllByRole('radio')) {
      expect((radio as HTMLInputElement).disabled).toBe(true)
      expect(radio.getAttribute('tabindex')).toBe('-1')
    }
  })

  it('commits on Enter (strict), shows an error for invalid text, and Escape reverts', () => {
    const { onAnnounce } = setup()
    const d = field(/^Diameter/)
    const before = latest!.draft

    fireEvent.change(d, { target: { value: '1000' } })
    fireEvent.keyDown(d, { key: 'Enter' })
    expect(latest!.draft).toBe(before)
    expect(d.getAttribute('aria-invalid')).toBe('true')
    const errorId = d.getAttribute('aria-describedby')
    expect(errorId && document.getElementById(errorId)?.textContent).toMatch(/Diameter/)
    expect(onAnnounce).toHaveBeenCalledTimes(1)
    fireEvent.blur(d) // same rejected text: no second announcement
    expect(onAnnounce).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(d, { key: 'Escape' })
    expect(d.getAttribute('aria-invalid')).toBeNull()
    expect(d.value).toBe(formatMm(section().diameterM))

    fireEvent.change(d, { target: { value: '40' } })
    fireEvent.keyDown(d, { key: 'Enter' })
    expect(section().diameterM).toBeCloseTo(0.04, 12)
    expect(d.value).toBe('40.00')
  })

  it('shows separate I-section thickness fields and sets orientation without changing the section', () => {
    setup()
    act(() => dispatch!({ type: 'applySection', kind: 'iSection' }))
    for (const name of [/^Width/, /^Height/, /^Flange thickness/, /^Web thickness/]) expect(field(name)).toBeTruthy()
    const s = latest!.draft.section
    fireEvent.click(screen.getByRole('radio', { name: '90°' }))
    expect(latest!.draft.orientationDeg).toBe(90)
    expect(latest!.draft.section).toEqual(s)
  })
})
