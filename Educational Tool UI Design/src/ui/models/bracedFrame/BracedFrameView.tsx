import { lazy, Suspense } from 'react'
import { FRAME_MEMBER_IDS } from '../../../geometry/bracedFrame/template'
import type { ViewportProps } from '../../viewport/FallbackViewport'
import ViewportBoundary from '../../viewport/ViewportBoundary'
import ViewportLoading from '../../viewport/ViewportLoading'
import BracedFrameFallback from './BracedFrameFallback'
import './bracedFrame.css'
import { formatFrame, formatKn, forceText, FRAME_SUMMARY_ID, MECHANISM_TEXT, memberName, MODE_LABELS, unstableText, useFrameStore } from './shared'

// Braced frame view slot (task 49.3, 3D view task 54.3; BFR-16, MM-20, MM-22, OC-12). The
// drawing is the interactive 3D scene, a separate lazy chunk wrapped in the shared
// `ViewportBoundary` exactly like the beam: without WebGL2, on context loss, or when the chunk
// or Canvas fails, the main-bundle SVG elevation (`BracedFrameFallback`) is shown instead. The
// latest-test text summary (screen-reader description of the drawing; the challenge panel shows
// the same stored checks visibly) and the member force table and reactions (collapsed, task 56)
// below it are main-bundle text equivalents shown with either view. A mechanism shows
// "Unstable mechanism" in text and no force or drift number.

const BracedFrameViewport3D = lazy(() => import('./BracedFrameViewport3D'))

/** A stored reaction component in kN with its direction; no direction when it rounds to zero. */
function reactionText(n: number, negative: string, positive: string): string {
  const text = formatKn(n)
  return text === '0.0 kN' ? text : `${text} ${n < 0 ? negative : positive}`
}

/** Latest-test summary, member force table and reactions: the text equivalent of the drawing. */
function BracedFrameDetails() {
  const { state, challenge: ch } = useFrameStore()
  const latest = state.history[state.history.length - 1]!
  const tested = latest.analysis
  const label = latest.iteration === 0 ? 'Baseline' : `Iteration ${latest.iteration}`

  const summary =
    tested.status === 'mechanism'
      ? `${MECHANISM_TEXT}. ${unstableText(tested.unbracedStoreys)}. Member forces and drift are not defined for a mechanism.`
      : `Latest test (${label}): stable · roof drift ${formatFrame(Math.abs(tested.roofDriftM), 'm')} · governing member ${memberName(tested.governingMemberId).toLowerCase()} at ${formatFrame(tested.maxUtilization, 'ratio')} utilization.`

  return (
    <>
      {/* Text equivalent of the drawing for assistive technology (canvas/SVG aria-describedby);
          the challenge panel shows the same stored checks visibly. */}
      <p id={FRAME_SUMMARY_ID} className="sr-only" aria-live="off">
        {summary}
        {state.draftStatus === 'draft' && ' Forces shown are from the latest test; Run Test to update them for your current design.'}
      </p>
      {state.draftStatus === 'draft' && <p className="frame-draft-note">Forces shown are from the latest test. Run Test to update.</p>}
      {tested.status === 'mechanism' ? (
        <p className="frame-mechanism" role="note">
          {MECHANISM_TEXT}: no member forces, drift or reactions to show.
        </p>
      ) : (
        <details className="frame-more">
          <summary>Member forces and reactions</summary>
          <div className="frame-table-wrap">
            <table aria-label="Latest tested member forces">
              <caption>Member forces ({label}, tension positive)</caption>
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Force</th>
                  <th scope="col">Utilization</th>
                  <th scope="col">Capacity</th>
                  <th scope="col">Governing mode</th>
                </tr>
              </thead>
              <tbody>
                {FRAME_MEMBER_IDS.map((id) => {
                  const r = tested.members[id]
                  return (
                    <tr key={id}>
                      <th scope="row">{memberName(id)}</th>
                      {r === undefined ? (
                        <td colSpan={4}>Not present</td>
                      ) : (
                        <>
                          <td>{forceText(r)}</td>
                          <td>
                            {formatFrame(r.utilization, 'ratio')}
                            {r.utilization > ch.constraints.maxUtilization ? ' (over capacity)' : ''}
                          </td>
                          <td>{formatKn(r.capacityN)}</td>
                          <td>{MODE_LABELS[r.mode]}</td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="frame-reactions">
              Support reactions: left base {reactionText(tested.reactionsN.j1.x, 'left', 'right')}, {reactionText(tested.reactionsN.j1.y, 'down', 'up')}; right base{' '}
              {reactionText(tested.reactionsN.j2.x, 'left', 'right')}, {reactionText(tested.reactionsN.j2.y, 'down', 'up')}. First-floor drift{' '}
              {formatFrame(Math.abs(tested.floorDriftM), 'm')}.
            </p>
          </div>
        </details>
      )}
    </>
  )
}

export default function BracedFrameView({ onUnavailable }: ViewportProps) {
  return (
    <div className="frame-view">
      <ViewportBoundary onUnavailable={onUnavailable} fallback={BracedFrameFallback}>
        <Suspense fallback={<ViewportLoading />}>
          <BracedFrameViewport3D onUnavailable={onUnavailable} />
        </Suspense>
      </ViewportBoundary>
      <BracedFrameDetails />
    </div>
  )
}
