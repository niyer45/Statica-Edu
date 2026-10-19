import { LEARN_SUBJECTS } from '../../learn/catalog'
import { moduleStatus, readProgress, type LearnStorage } from '../../learn/progress'
import type { LearnModule } from '../../learn/types'
import Icon from '../icons/Icon'
import TechnicalArt from '../shell/TechnicalArt'
import './learn.css'

// Learn hub (task 67; LRN-01, LRN-08): subjects → topics → modules. Available modules show their
// progress on this device; planned ones are labelled Planned and have no content.

export interface LearnPageProps {
  storage: LearnStorage
  onOpen: (module: LearnModule) => void
}

function progressText(done: number, total: number): string {
  if (done === 0) return 'Not started'
  return done === total ? 'Completed' : `${done} of ${total} steps done`
}

export default function LearnPage({ storage, onOpen }: LearnPageProps) {
  return (
    <div className="learn-hub">
      <section className="library-heading">
        <span className="eyebrow">LEARN</span>
        <h1>Learn</h1>
        <p>Short modules that build the intuition behind each challenge: read a little, predict, then check with an interactive model.</p>
      </section>
      {LEARN_SUBJECTS.map((subject) => (
        <section key={subject.id} className="learn-subject" aria-labelledby={`subject-${subject.id}`}>
          <h2 id={`subject-${subject.id}`}>{subject.title}</h2>
          {subject.topics.map((topic) => (
            <div key={topic.id} className="learn-topic">
              <h3 id={`topic-${topic.id}`}>{topic.title}</h3>
              <ul className="learn-cards" aria-labelledby={`topic-${topic.id}`}>
                {topic.modules.map((entry) => {
                  if (entry.status === 'planned') {
                    return (
                      <li key={entry.id} className="learn-card learn-card-planned">
                        <div>
                          <span className="learn-tag">Planned</span>
                          <h4>{entry.title}</h4>
                          <p>{entry.summary}</p>
                        </div>
                      </li>
                    )
                  }
                  const m = entry.module
                  const s = moduleStatus(m, readProgress(storage, m))
                  return (
                    <li key={m.id} className="learn-card panel">
                      <TechnicalArt kind={m.art} />
                      <div>
                        <span className="learn-tag learn-tag-available">Available now</span>
                        <h4>{m.title}</h4>
                        <p>{m.summary}</p>
                        <p className="learn-card-meta">
                          <span>
                            <Icon name="clock" size={13} />
                            {m.time}
                          </span>
                          <span>{m.steps.length} steps, then {m.apply.title}</span>
                        </p>
                        <p className="learn-card-progress">{progressText(s.completed, s.total)}</p>
                        <button type="button" className="primary" aria-label={`${s.completed === 0 ? 'Start' : s.done ? 'Review' : 'Continue'} ${m.title}`} onClick={() => onOpen(m)}>
                          {s.completed === 0 ? 'Start module' : s.done ? 'Review module' : 'Continue module'}
                          <Icon name="arrow" size={14} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
