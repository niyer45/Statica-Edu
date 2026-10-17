import { z } from 'zod'
import { torsionDesignSchema } from '../../geometry/torsion/design'
import { difficultySchema, interactionModeSchema, paramRangeSchema } from '../schema'
import type { TorsionChallenge } from './types'

// Structural schema for Torsion Shaft I challenge JSON (task 47.2). Every object is `.strict()`
// so unknown keys are rejected at any nesting level. The model identity is required and must be
// exactly `circularShaftTorsion` v1 (MM-02); any other id or version fails here. Cross-field rules
// (ranges, wall minimum, defaults, design consistency, locked fields) are applied by the loader.
// This schema is separate from the beam `challengeSchema`, which is unchanged.

const positive = z.number().finite().positive()
const nonEmptyText = z.string().min(1)

export const torsionLockedFieldSchema = z.enum(['lengthM', 'materialId', 'torqueNm', 'support'])
export const torsionSectionKindSchema = z.enum(['circle', 'tube'])

export const torsionMaterialSchema = z
  .object({
    id: nonEmptyText,
    name: nonEmptyText,
    shearModulusPa: positive,
    densityKgM3: positive,
    allowableShearStressPa: positive,
    yieldShearStressPa: positive,
  })
  .strict()

export const torsionSectionLimitsSchema = z
  .object({
    circle: z.object({ diameterM: paramRangeSchema }).strict(),
    tube: z.object({ outerDiameterM: paramRangeSchema, minWallM: positive }).strict(),
  })
  .strict()

export const torsionChallengeSchema = z
  .object({
    id: nonEmptyText,
    version: z.number().int().positive(),
    model: z.object({ id: z.literal('circularShaftTorsion'), version: z.literal(1) }).strict(),
    title: nonEmptyText,
    difficulty: difficultySchema,
    allowedModes: z.array(interactionModeSchema).nonempty(),
    statement: nonEmptyText,
    material: torsionMaterialSchema,
    lengthM: positive,
    torqueNm: positive,
    support: z.literal('fixedEnd'),
    initialDesign: torsionDesignSchema,
    referenceDesign: torsionDesignSchema.optional(),
    lockedFields: z.array(torsionLockedFieldSchema),
    constraints: z
      .object({
        maxTwistRad: positive,
        maxShearStressPa: positive,
        maxMassKg: positive,
        maxOuterDiameterM: positive,
      })
      .strict(),
    sectionLimits: torsionSectionLimitsSchema,
    sectionDefaults: z.object({ tubeWallM: positive }).strict(),
    allowedSections: z.array(torsionSectionKindSchema).nonempty(),
    predictionPolicy: z
      .object({ requiredOnIterations: z.array(z.number().int().positive()) })
      .strict(),
    reflectionPrompt: z.object({ id: nonEmptyText, text: nonEmptyText }).strict(),
    visualization: z
      .object({ twistExaggerationFactor: positive, maxVisualTwistRad: positive })
      .strict(),
  })
  .strict()

/** Parsed output is assignable to the hand-written TorsionChallenge type (checked at compile time). */
export type TorsionChallengeSchemaOutput = z.infer<typeof torsionChallengeSchema>
const outputIsChallenge: (c: TorsionChallengeSchemaOutput) => TorsionChallenge = (c) => c
void outputIsChallenge
