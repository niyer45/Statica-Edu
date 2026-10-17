# Original catalog development priority

Owner direction, 2026-10-16 (D-35): complete the six existing library challenges before second editions. Only Cantilever Beam I is currently runnable. No additional card is activated by this planning update.

| Existing card | Current status | Development work |
| --- | --- | --- |
| Cantilever Beam I | Implemented learning loop | Guided/Parametric distinction implemented and CI verified; preserve regressions and complete manual release-mode QA (44.3) |
| Mounting Bracket I | Preview only | Scope supported geometry/load paths and stress assumptions; implement/benchmark appropriate model and integrate (46) |
| Torsion Shaft I | Preview only | Scope torsional deformation/stress, implement/benchmark appropriate shaft model and integrate (47) |
| Heat Sink I | Preview only | Scope thermal assumptions/boundaries, implement/benchmark heat-transfer model and integrate (48) |
| Braced Frame I | Preview only | Scope joint/member/support idealization, implement/benchmark frame/truss model and integrate (49) |
| Vibration Isolation I | Preview only | Scope excitation/damping/response, implement/benchmark appropriate dynamics model and integrate (50) |

Next is 45.1: additive requirements and delivery order for the five previews. Then 45.2 defines shared model/config/result versioning, model-specific metrics/controls, validation, evaluation, visualization/fallback and persistence/import contracts. The order of the five implementation tracks is to be selected during scoping; listing them in screen order does not claim equal complexity or choose numerical models in advance. Task 34 builds shared selection/session infrastructure against those contracts, preserving Cantilever Beam I saves and pure domain boundaries. Each model track has separate specification, numerical validation and integrated learning-loop gates; keep the card unavailable until its supported flow is real and verified.

The current beam solver supports none of the other five advertised disciplines as implemented challenges. Do not label a bracket, heat sink or vibration problem as analyzed by substituting cantilever metrics. Choose bounded educational models and disclose assumptions; if the advertised objective cannot be supported, resolve it in the scoped specification before implementation.

Cantilever Beam II's configuration, specifications and 14 tests are retained. Tasks 33.1–33.2 stay completed historically; further integration is deferred to 52 after original-catalog gate 51. It is neither a seventh available card nor a required intermediate step. Its constant-mass rectangle-orientation exercise may later become a second edition or guided experiment, subject to owner direction.

Customer deployment still requires task 44's observable Guided/Parametric distinction and recorded owner engineering/manual/student QA. Nikhil is the nominated engineering reviewer; no review, participant outcomes, deployment or new model completion is claimed. Accounts/saved user information/progress remain planned under 38; this priority update concerns challenge editions and does not delete those requirements.
