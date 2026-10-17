import { z } from 'zod'
import { bracedFrameDesignSchema } from '../../geometry/bracedFrame/design'
import { difficultySchema, interactionModeSchema } from '../schema'
import type { BracedFrameChallenge } from './types'

// Structural schema for Braced Frame I challenge JSON (task 49.2; BFR-01–BFR-09). Every object is
// `.strict()` so unknown keys are rejected at any nesting level. The model identity is required
// and must be exactly `pinJointedBracedFrame` v1 (MM-02); any other id or version fails here, as
// does any template other than `oneBayTwoStorey`. Numbers must be finite. Cross-field rules
// (section walls, duplicate ids, load placement, design consistency, locked fields) are applied
// by the loader. This schema is separate from the beam and torsion schemas, which are unchanged.

const positive = z.number().finite().positive()
const finite = z.number().finite()
const nonEmptyText = z.string().min(1)

export const bracedFrameLockedFieldSchema = z.enum(['frame', 'supports', 'loads', 'materialId', 'fixedMembers'])
export const frameJointIdSchema = z.enum(['j1', 'j2', 'j3', 'j4', 'j5', 'j6'])

export const frameMaterialSchema = z
  .object({
    id: nonEmptyText,
    name: nonEmptyText,
    elasticModulusPa: positive,
    yieldStressPa: positive,
    densityKgM3: positive,
  })
  .strict()

export const chsSectionSchema = z
  .object({ id: nonEmptyText, label: nonEmptyText, outerDiameterM: positive, wallM: positive })
  .strict()

export const frameJointLoadSchema = z.object({ jointId: frameJointIdSchema, fxN: finite, fyN: finite }).strict()

export const bracedFrameChallengeSchema = z
  .object({
    id: nonEmptyText,
    version: z.number().int().positive(),
    model: z.object({ id: z.literal('pinJointedBracedFrame'), version: z.literal(1) }).strict(),
    title: nonEmptyText,
    difficulty: difficultySchema,
    allowedModes: z.array(interactionModeSchema).nonempty(),
    statement: nonEmptyText,
    material: frameMaterialSchema,
    frame: z
      .object({ template: z.literal('oneBayTwoStorey'), bayWidthM: positive, storeyHeightM: positive })
      .strict(),
    supports: z.literal('pinnedBases'),
    loads: z.array(frameJointLoadSchema).nonempty(),
    sections: z.array(chsSectionSchema).nonempty(),
    initialDesign: bracedFrameDesignSchema,
    referenceDesign: bracedFrameDesignSchema.optional(),
    lockedFields: z.array(bracedFrameLockedFieldSchema),
    constraints: z.object({ maxRoofDriftM: positive, maxUtilization: positive, maxMassKg: positive }).strict(),
    predictionPolicy: z
      .object({ requiredOnIterations: z.array(z.number().int().positive()) })
      .strict(),
    reflectionPrompt: z.object({ id: nonEmptyText, text: nonEmptyText }).strict(),
    visualization: z
      .object({ displacementExaggeration: positive, maxVisualDisplacementM: positive })
      .strict(),
  })
  .strict()

/** Parsed output is assignable to the hand-written BracedFrameChallenge type (checked at compile time). */
export type BracedFrameChallengeSchemaOutput = z.infer<typeof bracedFrameChallengeSchema>
const outputIsChallenge: (c: BracedFrameChallengeSchemaOutput) => BracedFrameChallenge = (c) => c
void outputIsChallenge
