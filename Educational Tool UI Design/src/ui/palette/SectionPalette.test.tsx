import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { useSession } from '../state/store'
import Viewport3D from '../viewport/Viewport3D'
import SectionPalette from './SectionPalette'
import { SECTION_DRAG_MIME } from './useSectionDrop'

// Tasks 15.1/15.2 (Req 26.1, 26.2, 26.4–26.7, 32.1). The bundled baseline draft is a solid circle.

const clock = () => '2025-01-01T00:00:00.000Z'
const newId = () => 'baseline-id'

let latest: ReturnType<typeof useSession> | null = null
function Probe() {
  latest = useSession()
  return null
}

function setup() {
  const boot = bootstrap(bundledChallengeResult, clock, newId)
  if (!boot.ok) throw new Error(boot.error.message)
  const { container } = render(
    <StoreProvider challenge={boot.value.challenge} initialSession={boot.value.session} clock={clock} newId={newId}>
      <SectionPalette />
      <Viewport3D />
      <Probe />
    </StoreProvider>,
  )
  const dropZone = container.querySelector('[data-section-drop-target]') as HTMLElement
  return { challenge: boot.value.challenge, dropZone }
}

/** Minimal DataTransfer stand-in (jsdom has none) carrying one payload. */
function transfer(type: string, value: string) {
  const data: Record<string, string> = { [type]: value }
  return { types: [type], getData: (t: string) => data[t] ?? '', setData: () => {}, dropEffect: 'none' }
}

afterEach(() => {
  cleanup()
  latest = null
})

const tile = (name: RegExp) => screen.getByRole('button', { name })
const pressed = () =>
  screen.getAllByRole('button').filter((b) => b.classList.contains('shape-tile') && b.getAttribute('aria-pressed') === 'true')

describe('SectionPalette', () => {
  it('renders one tile per allowed section with exactly one aria-pressed="true"', () => {
    const { challenge } = setup()
    const tiles = screen.getAllByRole('button').filter((b) => b.classList.contains('shape-tile'))
    expect(tiles).toHaveLength(challenge.allowedSections.length)
    expect(pressed()).toHaveLength(1)
    expect(pressed()[0].textContent).toContain('Active')
  })

  it('applies a section on click and keeps exactly one active tile', () => {
    setup()
    fireEvent.click(tile(/Rectangle/))
    expect(latest!.draft.section.kind).toBe('rectangle')
    expect(pressed()).toHaveLength(1)
    expect(pressed()[0].textContent).toMatch(/Rectangle/)
  })

  it('applies a section on Enter and keeps focus on the tile', () => {
    setup()
    const t = tile(/Hollow circle/)
    t.focus()
    fireEvent.keyDown(t, { key: 'Enter' })
    expect(latest!.draft.section.kind).toBe('tube')
    expect(document.activeElement).toBe(tile(/Hollow circle/))
  })

  it('applies a valid kind dropped on the viewport and clears the highlight', () => {
    const { dropZone } = setup()
    const dt = transfer(SECTION_DRAG_MIME, 'iSection')
    fireEvent.dragOver(dropZone, { dataTransfer: dt })
    expect(dropZone.dataset.sectionDropTarget).toBe('active')
    fireEvent.drop(dropZone, { dataTransfer: dt })
    expect(latest!.draft.section.kind).toBe('iSection')
    expect(dropZone.dataset.sectionDropTarget).toBe('idle')
  })

  it('leaves the draft unchanged for Escape-cancelled drags and invalid payloads', () => {
    const { dropZone } = setup()
    const before = latest!
    fireEvent.dragOver(dropZone, { dataTransfer: transfer(SECTION_DRAG_MIME, 'rectangle') })
    fireEvent.dragEnd(window) // Escape cancels the drag: only dragend fires, no drop
    expect(dropZone.dataset.sectionDropTarget).toBe('idle')
    fireEvent.drop(dropZone, { dataTransfer: transfer(SECTION_DRAG_MIME, 'triangle') })
    fireEvent.drop(dropZone, { dataTransfer: transfer('text/plain', 'rectangle') })
    expect(latest!.draft).toBe(before.draft)
    expect(latest!.draftStatus).toBe(before.draftStatus)
  })
})


describe('palette state equivalence (15.2)', () => {
  it('applies by Space while retaining focus and marks a changed draft', () => {
    setup()
    const target=tile(/I-section/)
    target.focus()
    fireEvent.keyDown(target,{key:' '})
    expect(latest!.draft.section.kind).toBe('iSection')
    expect(latest!.draftStatus).toBe('draft')
    expect(document.activeElement).toBe(target)
    expect(pressed()).toHaveLength(1)
  })
  it('keeps the design and status unchanged for same-kind click, Enter, Space and drop', () => {
    const {dropZone}=setup()
    for (const name of [/Solid circle/,/Rectangle/]) {
      const target=tile(name)
      fireEvent.click(target)
      const before=latest!
      fireEvent.click(target)
      fireEvent.keyDown(target,{key:'Enter'})
      fireEvent.keyDown(target,{key:' '})
      fireEvent.drop(dropZone,{dataTransfer:transfer(SECTION_DRAG_MIME,before.draft.section.kind)})
      expect(latest!.draft).toEqual(before.draft)
      expect(latest!.draftStatus).toBe(before.draftStatus)
      expect(pressed()).toHaveLength(1)
    }
  })
})
