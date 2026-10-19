import { z } from 'zod'
import { columnDesignSchema } from '../../geometry/column/design'
import { difficultySchema, interactionModeSchema, paramRangeSchema } from '../schema'
import type { ColumnChallenge } from './types'

// Structural schema for Column Buckling I challenge JSON (task 68). Every object is `.strict()` so
// unknown keys are rejected at any nesting level. The model identity is required and must be
// exactly `eulerColumnBuckling` v1 (MM-02); any other id or version fails here. Cross-field rules
// (ranges, tube bore, defaults, design consistency, locked fields) are applied by the loader.
// There is deliberately no field for the effective-length factor or the screen thresholds.

const positive = z.number().finite().positive()
const nonEmptyText = z.string().min(1)

export const columnLockedFieldSchema = z.enum(['lengthM', 'materialId', 'forceN', 'support'])
export const columnSectionKindSchema = z.enum(['solid', 'tube'])

export const columnMaterialSchema = z
  .object({
    id: nonEmptyText,
    name: nonEmptyText,
    elasticModulusPa: positive,
    densityKgM3: positive,
    allowableStressPa: positive,
    yieldStressPa: positive,
  })
  .strict()

export const columnSectionLimitsSchema = z
  .object({
    solid: z.object({ diameterM: paramRangeSchema }).strict(),
    tube: z.object({ outerDiameterM: paramRangeSchema, wallThicknessM: paramRangeSchema }).strict(),
  })
  .strict()

export const columnChallengeSchema = z
  .object({
    id: nonEmptyText,
    version: z.number().int().positive(),
    model: z.object({ id: z.literal('eulerColumnBuckling'), version: z.literal(1) }).strict(),
    title: nonEmptyText,
    difficulty: difficultySchema,
    allowedModes: z.array(interactionModeSchema).nonempty(),
    statement: nonEmptyText,
    material: columnMaterialSchema,
    lengthM: positive,
    support: z.literal('pinnedPinned'),
    load: z.object({ forceN: positive, direction: z.literal('down'), location: z.literal('centroid') }).strict(),
    initialDesign: columnDesignSchema,
    referenceDesign: columnDesignSchema.optional(),
    lockedFields: z.array(columnLockedFieldSchema),
    constraints: z
      .object({
        minBucklingSafetyFactor: positive,
        maxAxialStressPa: positive,
        maxMassKg: positive,
      })
      .strict(),
    sectionLimits: columnSectionLimitsSchema,
    sectionDefaults: z.object({ tubeWallM: positive }).strict(),
    allowedSections: z.array(columnSectionKindSchema).nonempty(),
    predictionPolicy: z.object({ requiredOnIterations: z.array(z.number().int().positive()) }).strict(),
    reflectionPrompt: z.object({ id: nonEmptyText, text: nonEmptyText }).strict(),
  })
  .strict()

/** Parsed output is assignable to the hand-written ColumnChallenge type (checked at compile time). */
export type ColumnChallengeSchemaOutput = z.infer<typeof columnChallengeSchema>
const outputIsChallenge: (c: ColumnChallengeSchemaOutput) => ColumnChallenge = (c) => c
void outputIsChallenge
