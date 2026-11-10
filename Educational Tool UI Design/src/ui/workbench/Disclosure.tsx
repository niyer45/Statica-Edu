import type { ReactNode } from 'react'

// Shared collapsed-by-default section (task 78). A thin wrapper over the native
// <details>/<summary>, so keyboard operation, the expanded state and "closed content stays in
// the DOM" come from the platform. Open state is never stored or announced (WD-06). Closing it
// returns the layout to its previous height (e2e/disclosure.spec.ts guards this for the workbench).
// Styled once in learningLoop.css (`.ei-disclosure`).

export interface DisclosureProps {
  /** The visible summary label. */
  summary: ReactNode
  /** Optional id for the <details> element (e.g. an aria-controls target). */
  id?: string
  /** Opens the section on first render; the default is collapsed. */
  defaultOpen?: boolean
  /** Extra class names appended after `ei-disclosure` (for a model's own spacing). */
  className?: string
  children: ReactNode
}

export default function Disclosure({ summary, id, defaultOpen = false, className, children }: DisclosureProps) {
  return (
    <details id={id} className={className === undefined ? 'ei-disclosure' : `ei-disclosure ${className}`} open={defaultOpen || undefined}>
      <summary>{summary}</summary>
      <div className="ei-disclosure-body">{children}</div>
    </details>
  )
}
