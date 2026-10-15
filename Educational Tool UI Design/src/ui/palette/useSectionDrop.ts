import { useCallback, useEffect, useState } from 'react'
import type { DragEvent } from 'react'
import type { SectionKind } from '../../challenge/types'

// Section_Palette drag-and-drop plumbing (task 15.1; Req 26.2, 26.3, 26.7).
// Tiles write their kind under SECTION_DRAG_MIME; a drop zone uses `useSectionDrop` to highlight
// while a tile is over it and to apply a validated kind on drop. Until the R3F viewport (14.3)
// adds a beam raycast, the whole scene is the drop target (the spec's canvas fallback); 14.3 can
// pass `isOverBeam` to restrict the highlight to beam hits while still accepting canvas drops.

export const SECTION_DRAG_MIME = 'application/x-statica-section'

/** Returns the dropped kind only when it is one of `allowed`; anything else is ignored. */
export function parseSectionPayload(raw: string, allowed: readonly SectionKind[]): SectionKind | null {
  return (allowed as readonly string[]).includes(raw) ? (raw as SectionKind) : null
}

const carriesSection = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes(SECTION_DRAG_MIME)

export function useSectionDrop(
  allowed: readonly SectionKind[],
  onApply: (kind: SectionKind) => void,
  isOverBeam: (e: DragEvent) => boolean = () => true,
) {
  const [highlight, setHighlight] = useState(false)

  // A drag cancelled with Escape (or released elsewhere) ends with `dragend` on the source.
  useEffect(() => {
    if (!highlight) return
    const clear = () => setHighlight(false)
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [highlight])

  const onDragOver = useCallback(
    (e: DragEvent) => {
      if (!carriesSection(e)) return
      e.preventDefault() // mark this element as a valid drop target
      e.dataTransfer.dropEffect = 'copy'
      setHighlight(isOverBeam(e))
    },
    [isOverBeam],
  )

  const onDragLeave = useCallback((e: DragEvent) => {
    const next = e.relatedTarget
    if (next instanceof Node && e.currentTarget.contains(next)) return
    setHighlight(false)
  }, [])

  const onDrop = useCallback(
    (e: DragEvent) => {
      setHighlight(false)
      if (!carriesSection(e)) return
      e.preventDefault()
      const kind = parseSectionPayload(e.dataTransfer.getData(SECTION_DRAG_MIME), allowed)
      if (kind !== null) onApply(kind)
    },
    [allowed, onApply],
  )

  return { highlight, dropProps: { onDragEnter: onDragOver, onDragOver, onDragLeave, onDrop } }
}
