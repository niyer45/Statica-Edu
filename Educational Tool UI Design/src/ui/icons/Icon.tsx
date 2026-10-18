// Template line icons, moved unchanged from `src/Workspace.tsx` (task 13.3).
// Decorative only (`aria-hidden`); callers supply accessible names.

export default function Icon({ name, size = 18 }: {
  name: string
  size?: number
}) {
  const paths: Record<string, string> = {
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    home: "M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
    book: "M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 6v15",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    back: "m14 6-6 6 6 6",
    check: "m5 12 4 4L19 6",
    lock: "M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4",
    play: "m8 5 11 7-11 7z",
    reset: "M4 9a8 8 0 1 1 0 7M4 3v6h6",
    help: "M9 8a3 3 0 1 1 5 3c-2 1-2 2-2 3M12 18v.1",
    cube: "m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10",
    chart: "M4 3v17h17M8 15l4-5 4 2 5-7",
    expand: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
    bulb: "M9 18h6m-6 3h6M8 14a6 6 0 1 1 8 0l-1 2H9z",
    clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    tune: "M4 7h16M4 17h16M8 4v6m8 4v6",
    download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
    minus: "M5 12h14",
    plus: "M5 12h14M12 5v14",
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.cube} />
    </svg>
  )
}
