import { deepFreeze } from './deepFreeze'
import type { Difficulty } from './types'

// Static challenge-library metadata for the platform shell, moved from the template App.tsx.
// Available entries link to a bundled challenge JSON (`challenge/bundled.ts`). All six original
// challenges are available (owner-approved activations D-42–D-44), plus the owner-requested
// Column Buckling I (D-58). An unavailable entry would be
// a concept preview with no physics or challenge data until its track is verified.

export type Discipline = 'Mechanics' | 'Structures' | 'Thermal' | 'Dynamics'
export type ArtKind = 'beam' | 'bracket' | 'shaft' | 'thermal' | 'frame' | 'spring' | 'column'

interface CatalogEntryBase {
  /** Library number shown on cards, e.g. "001". */
  id: string
  title: string
  description: string
  discipline: Discipline
  difficulty: Difficulty
  /** Display estimate, e.g. "15–20 min". */
  time: string
  concepts: string[]
  art: ArtKind
}

export type CatalogEntry =
  | (CatalogEntryBase & { available: true; challengeId: string })
  | (CatalogEntryBase & { available: false })

/** Display labels for difficulty, matching the template filter options. */
export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = deepFreeze({
  introductory: 'Introductory',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
})

export const DISCIPLINES: readonly Discipline[] = deepFreeze([
  'Mechanics',
  'Structures',
  'Thermal',
  'Dynamics',
])

export const catalog: readonly CatalogEntry[] = deepFreeze<CatalogEntry[]>([
  {
    id: '001',
    title: 'Cantilever Beam I',
    description: 'Reduce tip deflection within mass and stress limits.',
    discipline: 'Mechanics',
    difficulty: 'introductory',
    time: '15–20 min',
    concepts: ['Bending', 'Material efficiency'],
    available: true,
    challengeId: 'cantilever-beam-1',
    art: 'beam',
  },
  {
    id: '002',
    title: 'Mounting Bracket I',
    description: 'Rethink a mounting bracket that carries more stress than it should.',
    discipline: 'Structures',
    difficulty: 'intermediate',
    time: '25–35 min',
    concepts: ['Load paths', 'Stress concentrations'],
    available: true,
    challengeId: 'mounting-bracket-1',
    art: 'bracket',
  },
  {
    id: '003',
    title: 'Torsion Shaft I',
    description: 'Balance torsional stiffness, weight, and packaging in a rotating shaft.',
    discipline: 'Mechanics',
    difficulty: 'intermediate',
    time: '20–30 min',
    concepts: ['Torsion', 'Section properties'],
    available: true,
    challengeId: 'torsion-shaft-1',
    art: 'shaft',
  },
  {
    id: '004',
    title: 'Heat Sink I',
    description: 'Explore how geometry helps a compact heat sink move heat away.',
    discipline: 'Thermal',
    difficulty: 'intermediate',
    time: '25–35 min',
    concepts: ['Heat transfer', 'Surface area'],
    available: true,
    challengeId: 'heat-sink-1',
    art: 'thermal',
  },
  {
    id: '005',
    title: 'Braced Frame I',
    description: 'Follow the forces through a frame and strengthen what matters.',
    discipline: 'Structures',
    difficulty: 'advanced',
    time: '35–45 min',
    concepts: ['Frame analysis', 'Stability'],
    available: true,
    challengeId: 'braced-frame-1',
    art: 'frame',
  },
  {
    id: '006',
    title: 'Vibration Isolation I',
    description: 'Tune a component to keep unwanted vibration out of its operating range.',
    discipline: 'Dynamics',
    difficulty: 'advanced',
    time: '30–40 min',
    concepts: ['Natural frequency', 'Vibration'],
    available: true,
    challengeId: 'vibration-isolation-1',
    art: 'spring',
  },
  {
    // Task 68: requested by the owner on 2026-10-19 ("Buckling Challenge (Introductory)"), D-58.
    id: '007',
    title: 'Column Buckling I',
    description: 'Keep a slender column from buckling without making it heavy.',
    discipline: 'Structures',
    difficulty: 'introductory',
    time: '15–20 min',
    concepts: ['Buckling', 'Section properties'],
    available: true,
    challengeId: 'column-buckling-1',
    art: 'column',
  },
])
