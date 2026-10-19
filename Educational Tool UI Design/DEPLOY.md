# Putting Statica online (GitHub Pages)

Statica is a static site with no server: everything runs in the student's browser and progress is
saved on their device. GitHub Pages hosts it for free from this repository. Deploying is manual,
so the live site changes only when you run the workflow.

Live address once deployed: **https://niyer45.github.io/Statica-Edu/**

## One-time setup

1. On GitHub, open the repository → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

## Deploy

1. Make sure CI ("Statica Milestone 3") passed for the latest commit on `main`. The deploy refuses
   a commit that has not passed CI.
2. Open **Actions** → **Deploy to GitHub Pages** → **Run workflow** → branch `main` → **Run workflow**.
3. When it finishes (about 3 minutes), the run summary links to the site. Open it and check that
   the footer of the home page shows **Build** followed by the first 7 characters of the commit you
   deployed. Record that build id in your pilot notes (task 30.2).

To go back to an earlier version, create a branch at that commit and pick it under "Use workflow
from". This works for commits that already contain `.github/workflows/pages.yml`.

## Before a pilot session

- **Don't deploy during a session.** A student's open tab keeps the old version; a new deploy can
  break its lazily loaded 3D or formula views until they reload.
- **Progress lives in each browser.** It is not shared between devices, browsers or browser
  profiles, and a private/incognito window loses it when closed. Safari may clear it after about a
  week without visiting the site.
- **Shared computers:** guests on the same browser share one guest workspace. Ask each student to
  create an account on that computer (it stays on that computer, no email is sent), or give each
  student their own browser profile. Accounts never leave the device; there is no password reset.
- **Backups:** students can export a design file from the workbench and open it again later.
- **Privacy:** the site makes no network requests after loading and has no analytics. It is public:
  anyone with the link can open it, but they only ever see their own browser's data.

## How it works

`.github/workflows/pages.yml` checks that CI passed for the commit, builds with the base path
`/Statica-Edu/` (`FIGMA_PUBLIC_URL`) and the commit id (`VITE_BUILD_ID`), and publishes `dist/`
with GitHub's Pages actions. A custom domain later would need the base path set to `/` instead.
