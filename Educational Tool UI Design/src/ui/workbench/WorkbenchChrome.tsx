import type { ReactNode } from 'react'
import type { Difficulty, InteractionMode } from '../../challenge/types'
import Icon from '../icons/Icon'
import { useChallenge, useSession } from '../state/store'

// Template Workbench chrome (task 13.3): `aside.sidebar`, `header.topbar`, `.page-heading`,
// and `.workspace-context`, with the template class names so index.css / platform*.css apply.
// The Workbench's regions are passed as children and rendered inside `<main>`.
// Inside the platform shell (`.embedded-workspace`) the platform sidebar replaces this one.

export const MODE_LABELS: Record<InteractionMode, string> = {
  guided: 'Guided',
  parametric: 'Parametric',
  freeform: 'Freeform',
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  introductory: 'Introductory',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export interface WorkbenchChromeProps {
  onExit: () => void
  onOpenHelp: () => void
  onShowDesigns: () => void
  children: ReactNode
}

export default function WorkbenchChrome({ onExit, onOpenHelp, onShowDesigns, children }: WorkbenchChromeProps) {
  const ch = useChallenge()
  const mode = MODE_LABELS[useSession().mode]
  const difficulty = DIFFICULTY_LABELS[ch.difficulty]
  return (
    <div className="app-shell embedded-workspace">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Statica home" onClick={(e) => { e.preventDefault(); onExit() }}>
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          statica<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          <button type="button" className="nav-item active" onClick={onExit}>
            <Icon name="grid" />
            Challenges<span className="nav-count">01</span>
          </button>
          <button type="button" className="nav-item" onClick={onShowDesigns}>
            <Icon name="cube" />
            My designs
          </button>
          <button type="button" className="nav-item" onClick={onOpenHelp}>
            <Icon name="book" />
            Learning notes
            <Icon name="arrow" size={14} />
          </button>
        </nav>
        <div className="sidebar-divider" />
        <div className="workspace-label">CURRENT CHALLENGE</div>
        <div className="current-challenge">
          <span className="tiny-dot" />
          {ch.title}
          <span className="subtle">Mechanics · {difficulty}</span>
        </div>
        <div className="sidebar-bottom">
          <div className="practice-note">
            <span className="small-caps">BUILT THROUGH PRACTICE</span>
            <p>
              Good engineers aren't born.
              <br />
              They're made, one iteration
              <br />
              at a time.
            </p>
            <div className="mini-beam">
              <span />
              <span />
              <span />
            </div>
          </div>
          <button type="button" className="nav-item" onClick={onOpenHelp}>
            <Icon name="help" />
            Help & resources
            <Icon name="arrow" size={14} />
          </button>
          <div className="profile">
            <div className="avatar">Y</div>
            <div>
              Your workspace<span>Personal workspace</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button type="button" onClick={onExit}>
              Challenge library
            </button>
            <span>/</span>
            <span>Mechanics</span>
            <span>/</span>
            <strong>{ch.title}</strong>
          </div>
          <div className="session">
            <span className="tiny-dot" />
            {mode} workspace <span className="no-account">· Local session</span>
            <button type="button" className="icon-button" aria-label="Help" onClick={onOpenHelp}>
              <Icon name="help" size={17} />
            </button>
          </div>
        </header>
        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span>CHALLENGE 001</span>
                <span className="tag">{difficulty}</span>
                <span className="time">
                  <Icon name="clock" size={12} />
                  15–20 min
                </span>
              </div>
              <h1>{ch.title}</h1>
              <p>Reduce deflection within mass and stress limits.</p>
            </div>
            <button type="button" className="secondary exit" onClick={onExit}>
              <Icon name="back" size={15} />
              All challenges
            </button>
          </section>
          <div className="workspace-context">
            <span>
              <Icon name="cube" size={15} />
              {mode} design
            </span>
            <span>
              {mode === 'Guided'
                ? 'Shape presets, dimension controls, and step-by-step prompts.'
                : 'Precise parameter editing with the same validated beam model.'}
            </span>
            <span className="solver-label">Euler–Bernoulli · Beam solver</span>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
