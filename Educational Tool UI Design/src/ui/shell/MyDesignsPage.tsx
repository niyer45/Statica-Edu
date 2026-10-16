import Icon from '../icons/Icon'
import { MODE_LABELS } from '../workbench/WorkbenchChrome'
import type { InteractionMode } from '../../challenge/types'
import TechnicalArt from './TechnicalArt'

// My designs shows a local workspace card; recorded results stay in the workbench.

export interface MyDesignsPageProps {
  title: string
  mode: InteractionMode
  started: boolean
  onReturn: () => void
  onFindChallenge: () => void
}

export default function MyDesignsPage({ title, mode, started, onReturn, onFindChallenge }: MyDesignsPageProps) {
  return (
    <>
      <section className="library-heading">
        <h1>My designs</h1>
      </section>
      {started ? (
        <article className="project-card panel">
          <TechnicalArt kind="beam" />
          <div>
            <span className="eyebrow">ACTIVE WORKSPACE</span>
            <h2>{title}</h2>
            <p>{MODE_LABELS[mode]} design · Mechanics · Local session</p>
            <button type="button" className="primary" onClick={onReturn}>
              Return to workbench
              <Icon name="arrow" size={15} />
            </button>
            <small>Session saved on this device.</small>
          </div>
        </article>
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
