import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import type { SectionKind } from '../../challenge/types'
import { SECTION_PARAMS, PARAM_LABELS } from '../../geometry/params'
import { bundledChallengeResult } from '../../challenge/content'
import { circleStartChallenge } from '../../../test/arbitraries'
import { formatMm, mToMm } from '../../units/units'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { useDispatch, useSession } from '../state/store'
import NumericControls from './NumericControls'

// Tasks 17.1/17.2: typed fields, strict rejection, coupled slider edits and locked controls.

const clock = () => '2025-01-01T00:00:00.000Z'
const newId = () => 'baseline-id'

let latest: ReturnType<typeof useSession> | null = null
let dispatch: ReturnType<typeof useDispatch> | null = null
function Probe() {
  latest = useSession()
  dispatch = useDispatch()
  return null
}

/** Starts from a Ø30 mm circle (these tests exercise circle/tube editing); see bundled() below. */
function setup(challenge: typeof bundledChallengeResult = { ok: true, value: circleStartChallenge() }) {
  const boot = bootstrap(challenge, clock, newId)
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
  it('starts the bundled challenge on its sideways I-section baseline with 90° selected', () => {
    setup(bundledChallengeResult)
    for (const [name, mm] of [[/^Width/, '36.50'], [/^Height/, '84.00'], [/^Flange thickness/, '3.00'], [/^Web thickness/, '7.00']] as const) expect(field(name).value).toBe(mm)
    expect((screen.getByRole('radio', { name: '90°' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('radio', { name: '90°' }) as HTMLInputElement).disabled).toBe(false)
  })

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


describe('numeric controls component suite (17.2)', () => {
  it.each(['circle', 'tube', 'rectangle', 'iSection'] as SectionKind[])('%s fields match every typed parameter before and after edits/orientation changes', async (kind) => {
    setup()
    act(() => dispatch!({ type: 'applySection', kind }))
    const params = SECTION_PARAMS[kind]
    expect(screen.getAllByRole('spinbutton')).toHaveLength(params.length)
    for (const param of params) {
      const input = screen.getByRole('spinbutton', { name: new RegExp(`^${PARAM_LABELS[param]}`) }) as HTMLInputElement
      expect(input.value).toBe(formatMm(section()[param]!))
      expect(input.getAttribute('aria-invalid')).toBeNull()
      expect(input.min).not.toBe('')
      expect(input.max).not.toBe('')
      expect(Number(input.step)).toBe(0.5)
    }
    const first = params[0]!
    const input = screen.getByRole('spinbutton', { name: new RegExp(`^${PARAM_LABELS[first]}`) }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '35' } })
    fireEvent.blur(input)
    expect(section()[first]).toBeCloseTo(0.035, 12)
    expect(input.value).toBe('35.00')
    const before = latest!.draft.section
    if (kind === 'rectangle' || kind === 'iSection') {
      fireEvent.click(screen.getByRole('radio', { name: '90°' }))
      expect(latest!.draft.orientationDeg).toBe(90)
      expect(latest!.draft.section).toEqual(before)
    } else {
      const user = userEvent.setup()
      for (const radio of screen.getAllByRole('radio')) {
        expect((radio as HTMLInputElement).disabled).toBe(true)
        expect(radio.getAttribute('tabindex')).toBe('-1')
        await user.click(radio)
      }
      expect(latest!.draft.orientationDeg).toBe(0)
    }
    for (const param of params) {
      const input = screen.getByRole('spinbutton', { name: new RegExp(`^${PARAM_LABELS[param]}`) }) as HTMLInputElement
      expect(input.value).toBe(formatMm(section()[param]!))
    }
  })

  it.each(['', 'abc', 'Infinity', '12abc', '1,200', '-1', '1000'])('rejects invalid input %j once, links the error, and Escape restores the value', (text) => {
    const { onAnnounce } = setup()
    const input = field(/^Diameter/)
    const before = latest!
    fireEvent.change(input, { target: { value: text } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(latest!.draft).toBe(before.draft)
    expect(latest!.draftStatus).toBe(before.draftStatus)
    expect(latest!.history).toBe(before.history)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const error = document.getElementById(input.getAttribute('aria-describedby')!)
    expect(error?.textContent).toContain('Diameter')
    expect(onAnnounce).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('30.00')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.hasAttribute('aria-describedby')).toBe(false)
    expect(latest!.draft).toBe(before.draft)
  })

  it('rejects a tube inner diameter at/above D and too-thin walls, then clears the error on a valid strict set', () => {
    const { onAnnounce } = setup()
    act(() => dispatch!({ type: 'applySection', kind: 'tube' }))
    const input = field(/^Inner diameter/)
    const before = latest!.draft
    for (const value of ['30', '31', '29']) {
      fireEvent.change(input, { target: { value } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(latest!.draft).toBe(before)
      expect(input.getAttribute('aria-invalid')).toBe('true')
    }
    expect(onAnnounce).toHaveBeenCalledTimes(3)
    fireEvent.change(input, { target: { value: '20' } })
    fireEvent.blur(input)
    expect(section().innerDiameterM).toBeCloseTo(0.02, 12)
    expect(input.value).toBe('20.00')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.hasAttribute('aria-describedby')).toBe(false)
  })

  it('resynchronizes coupled tube fields after an outer-diameter slider shrink', () => {
    setup()
    act(() => dispatch!({ type: 'applySection', kind: 'tube' }))
    const history = latest!.history
    fireEvent.change(screen.getByRole('slider', { name: 'Outer diameter slider' }), { target: { value: '10' } })
    expect(section().outerDiameterM).toBeCloseTo(0.01, 12)
    expect(section().innerDiameterM).toBeCloseTo(0.006, 12)
    expect(field(/^Outer diameter/).value).toBe('10.00')
    expect(field(/^Inner diameter/).value).toBe('6.00')
    expect(latest!.history).toBe(history)
    expect(latest!.draftErrors).toEqual([])
  })

  it('rejects an I-section flange overlap and keeps web/flange text independent', () => {
    setup()
    act(() => dispatch!({ type: 'applySection', kind: 'iSection' }))
    const before = latest!.draft
    const flange = field(/^Flange thickness/)
    fireEvent.change(flange, { target: { value: '15' } })
    fireEvent.blur(flange)
    expect(latest!.draft).toBe(before)
    expect(flange.getAttribute('aria-invalid')).toBe('true')
    expect(field(/^Web thickness/).value).toBe('4.00')
    fireEvent.keyDown(flange, { key: 'Escape' })
    fireEvent.change(field(/^Web thickness/), { target: { value: '6' } })
    fireEvent.keyDown(field(/^Web thickness/), { key: 'Enter' })
    expect(field(/^Web thickness/).value).toBe('6.00')
    expect(flange.value).toBe('4.00')
  })

  it('prevents keyboard and paste changes to every readonly challenge field', async () => {
    setup()
    const user = userEvent.setup()
    const before = latest!
    const disclosure = screen.getByText('Some things are fixed.').closest('details')!
    expect(disclosure.open).toBe(false)
    expect(screen.queryByText('are part of the challenge.')).toBeNull()
    fireEvent.click(screen.getByText('Some things are fixed.'))
    expect(disclosure.open).toBe(true)
    for (const label of ['Span', 'Material', 'Load', 'Support']) {
      const input = screen.getByRole('textbox', { name: label }) as HTMLInputElement
      const value = input.value
      expect(input.readOnly).toBe(true)
      expect(input.getAttribute('aria-readonly')).toBe('true')
      await user.type(input, '999')
      await user.paste('replacement')
      expect(input.value).toBe(value)
      expect(latest).toBe(before)
      expect(screen.getByRole('img', { name: `${label} is fixed by the challenge` })).toBeTruthy()
    }
  })
})
