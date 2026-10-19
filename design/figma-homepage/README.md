# Figma homepage export (2026-10-18)

Owner-supplied Figma output for a redesigned homepage, copied verbatim from `~/Downloads`
(`site/`, `challenges.ts`, `TechnicalArt.tsx`). Reference only: these are Next.js components
(`next/link`, `/api/*` routes) and are not built, linted or tested. The app's homepage is
`Educational Tool UI Design/src/ui/shell/HomePage.tsx`, which adapts this design to the Vite app,
its local accounts and its CSP.

- `site/` has no page file or theme CSS; the layout and the Tailwind colour tokens
  (`forest`, `olive`, `sage`, `canvas`, `line`, `muted`, `ink`) were inferred from the components.
- `challenges.ts` marks only Cantilever Beam I as available; all six challenges are available
  in the app (D-42–D-44), so the app's catalog stays the source of truth.
- `TechnicalArt.tsx` draws the same figures as `src/ui/shell/TechnicalArt.tsx`, which adds
  per-kind memoization.
- `AuthForm`, `AccountMenu` and `AccountProvider` call a server API; the app's accounts are
  local-first (D-50), so only their visual design applies.
