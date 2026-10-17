import Icon from '../icons/Icon'
import { MODE_LABELS } from '../workbench/WorkbenchChrome'
import type { InteractionMode } from '../../challenge/types'
import TechnicalArt from './TechnicalArt'

// My designs shows a local workspace card; recorded results stay in the workbench.

/** A started workspace of another runnable challenge (task 34.1 step 2; MM-23). */
export interface OtherWorkspace {
  id: string
  title: string
  mode: InteractionMode
  onReturn: () => void
}

export interface MyDesignsPageProps {
  title: string
  mode: InteractionMode
  started: boolean
  onReturn: () => void
  onFindChallenge: () => void
  /** Each card is attributed to its own challenge; histories are never mixed. */
  others?: readonly OtherWorkspace[]
}

function WorkspaceCard({ title, mode, active, onReturn }: { title: string; mode: InteractionMode; active: boolean; onReturn: () => void }) {
  return (
    <article className="project-card panel" aria-label={`${title} workspace`}>
      <TechnicalArt kind="beam" />
      <div>
        <span className="eyebrow">{active ? 'ACTIVE WORKSPACE' : 'SAVED WORKSPACE'}</span>
        <h2>{title}</h2>
        <p>{MODE_LABELS[mode]} design · Mechanics · Local session</p>
        <button type="button" className="primary" onClick={onReturn} aria-label={active ? undefined : `Return to ${title}`}>
          Return to workbench
          <Icon name="arrow" size={15} />
        </button>
        <small>Session saved on this device.</small>
      </div>
    </article>
  )
}

export default function MyDesignsPage({ title, mode, started, onReturn, onFindChallenge, others = [] }: MyDesignsPageProps) {
  return (
    <>
      <section className="library-heading">
        <h1>My designs</h1>
      </section>
      {started || others.length > 0 ? (
        <>
          {started && <WorkspaceCard title={title} mode={mode} active onReturn={onReturn} />}
          {others.map((o) => (
            <WorkspaceCard key={o.id} title={o.title} mode={o.mode} active={false} onReturn={o.onReturn} />
          ))}
        </>
      ) : (
        <div className="library-empty panel">
          <Icon name="cube" size={35} />
          <h3>No designs yet</h3>
          <p>Open a challenge to start building your design collection.</p>
          <button type="button" className="primary" onClick={onFindChallenge}>
            Find a challenge
            <Icon name="arrow" size={15} />
          </button>
        </div>
      )}
    </>
  )
}
