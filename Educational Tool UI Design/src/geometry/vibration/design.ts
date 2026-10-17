import { z } from 'zod'

// Vibration Isolation I design type and structural schema (task 50.2; vibration-isolation-1
// VIB-04, VIB-05). The student chooses the total isolator stiffness and the isolator material,
// whose equivalent viscous damping ratio comes from the challenge's material list. Mass,
// operating band, base amplitude and mount stroke are challenge constants (locked fields), so
// they are not design fields. Ranges and material membership live in the validator
// (geometry/vibration/validate.ts); the 0.5 kN/m step sets input granularity only.

export interface VibrationDesign {
  id: string
  /** Total isolator stiffness k, N/m. */
  stiffnessNPerM: number
  /** One of the challenge's material ids; sets the damping ratio ζ. */
  materialId: string
}

/** Structural shape only; the stiffness range and material membership live in the validator. */
export const vibrationDesignSchema = z
  .object({
    id: z.string().min(1),
    stiffnessNPerM: z.number().finite().positive(),
    materialId: z.string().min(1),
  })
  .strict()

// Compile-time guarantee that the schema and the hand-written type stay identical.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const designTypesMatch: Equal<z.infer<typeof vibrationDesignSchema>, VibrationDesign> = true
void designTypesMatch
