// Template `.toast`, visual only (task 13.3; design "LiveRegion / Toast").
// The template's `role="status"` is dropped: announcements go through the separate,
// always-present LiveRegion so the same notice is not read twice.

export default function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (message === null || message === '') return null
  return (
    <div className="toast">
      {message}
      <button type="button" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
