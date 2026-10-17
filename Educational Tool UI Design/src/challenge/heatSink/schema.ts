import { z } from 'zod'
import { heatSinkDesignSchema } from '../../geometry/heatSink/design'
import { difficultySchema, interactionModeSchema, paramRangeSchema } from '../schema'
import type { HeatSinkChallenge } from './types'

// Structural schema for Heat Sink I challenge JSON (task 48.2). Every object is `.strict()` so
// unknown keys are rejected at any nesting level. The model identity is required and must be
// exactly `plateFinHeatSink` v1 (MM-02); any other id or version fails here. Cross-field rules
// (ranges, steps, fin-count floor, temperature limit above ambient, profile samples, design
// consistency, locked fields) are applied by the loader. Separate from the beam and torsion
// schemas, which are unchanged.

const positive = z.number().finite().positive()
const nonEmptyText = z.string().min(1)

export const heatSinkLockedFieldSchema = z.enum(['base', 'materialId', 'heatLoadW', 'ambientTemperatureK', 'convection'])

export const heatSinkMaterialSchema = z
  .object({
    id: nonEmptyText,
    name: nonEmptyText,
    thermalConductivityWPerMK: positive,
    densityKgM3: positive,
  })
  .strict()

export const integerRangeSchema = z
  .object({ min: z.number().int().positive(), max: z.number().int().positive(), step: z.literal(1) })
  .strict()

export const heatSinkDesignLimitsSchema = z
  .object({
    finCount: integerRangeSchema,
    finThicknessM: paramRangeSchema,
    finHeightM: paramRangeSchema,
    minGeometricGapM: positive,
  })
  .strict()

export const heatSinkChallengeSchema = z
  .object({
    id: nonEmptyText,
    version: z.number().int().positive(),
    model: z.object({ id: z.literal('plateFinHeatSink'), version: z.literal(1) }).strict(),
    title: nonEmptyText,
    difficulty: difficultySchema,
    allowedModes: z.array(interactionModeSchema).nonempty(),
    statement: nonEmptyText,
    material: heatSinkMaterialSchema,
    base: z.object({ widthM: positive, depthM: positive, thicknessM: positive }).strict(),
    heatLoadW: positive,
    ambientTemperatureK: positive,
    convection: z
      .object({ coefficientWPerM2K: positive, kind: z.literal('specifiedEffective'), description: nonEmptyText })
      .strict(),
    initialDesign: heatSinkDesignSchema,
    referenceDesign: heatSinkDesignSchema.optional(),
    lockedFields: z.array(heatSinkLockedFieldSchema),
    constraints: z
      .object({
        maxBaseTemperatureK: positive,
        maxMassKg: positive,
        maxFinHeightM: positive,
        minFinGapM: positive,
      })
      .strict(),
    designLimits: heatSinkDesignLimitsSchema,
    predictionPolicy: z
      .object({ requiredOnIterations: z.array(z.number().int().positive()) })
      .strict(),
    reflectionPrompt: z.object({ id: nonEmptyText, text: nonEmptyText }).strict(),
    visualization: z
      .object({ profileSamplesXOverH: z.array(z.number().finite().min(0).max(1)).nonempty() })
      .strict(),
  })
  .strict()

/** Parsed output is assignable to the hand-written HeatSinkChallenge type (checked at compile time). */
export type HeatSinkChallengeSchemaOutput = z.infer<typeof heatSinkChallengeSchema>
const outputIsChallenge: (c: HeatSinkChallengeSchemaOutput) => HeatSinkChallenge = (c) => c
void outputIsChallenge
