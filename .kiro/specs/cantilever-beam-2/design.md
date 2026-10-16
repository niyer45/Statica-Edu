# Cantilever Beam II — design and calculation fixtures

Task 33.1 extension, 2026-10-16. Reuse Challenge v1, loadChallenge, validateDesign, analyze, evaluate and toStudentChallenge; no parallel solver/store/workbench. Configuration: `src/challenge/challenges/cantilever-beam-2.json`. Rectangle-only palette restriction uses allowedSections already supported by geometry validation. The dormant configuration is not registered as available or routed by the shell until tasks 34–35.

## Hand-derived fixture worksheet (not human review)

These calculations are computed directly from the existing documented model equations, without calling application functions. They provide separate numeric fixtures; they are not independent reviewer approval or validation of the model's real-world applicability.

Constants: F = 300 N, L = 0.6 m, E = 69×10⁹ Pa, rho = 2700 kg/m³, root moment FL = 180 N·m. For rectangle b = 0.04 m, h = 0.02 m: A = bh = 0.0008 m²; m = rho A L = 1.296 kg. At 0°: I = bh³/12; c = h/2. At 90°: I = hb³/12; c = b/2. Deflection = FL³/(3EI); nominal stress = FLc/I.

| Fixture | Area m² | Bending inertia m⁴ | c m | Mass kg | Deflection mm | Stress MPa | Expected |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Flat Baseline, 0° | 0.0008 | 2.666666666666667e-8 | 0.01 | 1.296 | 11.73913043478261 | 67.5 | Not accepted: deflection only |
| Rotated reference, 90° | 0.0008 | 1.066666666666667e-7 | 0.02 | 1.296 | 2.934782608695652 | 33.75 | Accepted |
| Square 40 × 40 mm, 0° | 0.0016 | 2.133333333333334e-7 | 0.02 | 2.592 | 1.467391304347826 | 16.875 | Not accepted: mass only |

Rotation multiplies I by 4, deflection by 1/4 and stress by 1/2, with unchanged area/mass. The square illustrates why lower deflection alone does not imply acceptance. Require relative numeric agreement within 1e-9 against unrounded SI fixtures. Original fixture tests retain their existing tolerance.

Baseline applicability metrics: depth/span = 0.0333333, deflection/span = 0.0195652, stress/yield = 0.28125, below existing warning thresholds. Reference metrics: 0.0666667, 0.00489130, 0.140625; oriented aspect ratio 2. Both are warning-free. A 3 × 3 mm rectangle deliberately exceeds large-deflection/plasticity applicability bounds and must never be Accepted. Oversized/unsupported geometry must be rejected by geometry validation before analysis.

## Integration and verification boundaries

No persistence schema change is needed for this configuration. Existing keys already include challenge id/version; tasks 34.1–34.2 must make the active shell/store lifecycle respect those identities and preserve existing Cantilever Beam I saves. Do not silently switch only metadata while keeping the old challenge bound to StoreProvider. Store bootstrap and challenge selection must agree before displaying results. Existing JSON design imports include challengeId and must reject a different challenge even when geometry/locked fields happen to match.

Tests cover schema/freeze, numeric fixtures/status, orientation invariants, configured evaluation boundaries, model exclusions, unsupported/invalid geometry, student reference redaction and cross-challenge import rejection. No new catalog availability, UI browser pass, engineering sign-off or M5 closeout is claimed by these tests. Use the same domain coverage/core gates and extend full browser flows during integration.
