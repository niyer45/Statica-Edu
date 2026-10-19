import { beamBending } from './modules/beamBending'
import { torsion } from './modules/torsion'
import { stressStrain } from './modules/stressStrain'
import type { LearnModule, Subject } from './types'

// Learn catalog (task 67; LRN-01): subjects → topics → modules. Available modules have content; the
// rest are Planned placeholders with no content, following the owner's vision (2026-10-18).

export const LEARN_SUBJECTS: readonly Subject[] = [
  {
    id: 'solid-mechanics',
    title: 'Solid mechanics',
    topics: [
      {
        id: 'mechanics-of-materials',
        title: 'Mechanics of materials',
        modules: [
          { status: 'available', module: beamBending },
          { status: 'available', module: torsion }, // task 71 (D-61)
          { status: 'available', module: stressStrain }, // task 72 (D-62)
          { status: 'planned', id: 'buckling', title: 'Buckling', summary: 'When slender members fail by suddenly bowing sideways.' },
        ],
      },
      {
        id: 'structural-dynamics',
        title: 'Structural dynamics',
        modules: [
          { status: 'planned', id: 'resonance', title: 'Natural frequency and resonance', summary: 'Why structures shake hardest at one frequency.' },
        ],
      },
    ],
  },
  {
    id: 'heat-transfer',
    title: 'Heat transfer',
    topics: [
      {
        id: 'conduction-convection',
        title: 'Conduction and convection',
        modules: [
          { status: 'planned', id: 'fins', title: 'Fins and heat sinks', summary: 'How extra surface area moves heat away.' },
        ],
      },
    ],
  },
]

export const LEARN_MODULES: readonly LearnModule[] = LEARN_SUBJECTS.flatMap((s) =>
  s.topics.flatMap((t) => t.modules.flatMap((m) => (m.status === 'available' ? [m.module] : []))),
)

export function learnModule(id: string): LearnModule | undefined {
  return LEARN_MODULES.find((m) => m.id === id)
}
