// Shell hash routes (task 38). The app is one static page with no server routing, so shell pages
// live in the URL fragment: reload and Back keep the page, and links can open a page directly
// (e.g. `/#challenges`). The workbench is not a route; a reload returns to the page it was opened
// from, as before. An empty or unknown fragment opens Home.

export type Page = 'Home' | 'Challenges' | 'Learning paths' | 'My designs' | 'Notebook' | 'Account'
/** Which account form the Account page shows to a guest. */
export type AccountView = 'sign-up' | 'sign-in'

export interface Route {
  page: Page
  view: AccountView
}

const SLUGS: readonly [string, Route][] = [
  ['home', { page: 'Home', view: 'sign-up' }],
  ['challenges', { page: 'Challenges', view: 'sign-up' }],
  ['learning-paths', { page: 'Learning paths', view: 'sign-up' }],
  ['my-designs', { page: 'My designs', view: 'sign-up' }],
  ['notebook', { page: 'Notebook', view: 'sign-up' }],
  ['account', { page: 'Account', view: 'sign-up' }],
  ['sign-up', { page: 'Account', view: 'sign-up' }],
  ['sign-in', { page: 'Account', view: 'sign-in' }],
]

export function routeFromHash(hash: string): Route {
  const slug = hash.replace(/^#\/?/, '').toLowerCase()
  return SLUGS.find(([s]) => s === slug)?.[1] ?? { page: 'Home', view: 'sign-up' }
}

export function hashFor(page: Page, view?: AccountView): string {
  if (page === 'Account' && view !== undefined) return `#${view}`
  return `#${SLUGS.find(([, r]) => r.page === page)![0]}`
}

/** Records a route as a new history entry (Back returns to the previous page) without a reload. */
export function pushRoute(page: Page, view?: AccountView): void {
  if (typeof window === 'undefined') return
  const hash = hashFor(page, view)
  if (window.location.hash !== hash) window.history.pushState(null, '', hash)
}

/** Replaces the current entry, for redirects such as landing on Home after signing in. */
export function replaceRoute(page: Page, view?: AccountView): void {
  if (typeof window === 'undefined') return
  const hash = hashFor(page, view)
  if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
}
