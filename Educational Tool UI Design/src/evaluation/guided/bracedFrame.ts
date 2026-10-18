import type { BracedFrameDesign } from '../../geometry/bracedFrame/design'
import type { BracedFrameAnalysis } from '../../physics/bracedFrame/types'
import type { GuidedPlan } from './plan'

// Braced Frame I guided experiments (task 58). Step data only. Parameter ids are
// `<member>.present` for each candidate diagonal and `<member>.section` for every member.

type R = { analysis: BracedFrameAnalysis }

export const BRACED_FRAME_GUIDED_PLAN: GuidedPlan<BracedFrameDesign, R> = Object.freeze({
  params: (d: Readonly<BracedFrameDesign>) =>
    Object.fromEntries(
      Object.entries(d.members).flatMap(([id, m]: [string, { present?: boolean; sectionId: string }]) => [
        ...(m.present === undefined ? [] : [[`${id}.present`, m.present] as const]),
        [`${id}.section`, m.sectionId] as const,
      ]),
    ),
  label: (id: string) => (id.endsWith('.present') ? 'Diagonal bracing' : 'Member sections'),
  metrics: {
    maxStoreyDriftRatio: { label: 'Storey drift', read: (r: Readonly<R>) => (r.analysis.status === 'solved' ? r.analysis.maxStoreyDriftRatio : undefined) },
    maxUtilization: { label: 'Highest member utilization', read: (r: Readonly<R>) => (r.analysis.status === 'solved' ? r.analysis.maxUtilization : undefined) },
    massKg: { label: 'Mass', read: (r: Readonly<R>) => r.analysis.massKg },
  },
  steps: [
    {
      id: 'bracing',
      title: 'Rearrange the bracing',
      instruction: 'Add, remove or swap diagonals without changing any member size. Predict how the sideways drift will change, then Run Test.',
      hint: 'A storey without a diagonal is a mechanism: pin joints alone cannot resist sideways load. Swapping a diagonal switches it between tension and compression.',
      focus: 'Diagonal bracing',
      unlocks: ['*.present'],
      objective: { kind: 'change', params: ['*.present'], direction: 'any' },
      observe: ['maxStoreyDriftRatio', 'maxUtilization', 'massKg'],
    },
    {
      id: 'sections',
      title: 'Resize members',
      instruction: 'Change member sections while keeping the bracing. Predict, then test: which members control drift and utilization?',
      hint: 'Upsize the governing member first. A diagonal in compression can buckle, so a larger tube helps it most.',
      focus: 'Member sections',
      unlocks: ['*.section'],
      objective: { kind: 'change', params: ['*.section'], direction: 'any' },
      observe: ['maxUtilization', 'maxStoreyDriftRatio', 'massKg'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Bracing and sections are both unlocked. Combine what your experiments showed and Run Test until a frame passes every check.',
      hint: 'Brace every storey, compare diagonal directions using your tested member forces, then trim sections toward the mass limit.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<BracedFrameDesign, R>)
