import { z } from 'zod'
import { bracketDesignSchema } from '../../geometry/bracket/design'
import { difficultySchema, interactionModeSchema, paramRangeSchema } from '../schema'
import type { BracketChallenge } from './types'

// Structural schema for Mounting Bracket I challenge JSON (task 55 L-bracket). Every object is
// `.strict()` so unknown keys are rejected at any nesting level. The model identity is required
// and must be exactly `boltedLBracket` v1 (MM-02); any other id or version, including the retired
// `steppedBarBracket`, fails here. Cross-field rules (ranges, the bolt row clearing the bend,
// design consistency, locked fields) are applied by the loader. There is deliberately no field for
// the curved-beam validity limit or the screen thresholds.

const positive = z.number().finite().positive()
const nonEmptyText = z.string().min(1)

export const bracketLockedFieldSchema = z.enum(['loadOffsetM', 'materialId', 'forceN', 'bolts', 'support'])

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
    thicknessM: paramRangeSchema,
    widthM: paramRangeSchema,
    flangeHeightM: paramRangeSchema,
    innerRadiusM: paramRangeSchema,
  })
  .strict()

export const bracketChallengeSchema = z
  .object({
    id: nonEmptyText,
    version: z.number().int().positive(),
    model: z.object({ id: z.literal('boltedLBracket'), version: z.literal(1) }).strict(),
    title: nonEmptyText,
    difficulty: difficultySchema,
    allowedModes: z.array(interactionModeSchema).nonempty(),
    statement: nonEmptyText,
    material: bracketMaterialSchema,
    loadOffsetM: positive,
    tipOverhangM: positive,
    bolts: z.object({ count: z.number().int().positive(), edgeDistanceM: positive }).strict(),
    support: z.literal('boltedWall'),
    load: z
      .object({ forceN: positive, location: z.literal('loadLine'), direction: z.literal('down') })
      .strict(),
    initialDesign: bracketDesignSchema,
    referenceDesign: bracketDesignSchema.optional(),
    lockedFields: z.array(bracketLockedFieldSchema),
    constraints: z
      .object({
        maxBendStressPa: positive,
        maxDeflectionM: positive,
        maxBoltTensionN: positive,
        maxMassKg: positive,
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
