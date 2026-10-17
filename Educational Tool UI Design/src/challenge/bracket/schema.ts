import { z } from 'zod'
import { bracketDesignSchema } from '../../geometry/bracket/design'
import { difficultySchema, interactionModeSchema, paramRangeSchema } from '../schema'
import type { BracketChallenge } from './types'

// Structural schema for Mounting Bracket I challenge JSON (task 46.2). Every object is `.strict()`
// so unknown keys are rejected at any nesting level. The model identity is required and must be
// exactly `steppedBarBracket` v1 (MM-02); any other id or version fails here. Cross-field rules
// (ranges, step location inside the length, design consistency, locked fields) are applied by the
// loader. There is deliberately no field for Kt coefficients or screen thresholds (MBR-13).

const positive = z.number().finite().positive()
const nonEmptyText = z.string().min(1)

export const bracketLockedFieldSchema = z.enum(['lengthM', 'thicknessM', 'materialId', 'forceN', 'support'])

export const bracketMaterialSchema = z
  .object({
    id: nonEmptyText,
    name: nonEmptyText,
    elasticModulusPa: positive,
    densityKgM3: positive,
    allowableStressPa: positive,
    yieldStressPa: positive,
  })
  .strict()

export const bracketDesignLimitsSchema = z
  .object({
    rootDepthM: paramRangeSchema,
    armDepthM: paramRangeSchema,
    stepLocationM: paramRangeSchema,
    filletRadiusM: paramRangeSchema,
  })
  .strict()

export const bracketChallengeSchema = z
  .object({
    id: nonEmptyText,
    version: z.number().int().positive(),
    model: z.object({ id: z.literal('steppedBarBracket'), version: z.literal(1) }).strict(),
    title: nonEmptyText,
    difficulty: difficultySchema,
    allowedModes: z.array(interactionModeSchema).nonempty(),
    statement: nonEmptyText,
    material: bracketMaterialSchema,
    lengthM: positive,
    thicknessM: positive,
    support: z.literal('wallClamp'),
    load: z
      .object({ forceN: positive, location: z.literal('freeEnd'), direction: z.literal('down') })
      .strict(),
    initialDesign: bracketDesignSchema,
    referenceDesign: bracketDesignSchema.optional(),
    lockedFields: z.array(bracketLockedFieldSchema),
    constraints: z
      .object({
        maxPeakStressPa: positive,
        maxTipDeflectionM: positive,
        maxMassKg: positive,
        maxEnvelopeDepthM: positive,
      })
      .strict(),
    designLimits: bracketDesignLimitsSchema,
    predictionPolicy: z
      .object({ requiredOnIterations: z.array(z.number().int().positive()) })
      .strict(),
    reflectionPrompt: z.object({ id: nonEmptyText, text: nonEmptyText }).strict(),
  })
  .strict()

/** Parsed output is assignable to the hand-written BracketChallenge type (checked at compile time). */
export type BracketChallengeSchemaOutput = z.infer<typeof bracketChallengeSchema>
const outputIsChallenge: (c: BracketChallengeSchemaOutput) => BracketChallenge = (c) => c
void outputIsChallenge
