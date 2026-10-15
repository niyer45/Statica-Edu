import type { DragEvent, KeyboardEvent } from 'react'
import { SECTION_KIND_NAMES } from '../../evaluation/explain'
import type { SectionKind } from '../../challenge/types'
import Icon from '../icons/Icon'
import SectionIcon from '../icons/SectionIcon'
import { useChallenge, useDispatch, useSession } from '../state/store'
import { SECTION_DRAG_MIME } from './useSectionDrop'

// Section_Palette (task 15.1; Req 26.1, 26.4–26.6, 26.8, 32.1): the template `design-panel`
// `.shape-grid`. One tile per allowedSections entry, in order. Click, Enter/Space, and drop onto
// the viewport all dispatch `applySection`, which replaces the draft section via convertSection.

export default function SectionPalette() {
  const challenge = useChallenge()
  const dispatch = useDispatch()
  const active = useSession().draft.section.kind
  const apply = (kind: SectionKind) => dispatch({ type: 'applySection', kind })

  const onKeyDown = (kind: SectionKind) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault() // keep Space from scrolling; focus stays on the tile
    apply(kind)
  }
  const onDragStart = (kind: SectionKind) => (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(SECTION_DRAG_MIME, kind)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <>
      <div className="section-heading">
        CROSS-SECTION <span>01</span>
      </div>
      <div className="shape-grid">
        {challenge.allowedSections.map((kind) => {
          const isActive = active === kind
          return (
            <div
              key={kind}
              role="button"
              tabIndex={0}
              draggable
              aria-pressed={isActive}
              className={`shape-tile ${isActive ? 'selected' : ''}`}
              onClick={() => apply(kind)}
              onKeyDown={onKeyDown(kind)}
              onDragStart={onDragStart(kind)}
            >
              <SectionIcon kind={kind} />
              <span>{SECTION_KIND_NAMES[kind]}</span>
              {isActive && (
                <>
                  <span className="selected-check" aria-hidden="true">
                    <Icon name="check" size={9} />
                  </span>
                  <span className="text-[8px] font-semibold uppercase tracking-wide">Active</span>
                </>
              )}
            </div>
          )
        })}
      </div>
      <div className="drag-caption">
        <Icon name="cube" size={12} />
        Click to apply, or drag onto the beam
      </div>
    </>
  )
}
