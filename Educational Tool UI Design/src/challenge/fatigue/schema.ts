import { z } from 'zod'
import { fatigueDesignSchema, surfaceFinishSchema } from '../../geometry/fatigue/design'
import { difficultySchema, interactionModeSchema, paramRangeSchema } from '../schema'
import type { FatigueChallenge } from './types'

// Structural schema for Fatigue Analysis I challenge JSON (task 70). Every object is `.strict()`
// so unknown keys are rejected at any nesting level. The model identity is required and must be
// exactly `steppedShaftFatigue` v1 (MM-02). Cross-field rules (ranges, correlation ranges,
// reliability factor, design consistency, locked fields) are applied by the loader. There is
// deliberately no field for correlation coefficients or screen limits.

const positive = z.number().finite().positive()
const nonEmptyText = z.string().min(1)

export const fatigueLockedFieldSchema = z.enum(['materialId', 'load', 'geometry', 'support'])

export const fatigueMaterialSchema = z
  .object({
    id: nonEmptyText,
    name: nonEmptyText,
    ultimateStrengthPa: positive,
    yieldStrengthPa: positive,
    densityKgM3: positive,
  })
  .strict()

export const fatigueDesignLimitsSchema = z
  .object({
    neckDiameterM: paramRangeSchema,
    collarDiameterM: paramRangeSchema,
    filletRadiusM: paramRangeSchema,
  })
  .strict()

export const fatigueChallengeSchema = z
  .object({
    id: nonEmptyText,
    version: z.number().int().positive(),
    model: z.object({ id: z.literal('steppedShaftFatigue'), version: z.literal(1) }).strict(),
    title: nonEmptyText,
    difficulty: difficultySchema,
    allowedModes: z.array(interactionModeSchema).nonempty(),
    statement: nonEmptyText,
    material: fatigueMaterialSchema,
    load: z.object({ meanForceN: positive, alternatingForceN: positive, armM: positive }).strict(),
    geometry: z.object({ collarLengthM: positive, neckLengthM: positive }).strict(),
    support: z.literal('collarClamped'),
    reliability: z.object({ percent: positive, factor: positive }).strict(),
    targetLifeCycles: positive,
    allowedFinishes: z.array(surfaceFinishSchema).nonempty(),
    initialDesign: fatigueDesignSchema,
    referenceDesign: fatigueDesignSchema.optional(),
    lockedFields: z.array(fatigueLockedFieldSchema),
    constraints: z
      .object({
        minFatigueSafetyFactor: positive,
        minYieldSafetyFactor: positive,
        maxMassKg: positive,
        minShoulderFaceM: positive,
      })
      .strict(),
    designLimits: fatigueDesignLimitsSchema,
    predictionPolicy: z.object({ requiredOnIterations: z.array(z.number().int().positive()) }).strict(),
    reflectionPrompt: z.object({ id: nonEmptyText, text: nonEmptyText }).strict(),
  })
  .strict()

/** Parsed output is assignable to the hand-written FatigueChallenge type (checked at compile time). */
export type FatigueChallengeSchemaOutput = z.infer<typeof fatigueChallengeSchema>
const outputIsChallenge: (c: FatigueChallengeSchemaOutput) => FatigueChallenge = (c) => c
void outputIsChallenge
