import Icon from '../icons/Icon'
import TechnicalArt from './TechnicalArt'

// Learning paths (task 13.5; Req 34.5). Paths are previews: only the first step of the first
// path (Cantilever Beam I) is available; every other step is "Planned". The first step shows
// "Tested this session" only when the session history holds a non-baseline Test_Result, so
// no progress is shown that the student has not earned in this session.

export interface LearningPath {
  title: string
  description: string
  steps: string[]
  art: string
}

export const LEARNING_PATHS: readonly LearningPath[] = [
  {
    title: 'Foundations of mechanics',
    description: 'Forces, section properties, and load paths.',
    steps: ['Inspect a cantilever', 'Explore section properties', 'Rethink a bracket'],
    art: 'beam',
  },
  {
    title: 'Designing with constraints',
    description: 'Practice the trade-offs that turn a shape into a useful engineering solution.',
    steps: ['Material efficiency', 'Strength versus weight', 'Packaging and geometry'],
    art: 'bracket',
  },
  {
    title: 'Beyond static loads',
    description: 'Discover what changes when heat, motion, and time enter the picture.',
    steps: ['Heat transfer', 'Torsional stiffness', 'Vibration and resonance'],
    art: 'spring',
  },
]

/** Step label: only path 0 step 0 (Cantilever Beam I) is runnable. */
export function stepStatus(pathIndex: number, stepIndex: number, testCount: number): string {
  if (pathIndex !== 0 || stepIndex !== 0) return 'Planned'
  return testCount > 0 ? 'Tested this session' : 'Available'
}

export interface LearningPathsPageProps {
  testCount: number
  onStart: () => void
  onPreview: (title: string) => void
}

export default function LearningPathsPage({ testCount, onStart, onPreview }: LearningPathsPageProps) {
  return (
    <>
      <section className="library-heading">
        <h1>Learning paths</h1>
      </section>
      <div className="path-grid">
        {LEARNING_PATHS.map((p, i) => (
          <article className="path-card panel" key={p.title}>
            <TechnicalArt kind={p.art} />
            <div>
              <span className="eyebrow">LEARNING PATH 0{i + 1}</span>
              <h2>{p.title}</h2>
              <p>{p.description}</p>
              <ol>
                {p.steps.map((s, j) => (
                  <li key={s}>
                    <span>{j + 1}</span>
                    {s}
                    <small>{stepStatus(i, j, testCount)}</small>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className={i === 0 ? 'primary' : 'secondary'}
                onClick={() => (i === 0 ? onStart() : onPreview(p.title))}
              >
                {i === 0 ? 'Start path' : 'Preview learning path'}
                <Icon name="arrow" size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
