import type { SectionKind } from "../../challenge/types"

// Template cross-section glyphs, moved unchanged from `src/Workspace.tsx` (task 13.3).
// Decorative only; the kind is typed with the domain `SectionKind`.

export default function SectionIcon({ kind }: { kind: SectionKind }) {
  return (
    <svg viewBox="0 0 52 45" width="48" height="40" aria-hidden="true">
      {kind === "circle" ? (
        <circle cx="26" cy="22" r="14" fill="currentColor" />
      ) : kind === "tube" ? (
        <>
          <circle cx="26" cy="22" r="15" fill="currentColor" />
          <circle cx="26" cy="22" r="9" fill="var(--panel)" />
        </>
      ) : kind === "rectangle" ? (
        <rect x="13" y="6" width="26" height="33" rx="1" fill="currentColor" />
      ) : (
        <path d="M9 6h34v7H30v19h13v7H9v-7h13V13H9z" fill="currentColor" />
      )}
    </svg>
  )
}
