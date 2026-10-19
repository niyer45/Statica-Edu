// Shell hash routes (task 38). The app is one static page with no server routing, so shell pages
// live in the URL fragment: reload and Back keep the page, and links can open a page directly
// (e.g. `/#challenges`). The workbench is not a route; a reload returns to the page it was opened
// from, as before. An empty or unknown fragment opens Home. Learn (task 67) replaces Learning
// paths; a module has its own fragment (`#learn/<moduleId>`), and `#learning-paths` still opens Learn.

export type Page = 'Home' | 'Challenges' | 'Learn' | 'My designs' | 'Notebook' | 'Account'
/** Which account form the Account page shows to a guest. */
export type AccountView = 'sign-up' | 'sign-in'

export interface Route {
  page: Page
  view: AccountView
  /** The open Learn module, for `#learn/<moduleId>`. */
  moduleId?: string
}

const SLUGS: readonly [string, Route][] = [
  ['home', { page: 'Home', view: 'sign-up' }],
  ['challenges', { page: 'Challenges', view: 'sign-up' }],
  ['learn', { page: 'Learn', view: 'sign-up' }],
  ['learning-paths', { page: 'Learn', view: 'sign-up' }],
  ['my-designs', { page: 'My designs', view: 'sign-up' }],
  ['notebook', { page: 'Notebook', view: 'sign-up' }],
  ['account', { page: 'Account', view: 'sign-up' }],
  ['sign-up', { page: 'Account', view: 'sign-up' }],
  ['sign-in', { page: 'Account', view: 'sign-in' }],
]

const MODULE_ID = /^[a-z0-9-]{1,64}$/

export function routeFromHash(hash: string): Route {
  const slug = hash.replace(/^#\/?/, '').toLowerCase()
  const learn = /^learn\/(.+)$/.exec(slug)
  if (learn && MODULE_ID.test(learn[1]!)) return { page: 'Learn', view: 'sign-up', moduleId: learn[1]! }
  return SLUGS.find(([s]) => s === slug)?.[1] ?? { page: 'Home', view: 'sign-up' }
}

export function hashFor(page: Page, view?: AccountView, moduleId?: string): string {
  if (page === 'Account' && view !== undefined) return `#${view}`
  if (page === 'Learn' && moduleId !== undefined) return `#learn/${moduleId}`
  return `#${SLUGS.find(([, r]) => r.page === page)![0]}`
}

/** Records a route as a new history entry (Back returns to the previous page) without a reload. */
export function pushRoute(page: Page, view?: AccountView, moduleId?: string): void {
  if (typeof window === 'undefined') return
  const hash = hashFor(page, view, moduleId)
  if (window.location.hash !== hash) window.history.pushState(null, '', hash)
}

/** Replaces the current entry, for redirects such as landing on Home after signing in. */
export function replaceRoute(page: Page, view?: AccountView): void {
  if (typeof window === 'undefined') return
  const hash = hashFor(page, view)
  if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
}
