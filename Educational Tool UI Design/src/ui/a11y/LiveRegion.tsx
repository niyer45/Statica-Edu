// Always-present polite live region (task 13.3; Req 30.6, 30.7).
//
// - `aria-live="polite"`, visually hidden, never removed or hidden while mounted.
// - A new announcement replaces the previous message (the region holds one message).
// - Each announcement carries a sequence number; the message node is keyed by it, so the
//   same text announced twice in a row is re-inserted and screen readers read it again.
//
// Callers build announcements with `nextAnnouncement` so every event bumps the sequence.

export interface Announcement {
  message: string
  /** Strictly increasing per event; a new seq re-announces identical text. */
  seq: number
}

/** The announcement that follows `prev` (seq + 1) with the given message. */
export function nextAnnouncement(prev: Announcement | null, message: string): Announcement {
  return { message, seq: (prev?.seq ?? 0) + 1 }
}

export default function LiveRegion({ announcement }: { announcement: Announcement | null }) {
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="live-region">
      {announcement !== null && announcement.message !== '' && (
        <span key={announcement.seq}>{announcement.message}</span>
      )}
    </div>
  )
}
