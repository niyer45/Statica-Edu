# Learn modules: requirements and design (task 67)

Additive specification for the "Learn" pillar of the owner's product vision (2026-10-18): guided
learning modules with short concept explanations, interactive demonstrations, prediction-based
questions, guided exercises and optional advanced equations, organised Subject → Topic → Module,
usable on their own or in sequence, and leading into the design challenges. The completed MVP
requirements and the challenge specifications are unchanged.

Owner request (2026-10-19): "create the 'Learn' pillar". First module chosen to match the vision's
example path: Solid Mechanics → Mechanics of Materials → Beam Bending → Cantilever Beam Design.

## Requirements

- LRN-01 Structure. Content is organised as subjects, topics and modules. The first release had one
  available module, **Beam bending** (Solid Mechanics → Mechanics of Materials); tasks 71 and 72 added
  **Torsion** and **Stress and strain** under the same topic (D-61, D-62). Other modules may be listed
  only with a Planned label and no content.
- LRN-02 Module shape. A module is a short ordered list of steps (15–20 minutes in total). Each step
  has: a title; a concept of at most three short points; one prediction question; an interactive
  demonstration; a one-line takeaway; and optional advanced equations, collapsed by default. The last
  step is "Apply it", which opens the matching design challenge.
- LRN-03 Predict before observing. A step's demonstration and takeaway appear only after the learner
  commits to a prediction. Feedback says whether the prediction matched the model and why, without
  scoring the learner. The learner can move on after predicting; a wrong prediction never blocks
  progress.
- LRN-04 Model-backed numbers. Every number a demonstration shows is computed by the existing pure
  physics functions (`physics/beam`, `physics/sectionProperties`) through `src/learn`; none are typed
  into content. Each question's correct option is checked against the physics in unit tests, so the
  content cannot drift from the model.
- LRN-05 Idealisation. Demonstrations use the same Euler–Bernoulli cantilever with a tip load as
  Cantilever Beam I, and say so. Deflected shapes are drawn exaggerated, and labelled as such.
- LRN-06 Apply it. The last step opens Cantilever Beam I in Guided mode, through the same path as
  the challenge drawer, so its saved work and mode rules (D-37) are unchanged.
- LRN-07 Progress. Prediction answers and completed steps are saved per module on this device, in
  the same guest/account scope as challenge progress (`ei:learn:<moduleId>:v<version>`, namespaced
  for accounts). Moving guest progress into a new account moves Learn progress too; deleting an
  account deletes it. A content version bump starts a fresh key (as MM-04). Corrupt or unknown saved
  data is ignored, never shown.
- LRN-08 Navigation. The workspace page "Learning paths" becomes **Learn** (`#learn`; `#learning-paths`
  still opens it). A module has its own address (`#learn/<moduleId>`) so reload and Back keep it.
- LRN-09 Accessibility. Every control has an accessible name; prediction options are a radio group
  with a submit button; feedback is announced; demos have a text readout of every value they draw;
  layouts fit 320 px with no horizontal scroll; axe passes.
- LRN-10 Pure layer. `src/learn` is pure like `challenge`/`physics`: no React, three, `ui/` or
  `state/` imports. UI lives in `src/ui/learn` and contains no physics formulas.

## Design

- `src/learn/types.ts` — `Subject`, `Topic`, `LearnModule`, `LearnStep`, `PredictionQuestion`,
  `DemoSpec` (a discriminated union naming one of the demo kinds and its fixed inputs).
- `src/learn/beamDemo.ts` — `cantileverResponse(input)` (tip deflection, root moment, peak stress,
  I and c from a section and orientation), `momentAt`, `deflectedShape` sampling, equal-area section
  presets and demo materials. Calls the physics functions only.
- `src/learn/modules/beamBending.ts` — the module content. Steps: load, length, material stiffness,
  section shape, where the stress is, apply it.
- `src/learn/catalog.ts` — subjects, topics and modules (available and planned).
- `src/learn/progress.ts` — zod-validated progress record, storage key, parse/serialize, and pure
  updates (answer a step, complete a step).
- `src/ui/learn/` — `LearnPage` (hub), `ModulePage` (step player), demos (`CantileverDemo`,
  `SectionDemo`, `StressDemo`) drawn in SVG, `learn.css`. Advanced equations use `ui/math/TeX`.
- Shell: page `Learn`, route `#learn[/moduleId]`; `PlatformShell` receives the scoped progress
  storage from `CatalogHost` and an `openChallenge(challengeId, mode)` that reuses the drawer path.
- Accounts: `moveGuestProgress` also moves `ei:learn:` keys; its count stays the number of
  challenge sessions moved.

## Out of scope (later tasks)

Further modules (buckling, vibration, heat transfer and others), educator
assignment of modules, cross-device progress, and any scoring or analytics.

## Owner review

The concept text, questions and explanations need owner engineering review before customer use, as
for the challenges (29.2). Demo values are generic teaching values, not challenge constants.
