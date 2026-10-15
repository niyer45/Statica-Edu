import Icon from '../icons/Icon'

// STUB (task 13.3): the template `.history-note` moved here. Task 25.1 replaces the disabled
// export button (the template dumped raw prototype runs) with `exportDesign` download and an
// import file picker.

export default function ImportExportBar() {
  return (
    <div className="history-note">
      <span className="tiny-dot" />
      Saved in this session
      <button type="button" title="Export is not available yet" aria-label="Export designs" disabled>
        <Icon name="download" size={15} />
      </button>
    </div>
  )
}
