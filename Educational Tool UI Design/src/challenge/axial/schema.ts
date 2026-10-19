import { z } from 'zod'
import { axialDesignSchema } from '../../geometry/axial/design'
import { difficultySchema, interactionModeSchema, paramRangeSchema } from '../schema'
import type { AxialChallenge } from './types'

// Structural schema for Stress and Strain I challenge JSON (task 72). Every object is `.strict()`
// so unknown keys are rejected at any nesting level. The model identity is required and must be
// exactly `axialTieRod` v1 (MM-02). Cross-field rules (range, unique materials, digit-free short
// names, design consistency, locked fields, rod slenderness) are applied by the loader. There is
// deliberately no field for the applicability thresholds or a fixed stress limit: the stress
// limit is the chosen material's yield strength divided by the design factor.

const positive = z.number().finite().positive()
const nonEmptyText = z.string().min(1)

export const axialLockedFieldSchema = z.enum(['lengthM', 'forceN', 'designFactor', 'support'])

export const axialMaterialSchema = z
  .object({
    id: nonEmptyText,
    name: nonEmptyText,
    shortName: nonEmptyText,
    elasticModulusPa: positive,
    yieldStressPa: positive,
    densityKgM3: positive,
  })
  .strict()

export const axialChallengeSchema = z
  .object({
    id: nonEmptyText,
    version: z.number().int().positive(),
    model: z.object({ id: z.literal('axialTieRod'), version: z.literal(1) }).strict(),
    title: nonEmptyText,
    difficulty: difficultySchema,
    allowedModes: z.array(interactionModeSchema).nonempty(),
    statement: nonEmptyText,
    lengthM: positive,
    forceN: positive,
    designFactor: z.number().finite().min(1),
    support: z.literal('pinnedTop'),
    materials: z.array(axialMaterialSchema).nonempty(),
    initialDesign: axialDesignSchema,
    referenceDesign: axialDesignSchema.optional(),
    lockedFields: z.array(axialLockedFieldSchema),
    constraints: z.object({ maxElongationM: positive, maxMassKg: positive }).strict(),
    diameterLimits: paramRangeSchema,
    predictionPolicy: z
      .object({ requiredOnIterations: z.array(z.number().int().positive()) })
      .strict(),
    reflectionPrompt: z.object({ id: nonEmptyText, text: nonEmptyText }).strict(),
    visualization: z
      .object({ elongationExaggerationFactor: positive, maxVisualElongationFractionOfL: positive })
      .strict(),
  })
  .strict()

/** Parsed output is assignable to the hand-written AxialChallenge type (checked at compile time). */
export type AxialChallengeSchemaOutput = z.infer<typeof axialChallengeSchema>
const outputIsChallenge: (c: AxialChallengeSchemaOutput) => AxialChallenge = (c) => c
void outputIsChallenge
