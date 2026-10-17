import { z } from 'zod'
import { vibrationDesignSchema } from '../../geometry/vibration/design'
import { difficultySchema, interactionModeSchema } from '../schema'
import type { VibrationChallenge } from './types'

// Structural schema for Vibration Isolation I challenge JSON (task 50.2; vibration-isolation-1
// design.md "Proposed configuration sketch"). Every object is `.strict()` so unknown keys are
// rejected at any nesting level. The model identity is required and must be exactly
// `sdofBaseIsolation` v1 (MM-02); any other id or version fails here. Single-field rules live
// here: m, Y and the stroke are > 0, 0 < ζ ≤ 1, runUpFromHz = 0 for v1. Cross-field rules
// (band order, stiffness range order, unique material ids, design validity, locked fields)
// are applied by the loader. This schema is separate from the beam `challengeSchema`.

const positive = z.number().finite().positive()
const nonEmptyText = z.string().min(1)

export const vibrationLockedFieldSchema = z.enum(['massKg', 'operatingBandHz', 'amplitudeM', 'linearStrokeM'])

export const vibrationMaterialSchema = z
  .object({
    id: nonEmptyText,
    name: nonEmptyText,
    // ζ = 0 (undamped) is a limiting check on the pure formula only; configs reject it.
    dampingRatio: positive.max(1),
  })
  .strict()

export const vibrationChallengeSchema = z
  .object({
    id: nonEmptyText,
    version: z.number().int().positive(),
    model: z.object({ id: z.literal('sdofBaseIsolation'), version: z.literal(1) }).strict(),
    title: nonEmptyText,
    difficulty: difficultySchema,
    allowedModes: z.array(interactionModeSchema).nonempty(),
    statement: nonEmptyText,
    component: z.object({ massKg: positive }).strict(),
    excitation: z
      .object({
        kind: z.literal('baseDisplacement'),
        amplitudeM: positive,
        operatingBandHz: z.object({ minHz: positive, maxHz: positive }).strict(),
        runUpFromHz: z.literal(0),
      })
      .strict(),
    mount: z.object({ linearStrokeM: positive }).strict(),
    materials: z.array(vibrationMaterialSchema).nonempty(),
    stiffnessLimits: z.object({ minNPerM: positive, maxNPerM: positive, stepNPerM: positive }).strict(),
    initialDesign: vibrationDesignSchema,
    referenceDesign: vibrationDesignSchema.optional(),
    lockedFields: z.array(vibrationLockedFieldSchema),
    constraints: z
      .object({
        maxWorstInBandTransmissibility: positive,
        maxStaticDeflectionM: positive,
        maxPeakTransmissibility: positive,
        maxRelativeDisplacementM: positive,
      })
      .strict(),
    predictionPolicy: z
      .object({ requiredOnIterations: z.array(z.number().int().positive()) })
      .strict(),
    reflectionPrompt: z.object({ id: nonEmptyText, text: nonEmptyText }).strict(),
    visualization: z
      .object({ chartMaxHz: positive, chartSamples: z.number().int().min(2), maxVisualSagPx: positive })
      .strict(),
  })
  .strict()

/** Parsed output is assignable to the hand-written VibrationChallenge type (checked at compile time). */
export type VibrationChallengeSchemaOutput = z.infer<typeof vibrationChallengeSchema>
const outputIsChallenge: (c: VibrationChallengeSchemaOutput) => VibrationChallenge = (c) => c
void outputIsChallenge
