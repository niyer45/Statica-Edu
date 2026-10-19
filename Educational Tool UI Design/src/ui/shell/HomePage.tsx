import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { DIFFICULTY_LABELS, type CatalogEntry } from '../../challenge/catalog'
import type { AccountContextValue } from '../account/AccountContext'
import { storageStatement } from './progress'
import type { AccountView } from './routes'
import SiteIcon, { StaticaMark, type SiteIconName } from './SiteIcon'
import TechnicalArt from './TechnicalArt'
import './home.css'

// Landing page (tasks 38, 62, 63, 64): a standalone front page, outside the workspace chrome, for
// students, educators and investors. Task 64 restyles it from the owner's Figma homepage export
// (design/figma-homepage/ at the repository root): technical-art hero, challenge cards, audience
// tabs, a dark call to action and footer. Every capability is labelled Available now, Early or
// Planned so nothing planned reads as shipped. Per-challenge progress lives in My designs.

export type Readiness = 'Available now' | 'Early' | 'Planned'

export const LEARNING_LOOP: readonly { step: string; icon: SiteIconName; text: string }[] = [
  { step: 'Learn', icon: 'book', text: 'Each challenge opens with a plain-language brief and a reference sheet with the governing equations.' },
  { step: 'Experiment', icon: 'cube', text: 'Change the geometry and watch the model respond in 3D, or in 2D when 3D is unavailable.' },
  { step: 'Predict', icon: 'bulb', text: 'Before key tests, commit to a prediction, then see how it compared with the result.' },
  { step: 'Design', icon: 'sliders', text: 'Iterate toward a design that meets real limits on stress, deflection, mass and more.' },
  { step: 'Evaluate', icon: 'chart', text: 'Every test is checked against the requirements and explained; submit a design with a written reflection.' },
]

export const AVAILABLE_FEATURES: readonly string[] = [
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

type Audience = 'Students' | 'Educators' | 'Investors'

interface AudienceContent {
  icon: SiteIconName
  intro: string
  description: string
  items: readonly { title: string; text: string; readiness?: Readiness }[]
  action: string
  /** Where the action goes: the challenge library, or the roadmap section on this page. */
  target: 'challenges' | 'roadmap'
}

export const AUDIENCES: Readonly<Record<Audience, AudienceContent>> = {
  Students: {
    icon: 'book',
    intro: 'Connect equations to physical behavior.',
    description: 'Reinforce what you learn in class by changing a design and seeing how stiffness, stress and mass respond.',
    items: [
      { title: 'Undergraduates', text: 'Apply mechanics and materials concepts to testable design requirements.' },
      { title: 'High school students', text: 'Explore foundational principles through visual, accessible challenges.' },
      { title: 'Independent learners', text: 'Work at your own pace, with Guided steps when you want structure.' },
    ],
    action: 'Explore challenges',
    target: 'challenges',
  },
  Educators: {
    icon: 'users',
    intro: 'Bring a design problem into the classroom.',
    description: 'Use a challenge as a live demonstration or a design exercise alongside your existing course, not as a replacement for it.',
    items: [
      { title: 'Demonstrate a concept', text: 'Compare cross-sections in Cantilever Beam I to explain bending in lecture.', readiness: 'Available now' },
      { title: 'Structure an exercise', text: 'Start in Guided mode, then ask students to predict, test, compare and explain in Parametric mode.', readiness: 'Available now' },
      { title: 'Classroom tools', text: 'Class assignments, a view of student submissions and learning paths that line up with course sequences.', readiness: 'Planned' },
    ],
    action: 'Try a challenge',
    target: 'challenges',
  },
  Investors: {
    icon: 'chart',
    intro: 'A focused platform for engineering education.',
    description: 'Statica is developing a structured engineering learning platform centered on physical simulation and iterative design.',
    items: [
      { title: 'Today', text: 'Six working design challenges, each computed by its own engineering model, and the core learning workflow.', readiness: 'Available now' },
      { title: 'Next', text: 'Short concept lessons, more challenges and classroom workflows.', readiness: 'Planned' },
      { title: 'Long term', text: 'A connected curriculum across engineering disciplines, with increasingly independent design tools.', readiness: 'Planned' },
    ],
    action: 'View the roadmap',
    target: 'roadmap',
  },
}

const AUDIENCE_NAMES = Object.keys(AUDIENCES) as Audience[]

const SECTIONS: readonly [string, string][] = [
  ['How it works', 'loop-title'],
  ['Challenges', 'challenges-title'],
  ["Who it's for", 'audience-title'],
  ['Roadmap', 'roadmap-title'],
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

function Brand() {
  return (
    <>
      <StaticaMark />
      statica<span className="landing-brand-dot">.</span>
    </>
  )
}

/** Students / Educators / Investors tabs (WAI-ARIA tabs: arrow keys, Home and End move between them). */
function AudienceTabs({ onBrowse }: { onBrowse: () => void }) {
  const [active, setActive] = useState<Audience>('Students')
  const tabs = useRef<Partial<Record<Audience, HTMLButtonElement | null>>>({})
  const data = AUDIENCES[active]
  const select = (name: Audience) => {
    setActive(name)
    tabs.current[name]?.focus()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = AUDIENCE_NAMES.indexOf(active)
    const next =
      e.key === 'ArrowRight' ? (i + 1) % AUDIENCE_NAMES.length
      : e.key === 'ArrowLeft' ? (i + AUDIENCE_NAMES.length - 1) % AUDIENCE_NAMES.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? AUDIENCE_NAMES.length - 1
      : null
    if (next === null) return
    e.preventDefault()
    select(AUDIENCE_NAMES[next]!)
  }
  return (
    <div className="audience">
      <div role="tablist" aria-label="Who Statica is for" className="audience-tabs" onKeyDown={onKeyDown}>
        {AUDIENCE_NAMES.map((name) => (
          <button
            key={name}
            ref={(el) => {
              tabs.current[name] = el
            }}
            type="button"
            role="tab"
            id={`audience-${name}`}
            aria-selected={active === name}
            aria-controls="audience-panel"
            tabIndex={active === name ? 0 : -1}
            onClick={() => setActive(name)}
          >
            <SiteIcon name={AUDIENCES[name].icon} />
            {name}
          </button>
        ))}
      </div>
      <div id="audience-panel" role="tabpanel" aria-labelledby={`audience-${active}`} className="audience-panel">
        <div>
          <h3>{data.intro}</h3>
          <p>{data.description}</p>
          <button
            type="button"
            className="landing-text-action"
            onClick={() => (data.target === 'roadmap' ? jumpTo('roadmap-title') : onBrowse())}
          >
            {data.action}
            <SiteIcon />
          </button>
        </div>
        <ul>
          {data.items.map((item) => (
            <li key={item.title}>
              <span className="landing-check" aria-hidden="true">
                <SiteIcon name="check" size={12} />
              </span>
              <div>
                <h4>
                  {item.title}
                  {item.readiness && <ReadinessTag readiness={item.readiness} />}
                </h4>
                <p>{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
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
  const featured = available[0]
  const disciplineCount = new Set(available.map((e) => e.discipline)).size
  return (
    <div className="landing">
      <header className="landing-header">
        <button type="button" className="landing-brand" onClick={() => window.scrollTo?.({ top: 0, behavior: 'smooth' })} aria-label="Statica, top of page">
          <Brand />
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
          {account && !user && (
            <button type="button" className="landing-link" onClick={() => onAccount('sign-in')}>
              Sign in
            </button>
          )}
          <button type="button" className="landing-button" onClick={onBrowse}>
            Open Statica
            <SiteIcon size={14} />
          </button>
        </div>
      </header>

      <main className="home">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <span className="landing-eyebrow">
              <span className="tiny-dot" />
              Engineering intuition
            </span>
            <h1 id="home-title" ref={heading} tabIndex={-1} aria-describedby={notice !== null ? 'home-notice' : undefined}>
              {user ? `Welcome back, ${user.displayName}` : 'Learn engineering by designing, testing and explaining.'}
            </h1>
            {user && <p className="home-tagline">Learn engineering by designing, testing and explaining.</p>}
            <p className="home-lede">
              Statica is an interactive engineering education platform. Students connect equations to physical behavior:
              they experiment with a model, predict how it will respond, design a solution to a real requirement and
              evaluate the result. It complements engineering courses rather than replacing them.
            </p>
            {notice !== null && (
              <p id="home-notice" className="home-notice" role="status">
                <SiteIcon name="check" size={15} />
                {notice}
              </p>
            )}
            <div className="home-actions">
              {account && !user ? (
                <>
                  <button type="button" className="landing-button" onClick={() => onAccount('sign-up')}>
                    Create account
                    <SiteIcon />
                  </button>
                  <button type="button" className="landing-button-secondary" onClick={onBrowse}>
                    Continue as guest
                    <SiteIcon />
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="landing-button" onClick={onBrowse}>
                    Browse challenges
                    <SiteIcon />
                  </button>
                  {account && (
                    <button type="button" className="landing-button-secondary" onClick={() => onAccount()}>
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
              <SiteIcon name="lock" size={15} />
              <span>{storageStatement(account)}</span>
            </p>
          </div>
          {featured && (
            <figure className="home-hero-figure">
              <TechnicalArt kind={featured.art} large />
              <figcaption>
                <span>
                  <strong>{featured.title}</strong>
                  {DIFFICULTY_LABELS[featured.difficulty]} · {featured.time}
                </span>
                <ReadinessTag readiness="Available now" />
              </figcaption>
            </figure>
          )}
          <dl className="home-facts">
            <div>
              <dt>Design challenges</dt>
              <dd>{available.length}</dd>
            </div>
            <div>
              <dt>Disciplines</dt>
              <dd>{disciplineCount}</dd>
            </div>
            <div>
              <dt>To install</dt>
              <dd>Nothing</dd>
            </div>
          </dl>
        </section>

        <section className="home-section" aria-labelledby="loop-title">
          <div className="home-section-intro">
            <span className="landing-eyebrow">How it works</span>
            <h2 id="loop-title" tabIndex={-1}>How students learn with Statica</h2>
            <p>The goal is engineering intuition, not learning to operate simulation software.</p>
          </div>
          <ol className="home-loop">
            {LEARNING_LOOP.map((s, i) => (
              <li key={s.step}>
                <span className="home-loop-icon" aria-hidden="true">
                  <SiteIcon name={s.icon} size={18} />
                </span>
                <span className="home-loop-number" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3>{s.step}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-section" aria-labelledby="challenges-title">
          <div className="home-section-intro home-section-intro-row">
            <div>
              <span className="landing-eyebrow">The challenge library</span>
              <h2 id="challenges-title" tabIndex={-1}>Design challenges</h2>
              <p>Each challenge sets an objective and real limits; every result is computed by an engineering model.</p>
            </div>
            <button type="button" className="landing-button-secondary" onClick={onBrowse}>
              Open the challenge library
              <SiteIcon />
            </button>
          </div>
          <ul className="home-challenges" aria-label="Challenges available now">
            {available.map((e) => (
              <li key={e.id}>
                <div className="home-challenge-art">
                  <TechnicalArt kind={e.art} />
                </div>
                <div className="home-challenge-body">
                  <p className="home-challenge-meta">
                    <span>{e.discipline}</span>
                    <ReadinessTag readiness="Available now" />
                  </p>
                  <h3>{e.title}</h3>
                  <p>{e.description}</p>
                  <p className="home-concepts">
                    {e.concepts.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </p>
                  <p className="home-challenge-foot">
                    <span>{DIFFICULTY_LABELS[e.difficulty]}</span>
                    <span>
                      <SiteIcon name="clock" size={13} />
                      {e.time}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="home-included">
            <h3>Included in every challenge</h3>
            <ul className="home-features">
              {AVAILABLE_FEATURES.map((f) => (
                <li key={f}>
                  <span className="landing-check" aria-hidden="true">
                    <SiteIcon name="check" size={12} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="home-section" aria-labelledby="audience-title">
          <div className="home-section-intro">
            <span className="landing-eyebrow">Who it's for</span>
            <h2 id="audience-title" tabIndex={-1}>Built for students and the people who teach them</h2>
          </div>
          <AudienceTabs onBrowse={onBrowse} />
        </section>

        <section className="home-section" aria-labelledby="roadmap-title">
          <div className="home-section-intro">
            <span className="landing-eyebrow">Roadmap</span>
            <h2 id="roadmap-title" tabIndex={-1}>Where Statica is going</h2>
            <p>
              The long-term goal is a structured engineering counterpart to platforms like Khan Academy and Brilliant, with
              a stronger emphasis on physical simulation and design. Structural mechanics comes first; more disciplines
              follow, organized into subjects, topics and modules.
            </p>
          </div>
          <ul className="home-pillars">
            {PILLARS.map((p) => (
              <li key={p.title}>
                <ReadinessTag readiness={p.readiness} />
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </li>
            ))}
          </ul>
          <div className="home-disciplines-panel">
            <h3 id="disciplines-title">Disciplines</h3>
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
            <p>
              Two levels of design freedom carry across disciplines: guided parameter changes that build intuition today,
              and, later, more independent geometry creation for advanced students.
            </p>
          </div>
        </section>

        <section className="home-cta" aria-labelledby="cta-title">
          <div>
            <h2 id="cta-title">Try a challenge</h2>
            <p>
              Pick a challenge, make a prediction and run your first test.
              {featured && ` ${featured.title} takes ${featured.time.replace('min', 'minutes')}.`} No account needed.
            </p>
          </div>
          <button type="button" className="landing-button-light" onClick={onBrowse}>
            Choose a challenge
            <SiteIcon />
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        <div>
          <span className="landing-footer-brand">
            <Brand />
          </span>
          <p>Interactive engineering education. Built to complement engineering courses.</p>
        </div>
        <nav aria-label="Footer">
          <button type="button" onClick={onBrowse}>Challenges</button>
          <button type="button" onClick={onMyDesigns}>My designs</button>
          {account && !user && <button type="button" onClick={() => onAccount('sign-up')}>Create an account</button>}
          {user && <button type="button" onClick={() => onAccount()}>Account</button>}
        </nav>
      </footer>
    </div>
  )
}
