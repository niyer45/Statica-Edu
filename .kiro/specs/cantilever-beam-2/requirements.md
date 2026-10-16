# Cantilever Beam II — scoped requirements

Development specification, 2026-10-16, tasks 33.1–33.2. This additive extension does not regenerate M0–M3 specifications. Owner directed software development to proceed before human QA; engineering/manual/student review remains required before customer release. No pilot findings exist; selection is a provisional developer choice subject to owner review, not a pilot-derived conclusion.

## Learning objective and scope

Teach orientation-dependent bending stiffness at constant area/mass using the existing Euler–Bernoulli cantilever tip-force model. Start with a flat rectangle whose deflection fails and allow rectangular dimensions and 0°/90° orientation in Guided/Parametric modes. A simple rotation provides a feasible solution without adding material. No new physics, Freeform geometry, torsion, accounts or UI redesign is included.

## Acceptance criteria

- CB2-01: Use unique identity `cantilever-beam-2`, configuration version 1, title Cantilever Beam II, intermediate difficulty, Guided/Parametric modes and rectangle-only allowed sections. Validate/freeze with the existing loader.
- CB2-02: Lock 0.6 m span, educational nominal aluminum (E 69 GPa, density 2700 kg/m³, allowable stress 120 MPa, yield stress 240 MPa), fixed root and 300 N downward tip force. Keep explicit lockedFields and schema-required section limits/defaults.
- CB2-03: Initial rectangle is 40 mm wide × 20 mm high, orientation 0°. It is valid/applicable and fails deflection only. Limits: 3 mm deflection, 120 MPa stress, 1.4 kg mass and 60 × 60 mm oriented envelope.
- CB2-04: The internal reference uses the identical rectangle at 90°, is applicable, warning-free and Accepted. It is one possible solution, not the only permitted design. No referenceDesign reaches student views.
- CB2-05: Use the existing prediction policy on iterations 1 and 3. Reflection asks learners to connect orientation, I, deflection and stress with unchanged area/mass, grounded in their own stored tested results. Incorrect predictions are learning opportunities, not fabricated scores or completion evidence.
- CB2-06: Existing loader/geometry/analyze/evaluate code is authoritative. Verify independent arithmetic fixtures, equal-mass rotation ratios, invalid/unsupported sections, boundary evaluations, warnings/not-applicable behavior and solvability. Human engineering review remains separately open.
- CB2-07: Keep original Cantilever Beam I configuration/saves/fixtures unchanged. Before user availability, integrate challenge-aware loading, isolated sessions and challenge/version attribution, reject cross-challenge imports, and verify the complete desktop/mobile learning loop (tasks 34–35).
- CB2-08: Ship no new available catalog card during configuration work. Customer release requires owner engineering review, manual accessibility/readiness checks, pilot evidence/disposition and release-candidate automated gates. Passing tests is development evidence, not human sign-off.
