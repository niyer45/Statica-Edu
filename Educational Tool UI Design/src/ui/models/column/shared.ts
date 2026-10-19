import type { SectionKind } from '../../../challenge/types'
import type { ColumnChallenge } from '../../../challenge/column/types'
import type { ColumnConstraintResult } from '../../../evaluation/column/types'
import type { ColumnDesign, ColumnSectionKind } from '../../../geometry/column/design'
import type { ColumnAction, ColumnSession } from '../../../state/columnModel'
import { formatMm, m2ToMm2, m4ToMm4, nToKn, paToMpa } from '../../../units/units'
import { useModelStore } from '../../state/store'

// Shared helpers for the Column Buckling I UI (task 68). Display formatting only; every value shown
// comes from a stored column analysis/evaluation or the challenge config.

export type StudentColumnChallenge = Omit<ColumnChallenge, 'referenceDesign'>

/** The active column store; the model UI registry guarantees the active model is the column. */
export const useColumnStore = () => useModelStore<ColumnSession, ColumnAction, StudentColumnChallenge>()

/** Display units of stored column values. */
export type ColumnDisplayUnit = 'N' | 'Pa' | 'kg' | 'm' | 'm2' | 'm4' | 'NPerKg' | 'ratio' | 'bool'

/** Display text for a stored column value or limit. */
export function formatColumn(value: number, unit: ColumnDisplayUnit): string {
  if (unit === 'N') return `${nToKn(value).toFixed(2)} kN`
  if (unit === 'Pa') return `${paToMpa(value).toFixed(1)} MPa`
  if (unit === 'kg') return `${value.toFixed(2)} kg`
  if (unit === 'm') return `${formatMm(value, 1)} mm`
  if (unit === 'm2') return `${m2ToMm2(value).toFixed(0)} mm²`
  if (unit === 'm4') return `${m4ToMm4(value).toFixed(0)} mm⁴`
  if (unit === 'NPerKg') return `${value.toFixed(0)} N/kg`
  if (unit === 'ratio') return value.toFixed(2)
  return ''
}

/** The limit of a stored constraint, with "≥" for the minimum check (critical load). */
export function formatLimit(c: Pick<ColumnConstraintResult, 'limit' | 'unit' | 'sense'>): string {
  if (c.unit === 'bool') return ''
  return `${c.sense === 'min' ? '≥ ' : ''}${formatColumn(c.limit, c.unit)}`
}

export const COLUMN_SECTION_NAMES: Readonly<Record<ColumnSectionKind, string>> = { solid: 'Solid bar', tube: 'Hollow tube' }

/** The template cross-section glyph for a column section kind. */
export const COLUMN_SECTION_ICONS: Readonly<Record<ColumnSectionKind, SectionKind>> = { solid: 'circle', tube: 'tube' }

/** Short design description for history rows. */
export function designLabel(d: Readonly<ColumnDesign>): string {
  return d.section.kind === 'solid'
    ? `Ø${formatMm(d.section.diameterM, 1)} mm`
    : `Ø${formatMm(d.section.outerDiameterM, 1)} × ${formatMm(d.section.wallThicknessM, 1)} mm wall`
}
