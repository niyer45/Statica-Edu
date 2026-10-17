import { z } from 'zod'
import { beamDesignSchema } from '../geometry/sections'
import type { Challenge } from './types'

// Structural schema for challenge JSON. Every object is `.strict()` so unknown keys are
// rejected at any nesting level. Cross-field rules (range min ≤ max, defaults in range,
// I-section/tube minimums) are applied by the loader on top of this schema.

const positive = z.number().finite().positive()
const nonEmptyText = z.string().min(1)

export const difficultySchema = z.enum(['introductory', 'intermediate', 'advanced'])
export const interactionModeSchema = z.enum(['guided', 'parametric', 'freeform'])
export const lockedFieldSchema = z.enum(['lengthM', 'materialId', 'forceN', 'support'])
export const sectionKindSchema = z.enum(['circle', 'tube', 'rectangle', 'iSection'])

export const materialSchema = z
  .object({
    id: nonEmptyText,
    name: nonEmptyText,
    elasticModulusPa: positive,
    densityKgM3: positive,
    allowableStressPa: positive,
    yieldStressPa: positive,
  })
  .strict()

export const paramRangeSchema = z
  .object({ minM: positive, maxM: positive, stepM: positive })
  .strict()

export const sectionLimitsSchema = z
  .object({
    circle: z.object({ diameterM: paramRangeSchema }).strict(),
    tube: z.object({ outerDiameterM: paramRangeSchema, minWallM: positive }).strict(),
    rectangle: z.object({ widthM: paramRangeSchema, heightM: paramRangeSchema }).strict(),
    iSection: z
      .object({
        widthM: paramRangeSchema,
        heightM: paramRangeSchema,
        minFlangeThicknessM: positive,
        minWebThicknessM: positive,
        minClearWebHeightM: positive,
      })
      .strict(),
  })
  .strict()

export const sectionDefaultsSchema = z
  .object({
    tubeWallM: positive,
    iSectionFlangeThicknessM: positive,
    iSectionWebThicknessM: positive,
  })
  .strict()

export const challengeSchema = z
  .object({
    id: nonEmptyText,
    version: z.number().int().positive(),
    // This schema describes beam configs only; other models get their own schemas (MM-02).
    model: z
      .object({ id: z.literal('eulerBernoulliCantileverTipForce'), version: z.literal(1) })
      .strict()
      .optional(),
    title: nonEmptyText,
    // difficulty and allowedModes are independent fields; neither constrains the other.
    difficulty: difficultySchema,
    allowedModes: z.array(interactionModeSchema).nonempty(),
    statement: nonEmptyText,
    material: materialSchema,
    initialDesign: beamDesignSchema,
    referenceDesign: beamDesignSchema.optional(),
    lockedFields: z.array(lockedFieldSchema),
    support: z.literal('fixedRoot'),
    load: z
      .object({
        forceN: positive,
        location: z.literal('freeEnd'),
        direction: z.literal('down'),
      })
      .strict(),
    constraints: z
      .object({
        maxMassKg: positive,
        maxDeflectionM: positive,
        maxStressPa: positive,
        maxWidthM: positive,
        maxHeightM: positive,
      })
      .strict(),
    sectionLimits: sectionLimitsSchema,
    sectionDefaults: sectionDefaultsSchema,
    allowedSections: z.array(sectionKindSchema).nonempty(),
    predictionPolicy: z
      .object({ requiredOnIterations: z.array(z.number().int().positive()) })
      .strict(),
    reflectionPrompt: z.object({ id: nonEmptyText, text: nonEmptyText }).strict(),
    visualization: z
      .object({ exaggerationFactor: positive, maxVisualDeflectionFractionOfL: positive })
      .strict(),
    content: z
      .object({
        conceptNotes: z.record(z.string(), z.string()),
        collegeDetails: z.boolean(),
      })
      .strict(),
  })
  .strict()

/** Parsed output is assignable to the hand-written Challenge type (checked at compile time). */
export type ChallengeSchemaOutput = z.infer<typeof challengeSchema>
const outputIsChallenge: (c: ChallengeSchemaOutput) => Challenge = (c) => c
void outputIsChallenge
