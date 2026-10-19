import { z } from 'zod'
import { vesselDesignSchema } from '../../geometry/vessel/design'
import { difficultySchema, interactionModeSchema, paramRangeSchema } from '../schema'
import type { VesselChallenge } from './types'

// Structural schema for Pressure Vessel I challenge JSON (task 69). Every object is `.strict()`
// so unknown keys are rejected at any nesting level. The model identity is required and must be
// exactly `thinWallPressureVessel` v1 (MM-02). Cross-field rules (ranges, design factor, design
// consistency, locked fields) are applied by the loader. There is deliberately no field for the
// allowable stress or the screen thresholds.

const positive = z.number().finite().positive()
const nonEmptyText = z.string().min(1)

export const vesselLockedFieldSchema = z.enum(['materialId', 'pressurePa', 'designFactor', 'heads'])

export const vesselMaterialSchema = z
  .object({
    id: nonEmptyText,
    name: nonEmptyText,
    densityKgM3: positive,
    yieldStressPa: positive,
  })
  .strict()

export const vesselDesignLimitsSchema = z
  .object({
    innerDiameterM: paramRangeSchema,
    shellLengthM: paramRangeSchema,
    shellThicknessM: paramRangeSchema,
    headThicknessM: paramRangeSchema,
  })
  .strict()

export const vesselChallengeSchema = z
  .object({
    id: nonEmptyText,
    version: z.number().int().positive(),
    model: z.object({ id: z.literal('thinWallPressureVessel'), version: z.literal(1) }).strict(),
    title: nonEmptyText,
    difficulty: difficultySchema,
    allowedModes: z.array(interactionModeSchema).nonempty(),
    statement: nonEmptyText,
    material: vesselMaterialSchema,
    designFactor: positive,
    pressurePa: positive,
    heads: z.literal('hemispherical'),
    initialDesign: vesselDesignSchema,
    referenceDesign: vesselDesignSchema.optional(),
    lockedFields: z.array(vesselLockedFieldSchema),
    constraints: z
      .object({
        minVolumeM3: positive,
        maxOverallLengthM: positive,
        maxMassKg: positive,
      })
      .strict(),
    designLimits: vesselDesignLimitsSchema,
    predictionPolicy: z
      .object({ requiredOnIterations: z.array(z.number().int().positive()) })
      .strict(),
    reflectionPrompt: z.object({ id: nonEmptyText, text: nonEmptyText }).strict(),
  })
  .strict()

/** Parsed output is assignable to the hand-written VesselChallenge type (checked at compile time). */
export type VesselChallengeSchemaOutput = z.infer<typeof vesselChallengeSchema>
const outputIsChallenge: (c: VesselChallengeSchemaOutput) => VesselChallenge = (c) => c
void outputIsChallenge
