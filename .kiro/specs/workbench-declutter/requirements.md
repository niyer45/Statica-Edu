# Workbench declutter: Task 78

Additive specification, 2026-11-09. Owner feedback: "the main menu is way too cluttered, it's hard to follow where the instructions are and where to go. There are just too many words. Incorporate popups for the guided activities and try to hide as much additional information in dropdowns." Applies to all ten available challenges. Presentation only: no physics, evaluation, challenge JSON, reducer, guided-plan or persistence change. The decision record is D-65 (written by the director). Where this spec and D-48's amendment (visible challenge paragraph) differ, the lead sentences stay visible and only the remainder collapses (WD-04).

## Visibility rules

- WD-01: Always visible in the workbench: the lead of the challenge statement (at most two sentences), the checks list (VALUE / LIMIT), the design controls, the primary design view, Run Test, the result status, model warnings, not-applicable reasons, and the model-limits footer notice (MVP Req 29.7, unchanged wording and placement).
- WD-02: Collapsed by default, inside the shared `Disclosure`: the remainder of the challenge statement, explanatory paragraphs, secondary charts and diagrams, long captions, model notes, formulas, and tables that duplicate the checks. Nothing is deleted or reworded; it is moved. Information needed for correctness or honesty about model limits (D-48) stays in the DOM and reachable by one click and by keyboard.
- WD-03: "About this model" is one collapsed Disclosure in the workbench chrome holding the tagline, the solver label, the model's `contextNote` and the mode sentence. Parametric's explanatory sentence is in the same Disclosure. The library and the challenge drawer keep their own mode sentences.
- WD-04: `ChallengeStatement` shows the first `leadSentences` (default 2) sentences as a visible paragraph and the rest, word for word and in order, in a Disclosure named "More about this challenge". With nothing left there is no Disclosure. Sentence splitting is deterministic and does not break at decimals ("4.0 MPa"), unit text ("Ø24.5 mm") or abbreviations ("i.e.", "e.g.", "approx.", "vs.").
- WD-05: Guided instructions are not inline. A compact chip "Step N of M: <title>" is always visible; a non-modal popover shows the step instruction, the experiments list, the "Editable now" line, the hint (inside a Disclosure) and the latest step feedback.
- WD-06: Disclosure state and popover state are UI state only: never persisted, never in the reducer, never announced.

## Popover behaviour and accessibility

- WD-10: The popover opens automatically on first entry and whenever the current step (or the latest not-yet-met attempt) changes, without moving focus. Focus is never trapped; the design controls stay operable while it is open.
- WD-11: Escape and the Close button dismiss it. Focus returns to the chip only when focus was inside the popover. Escape pressed elsewhere dismisses an open popover without moving focus. The chip toggles it (`aria-expanded`, `aria-controls`).
- WD-12: The popover is `role="group"` with an accessible name (not a dialog, because it is non-modal and must not appear in the dialog tree); it adds no live region. Step changes are announced only through the existing `ui/a11y/LiveRegion` text (MODE-07). When open it adds at most three tab stops in total (chip, Close, hint summary).
- WD-13: No overlay on the 3D canvas (D-26). Above 870 px it hangs under the chip over the challenge column; at 870 px and narrower it renders in flow under the chip, so it never covers the design view, the Run Test button or the controls. No inline styles (CSP).
- WD-14: Locked controls show one line near the chip instead of one sentence per control. Each locked control keeps its read-only or disabled state, a small lock icon, and an `aria-describedby` target with the reason, so the lock is never conveyed by colour alone. The reducer's locked-edit rejection and announcement are unchanged.
- WD-15: Every control keeps an accessible name, layout works at 320 px, and serious/critical axe gates hold.

## Shared building blocks

- `ui/workbench/Disclosure.tsx`: `<Disclosure summary id? defaultOpen? className?>`; native `<details class="ei-disclosure">`; closing returns the layout to its height (e2e/disclosure.spec.ts).
- `ui/workbench/ChallengeStatement.tsx` with `splitStatement(text, leadSentences)`.
- `ui/workbench/GuidedStepPopover.tsx` mounted by `ModeExperience`.
- `ui/workbench/LockNote.tsx`: the per-control lock mark.
- Each model's CSS lives in `ui/models/<model>/<model>.css`, imported by that model's entry.

## Per-model checklist (one worker per model; touch only that model's files)

1. Challenge panel: replace the statement paragraph with `<ChallengeStatement text={...} />`; keep the checks list, applicability reasons, warnings, Run Test and the reference link visible.
2. Wrap the explanatory paragraphs, long captions, model notes and secondary charts/diagrams of the view in `<Disclosure>`; migrate that model's own `<details>` ("Some things are fixed.", sections tables, etc.) to `Disclosure` only if the visible text and e2e names stay accurate. Keep the text equivalents of charts (MM-22) and the `*_SUMMARY_ID` description targets in the DOM.
3. Keep the model's limits notice (`copy.limitsNotice`) unchanged; do not move or shorten it.
4. Do not edit `evaluation/guided/*`, `state/*`, challenge JSON, the shared workbench files, or tracking documents; model CSS goes in the model's own css file.
5. Update that model's unit and e2e specs: text that moved into a Disclosure is asserted after opening it (same strength); the Parametric sentence now lives in "About this model" (use `openAbout` in `e2e/helpers.ts`); Guided heading assertions use `expectGuidedStep`.
6. Run lint, typecheck, the model's vitest files, the model's Playwright spec on both projects, and axe.

## Task 78.2: the challenge comes first (owner, 2026-11-09)

Owner, after seeing the decluttered preview: "'The Challenge' should also be somewhat simplified and put at the top. That should be the first thing that I see. I need to see the challenge first, and then process after." Applies to all ten challenges, Guided and Parametric. Presentation only. WD-01 and WD-04 are amended as stated here: the visible statement is the card goal line plus the first sentence (was the first two sentences in the right-hand column).

- WD-20: A full-width challenge band is the first workbench content in DOM order, directly after the page title row and before "About this model", the Guided chip and lock line, the design tools and the design view. It has one `h2` "The challenge" and is a labelled region.
- WD-21: The band holds, in order: (a) a one-line goal headline, which is the challenge's library card summary line from `challenge/catalog.ts` (the existing `description` field, not new wording); (b) the first sentence of `challenge.statement` as a visible paragraph (`ChallengeStatement` with `leadSentences={1}`); (c) the rest of the statement, word for word and in order, in the collapsed "More about this challenge" Disclosure (none when nothing is left). When the headline and first sentence are near-identical for a challenge, both still show.
- WD-22: The statement appears once in the workbench. Each model's challenge panel (and the beam's `RequirementsPanel`) no longer renders it; that panel's heading and accessible name become "Checks". The checks list, Run Test, result status, warnings, not-applicable reasons, Test details and reference link stay there unchanged.
- WD-23: The band spans the full workbench width above 870 px and stacks first at narrower widths; its styles live in `learningLoop.css`, with no inline styles and no heavier chrome than the "About this model" row. The Guided popover anchors under the chip, which is below the band, so it never covers the band. The band adds at most one tab stop (the Disclosure summary).
- WD-24: No challenge JSON, catalog text, physics, evaluation, reducer, guided-plan or persistence change, so no content version bump (MM-04). The model-limit sentences in statements (D-48) stay in the DOM, reachable by one click and by keyboard.

## Task 78.3: Guided steps as a stepper row; About moves to the bottom (owner, 2026-11-09)

Owner, after seeing the challenge-first preview, with a reference image: "Move the guided mode/About this model section away from the top, it is not important to the user. Have the steps in the same place as the image. Replace the area that the 'Guided design' is in with 'The challenge' information like what you have at the top already." Presentation only. WD-05, WD-11, WD-13, WD-14 and WD-20 are amended as stated here. The stepper shows the challenge's own Guided experiment steps (titles from `evaluation/guided/<model>.ts`, unchanged), not the four workflow stages.

- WD-30: Guided only: directly after the challenge band and before the three-column workbench, a horizontal stepper row (thin rule above and below) lists the Guided steps in order as numbered circles joined by lines. It is an ordered list in a `nav` named "Guided steps". A completed step shows a check in a pale circle; the current step shows a filled dark numbered circle with a bold label and `aria-current="step"`; a future step shows a pale numbered circle with a small lock. State is never conveyed by colour alone: each item carries sr-only text "completed", "current step" or "locked". When every step is met all show checks and the row ends with the text "All N steps complete".
- WD-31: The "Step N of M" chip is removed. The current step is a button (`aria-expanded`, `aria-controls`) that opens and closes the existing non-modal step popover; with every step met, the "All N steps complete" text is that button. Completed and future steps are not buttons. The row adds one tab stop (the current step); an open popover adds Close and the Hint summary.
- WD-32: The popover keeps WD-10 to WD-12 (auto-opens on first entry, on a step change and on an attempt that did not meet the step; never steals focus; Escape and Close dismiss it; focus returns to the current-step button only when it was inside; `role="group"`; no live region). Its content is the current step only: the experiments list is removed (the stepper shows it) and the lock line "Locked in this step: everything except <focus>. Others unlock in later steps." moves inside it under "Editable now". Per-control lock marks and their `aria-describedby` reasons (WD-14) are unchanged. The popover renders in flow directly under the stepper row at every width, so it cannot cover the challenge band, the design view or the 3D canvas (D-26); this replaces the WD-13 hang-over-the-column placement.
- WD-33: At 870 px and narrower the stepper stacks one step per line so it never overflows horizontally (320 px included); labels wrap.
- WD-34: Parametric has no stepper row: the band is followed directly by the workbench.
- WD-35: The "Guided mode / About this model" row (`.workspace-context` with the mode badge and the `About this model` Disclosure; Parametric reads "Parametric mode") moves out of the top. It renders at the bottom of the workbench content, after the results panel and before the limits footer, in both modes. Its content is unchanged; DOM order follows visual order: title row, challenge band, stepper (Guided), workbench, results, About row, footer.
- WD-36: No overlay on the 3D model, no inline styles, no new live region; step derivation, locks and reducer are untouched; no wording change to step titles or instructions; no JSON change.
