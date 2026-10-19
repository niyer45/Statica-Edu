// Line icons for the landing page (task 64), from the owner's Figma homepage export
// (design/figma-homepage/site/SiteIcon.tsx at the repository root).

export type SiteIconName =
  | 'arrow'
  | 'check'
  | 'cube'
  | 'book'
  | 'sliders'
  | 'chart'
  | 'bulb'
  | 'lock'
  | 'clock'
  | 'globe'
  | 'users'

const PATHS: Readonly<Record<SiteIconName, string>> = {
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  check: 'm5 12 4 4L19 6',
  cube: 'm12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9',
  book: 'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 6v15',
  sliders: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  chart: 'M4 3v17h17M8 15l4-5 4 2 5-7',
  bulb: 'M9 18h6m-6 3h6M8 14a6 6 0 1 1 8 0l-1 2H9z',
  lock: 'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M13 3a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
}

export default function SiteIcon({ name = 'arrow', size = 16 }: { name?: SiteIconName; size?: number }) {
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
      <path d={PATHS[name]} />
    </svg>
  )
}

/** The Statica mark: three offset bars, drawn in currentColor. */
export function StaticaMark() {
  return (
    <svg width="27" height="31" viewBox="0 0 27 31" fill="currentColor" aria-hidden="true">
      <path d="M0 9 7 6v20l-7 3zm10-6 7-3v26l-7 3zm10 4 7-3v18l-7 3z" />
    </svg>
  )
}
