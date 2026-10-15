import type { SectionKind } from '../challenge/types'

// Editable parameters per section kind, in validator order, plus student-facing labels.
// Shared by handles.ts; clamp.ts may reuse this module later to avoid a duplicate list.

export const SECTION_PARAMS = {
  circle: ['diameterM'],
  tube: ['outerDiameterM', 'innerDiameterM'],
  rectangle: ['widthM', 'heightM'],
  iSection: ['widthM', 'heightM', 'flangeThicknessM', 'webThicknessM'],
} as const satisfies Record<SectionKind, readonly string[]>

export type SectionParam = (typeof SECTION_PARAMS)[SectionKind][number]

export const PARAM_LABELS: Record<SectionParam, string> = {
  diameterM: 'Diameter',
  outerDiameterM: 'Outer diameter',
  innerDiameterM: 'Inner diameter',
  widthM: 'Width',
  heightM: 'Height',
  flangeThicknessM: 'Flange thickness',
  webThicknessM: 'Web thickness',
}
