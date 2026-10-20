# learningLoop fixtures

`keyboard-state.json` is the normalized session state (`normalizeState` in `e2e/helpers.ts`: ids and
timestamps dropped) after the keyboard flow in `e2e/learningLoop.spec.ts` submits the reference design on
Cantilever Beam I. The mouse test compares against it instead of rebuilding the keyboard flow; the keyboard
test also compares against it, so keyboard and mouse stay equal. It was verified identical on
chromium-desktop and pixel-7 and across two fresh runs each, so there is one file.

Regenerate (from `Educational Tool UI Design/`, Node 22):

    PW_UPDATE_FIXTURES=1 pnpm exec playwright test e2e/learningLoop.spec.ts -g "keyboard flow submits" --project=chromium-desktop

A content-version bump of Cantilever Beam I (or any change to its model, constants or result wording) is
expected to change this file. Review the diff before committing it.
