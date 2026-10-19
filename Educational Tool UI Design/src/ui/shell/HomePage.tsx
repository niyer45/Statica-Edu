import { useEffect, useRef, useState } from 'react'
import type { CatalogEntry } from '../../challenge/catalog'
import type { AccountContextValue } from '../account/AccountContext'
import Icon from '../icons/Icon'
import { storageStatement } from './progress'
import type { AccountView } from './routes'
import TechnicalArt from './TechnicalArt'
import './home.css'

// Landing page (tasks 38, 62, 63): a standalone front page, outside the workspace chrome, for
// students, educators and investors: what Statica is, the learning loop, what is available now,
// and where the platform is going (owner vision, 2026-10-18). Its own header links to the page
// sections and into the app. Every capability is labelled Available now, Early or Planned so
// nothing planned reads as shipped. Per-challenge progress lives in My designs.

export type Readiness = 'Available now' | 'Early' | 'Planned'

export const LEARNING_LOOP: readonly { step: string; text: string }[] = [
  { step: 'Learn', text: 'Each challenge opens with a plain-language brief and a reference sheet with the governing equations.' },
  { step: 'Experiment', text: 'Change the geometry and watch the model respond in 3D, or in 2D when 3D is unavailable.' },
  { step: 'Predict', text: 'Before key tests, commit to a prediction, then see how it compared with the result.' },
  { step: 'Design', text: 'Iterate toward a design that meets real limits on stress, deflection, mass and more.' },
  { step: 'Evaluate', text: 'Every test is checked against the requirements and explained; submit a design with a written reflection.' },
]

export const AVAILABLE_FEATURES: readonly string[] = [
  'Six design challenges across structures, mechanics, dynamics and heat transfer, with every result computed by an engineering model',
  'Guided mode: one-variable experiments, step by step. Parametric mode: open design with every parameter free',
  'Design history, side-by-side comparison and restore of earlier iterations',
  'Prediction checkpoints and written reflections that build intuition, not just answers',
  'Runs in the browser with nothing to install; progress saves on this device, with an optional local account',
  'Design files that can be exported and opened again',
]

export const PILLARS: readonly { title: string; readiness: Readiness; text: string }[] = [
  { title: 'Interactive engineering simulations', readiness: 'Available now', text: 'Manipulate an engineering system and see its behavior change, with immediate visual feedback. Six models today.' },
  { title: 'Engineering design challenges', readiness: 'Available now', text: 'An objective, performance requirements and constraints; students iterate toward a design that meets them.' },
  { title: 'Guided learning modules', readiness: 'Early', text: 'Guided mode already sequences experiments. Planned: short concept lessons, demonstrations, prediction questions and optional deeper derivations.' },
  { title: 'Curriculum and progression', readiness: 'Planned', text: 'Learning paths from subject to topic to module, for example Solid Mechanics → Mechanics of Materials → Beam Bending → Cantilever Beam Design, while every module stays usable on its own.' },
]

export const DISCIPLINES: readonly { name: string; example: string; readiness: Readiness }[] = [
  { name: 'Solid mechanics', example: 'Design a lightweight beam', readiness: 'Available now' },
  { name: 'Structural dynamics', example: 'Tune a mount to keep vibration out of the operating range', readiness: 'Available now' },
  { name: 'Heat transfer', example: 'Design a heat sink', readiness: 'Available now' },
  { name: 'Materials', example: 'Select materials for a constrained design', readiness: 'Planned' },
  { name: 'Fluid mechanics', example: 'Optimize a piping system', readiness: 'Planned' },
  { name: 'Aerodynamics', example: 'Modify an airfoil to meet performance targets', readiness: 'Planned' },
  { name: 'Thermodynamics', example: 'Optimize a power cycle', readiness: 'Planned' },
  { name: 'Controls', example: 'Tune a controller for a dynamic system', readiness: 'Planned' },
]

const SECTIONS: readonly [string, string][] = [
  ['How it works', 'loop-title'],
  ['Available now', 'now-title'],
  ['For educators', 'educators-title'],
  ['Vision', 'vision-title'],
]

/** Moves to a section heading: scroll it into view and focus it, so keyboard users land there too. */
function jumpTo(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  target.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  target.focus({ preventScroll: true })
}

function ReadinessTag({ readiness }: { readiness: Readiness }) {
  return <span className={`readiness readiness-${readiness === 'Available now' ? 'now' : readiness.toLowerCase()}`}>{readiness}</span>
}

export interface HomePageProps {
  account: AccountContextValue | null
  entries: readonly CatalogEntry[]
  /** Challenges with saved or open work on this device. */
  startedCount: number
  onBrowse: () => void
  onMyDesigns: () => void
  onAccount: (view?: AccountView) => void
}

export default function HomePage({ account, entries, startedCount, onBrowse, onMyDesigns, onAccount }: HomePageProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  // Keep the one-shot session notice for this visit; the context copy is consumed at once.
  const [notice] = useState(() => account?.notice ?? null)
  useEffect(() => {
    if (notice === null) return
    account?.consumeNotice()
    heading.current?.focus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const user = account?.user ?? null
  const available = entries.filter((e) => e.available)
  return (
    <div className="landing">
      <header className="landing-header">
        <button type="button" className="brand" onClick={() => window.scrollTo?.({ top: 0, behavior: 'smooth' })} aria-label="Statica, top of page">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          statica<span className="brand-dot">.</span>
        </button>
        <nav aria-label="Page sections" className="landing-sections">
          {SECTIONS.map(([label, id]) => (
            <button type="button" key={id} onClick={() => jumpTo(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="landing-header-actions">
          {startedCount > 0 && (
            <button type="button" className="landing-link" onClick={onMyDesigns}>
              My designs
            </button>
          )}
          <button type="button" className="primary" onClick={onBrowse}>
            Open Statica
            <Icon name="arrow" size={14} />
          </button>
        </div>
      </header>
      <main className="home">
      <section className="home-hero panel" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <span className="eyebrow">
            <span className="tiny-dot" />
            ENGINEERING INTUITION
          </span>
          <h1 id="home-title" ref={heading} tabIndex={-1} aria-describedby={notice !== null ? 'home-notice' : undefined}>
            {user ? `Welcome back, ${user.displayName}` : 'Welcome to Statica'}
          </h1>
          <p className="home-tagline">Learn engineering by designing, testing and explaining.</p>
          <p className="home-lede">
            Statica is an interactive engineering education platform. Students connect equations to physical behavior:
            they experiment with a model, predict how it will respond, design a solution to a real requirement and evaluate
            the result. It complements engineering courses rather than replacing them.
          </p>
          {notice !== null && (
            <p id="home-notice" className="home-notice" role="status">
              <Icon name="check" size={15} />
              {notice}
            </p>
          )}
          <div className="home-actions">
            {account && !user ? (
              <>
                <button type="button" className="primary" onClick={() => onAccount('sign-up')}>
                  Create account
                </button>
                <button type="button" className="home-secondary" onClick={() => onAccount('sign-in')}>
                  Sign in
                </button>
                <button type="button" className="home-secondary" onClick={onBrowse}>
                  Continue as guest
                  <Icon name="arrow" size={15} />
                </button>
              </>
            ) : (
              <>
                <button type="button" className="primary" onClick={onBrowse}>
                  Browse challenges
                  <Icon name="arrow" size={15} />
                </button>
                {account && (
                  <button type="button" className="home-secondary" onClick={() => onAccount()}>
                    Account settings
                  </button>
                )}
              </>
            )}
          </div>
          {startedCount > 0 && (
            <p className="home-resume">
              You have {startedCount} challenge{startedCount === 1 ? '' : 's'} started on this device.{' '}
              <button type="button" onClick={onMyDesigns}>
                Open My designs
              </button>
            </p>
          )}
          <p className="home-storage">
            <Icon name="lock" size={15} />
            <span>{storageStatement(account)}</span>
          </p>
        </div>
        <div className="home-hero-art" aria-hidden="true">
          {available.slice(0, 6).map((e) => (
            <TechnicalArt key={e.id} kind={e.art} />
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="loop-title">
        <h2 id="loop-title" tabIndex={-1}>How students learn with Statica</h2>
        <p className="home-section-lede">The goal is engineering intuition, not learning to operate simulation software.</p>
        <ol className="home-loop">
          {LEARNING_LOOP.map((s, i) => (
            <li key={s.step} className="panel">
              <span className="home-loop-number" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3>{s.step}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section" aria-labelledby="now-title">
        <div className="home-section-heading">
          <h2 id="now-title" tabIndex={-1}>Available now</h2>
          <ReadinessTag readiness="Available now" />
        </div>
        <ul className="home-challenges" aria-label="Challenges available now">
          {available.map((e) => (
            <li key={e.id} className="panel">
              <TechnicalArt kind={e.art} />
              <div>
                <h3>{e.title}</h3>
                <p>{e.discipline} · {e.concepts.slice(0, 2).join(', ')}</p>
              </div>
            </li>
          ))}
        </ul>
        <ul className="home-features">
          {AVAILABLE_FEATURES.map((f) => (
            <li key={f}>
              <Icon name="check" size={14} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section home-audiences" aria-label="Who Statica is for">
        <article className="panel" aria-labelledby="students-title">
          <h2 id="students-title">For students</h2>
          <ul>
            <li><strong>Undergraduates</strong> reinforce lecture concepts by seeing how stress, stiffness and mass respond to a design change.</li>
            <li><strong>High school students</strong> explore foundational principles through accessible, visual challenges.</li>
            <li><strong>Independent learners</strong> work at their own pace, with Guided steps when they want structure.</li>
          </ul>
        </article>
        <article className="panel" aria-labelledby="educators-title">
          <h2 id="educators-title" tabIndex={-1}>For educators and schools</h2>
          <ul>
            <li>Use a challenge as a live demonstration in lecture, or set it as a design exercise. <ReadinessTag readiness="Available now" /></li>
            <li>Start a class in Guided mode, then assign Parametric mode for open-ended design. <ReadinessTag readiness="Available now" /></li>
            <li>Class assignments and a view of student submissions and progress. <ReadinessTag readiness="Planned" /></li>
            <li>Learning paths that line up with existing course sequences. <ReadinessTag readiness="Planned" /></li>
          </ul>
        </article>
      </section>

      <section className="home-section" aria-labelledby="vision-title">
        <h2 id="vision-title" tabIndex={-1}>Where Statica is going</h2>
        <p className="home-section-lede">
          The long-term goal is a structured engineering counterpart to platforms like Khan Academy and Brilliant, with a
          stronger emphasis on physical simulation and design. Structural mechanics comes first; more disciplines follow,
          organized into subjects, topics and modules.
        </p>
        <ul className="home-pillars">
          {PILLARS.map((p) => (
            <li key={p.title} className="panel">
              <div className="home-section-heading">
                <h3>{p.title}</h3>
                <ReadinessTag readiness={p.readiness} />
              </div>
              <p>{p.text}</p>
            </li>
          ))}
        </ul>
        <h3 className="home-subheading" id="disciplines-title">Disciplines</h3>
        <ul className="home-disciplines" aria-labelledby="disciplines-title">
          {DISCIPLINES.map((d) => (
            <li key={d.name}>
              <div>
                <strong>{d.name}</strong>
                <span>{d.example}</span>
              </div>
              <ReadinessTag readiness={d.readiness} />
            </li>
          ))}
        </ul>
        <p className="home-section-lede">
          Two levels of design freedom carry across disciplines: guided parameter changes that build intuition today, and,
          later, more independent geometry creation for advanced students.
        </p>
      </section>

      <section className="home-cta panel" aria-labelledby="cta-title">
        <h2 id="cta-title">Try a challenge</h2>
        <p>Pick a challenge, make a prediction and run your first test. Cantilever Beam I takes 15–20 minutes.</p>
        <button type="button" className="primary" onClick={onBrowse}>
          Choose a challenge
          <Icon name="arrow" size={15} />
        </button>
      </section>
      </main>
      <footer className="landing-footer">
        <div>
          <strong>statica.</strong>
          <span>Interactive engineering education. Built to complement engineering courses.</span>
        </div>
        <nav aria-label="Footer">
          <button type="button" onClick={onBrowse}>Challenges</button>
          <button type="button" onClick={onMyDesigns}>My designs</button>
          {user && <button type="button" onClick={() => onAccount()}>Account</button>}
        </nav>
      </footer>
    </div>
  )
}
