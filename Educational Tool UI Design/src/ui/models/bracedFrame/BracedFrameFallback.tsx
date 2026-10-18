import { useEffect, useRef } from 'react'
import { FRAME_MEMBER_IDS, FRAME_MEMBERS, frameJointCoordinates, isDiagonalId, type FrameJointId, type FrameMemberId } from '../../../geometry/bracedFrame/template'
import type { BracedFrameMemberResult } from '../../../physics/bracedFrame/types'
import type { ViewportProps } from '../../viewport/FallbackViewport'
import { formatKn, FRAME_FALLBACK_NOTICE, FRAME_SUMMARY_ID, memberName, SENSE_KEYS, useFrameStore } from './shared'

// Braced frame 2D elevation (task 49.3; BFR-16, MM-20, MM-22, OC-12), the non-WebGL fallback of
// the 3D frame view (task 54.3). Main bundle, no Three.js dependency, so it also recovers from a
// failed 3D chunk, WebGL context creation failure or context loss through `ViewportBoundary`.
// It draws the DRAFT topology (joints, pinned supports, configured loads, present members with
// stroke width by section, absent candidate diagonals faint and dashed) and the LATEST TESTED
// member forces, matching the other models' latest-tested display rule. Tension, compression
// and ≈ 0 are distinguished by line pattern (solid, double, dotted) plus a T / C / 0 text label,
// never by color alone; the member force table (BracedFrameView) is the text equivalent. A
// mechanism draws no forces.

const PX_PER_M = 36
const X0 = 70
const Y0 = 260

/** SVG elevation and its line pattern key. */
function BracedFrameElevation() {
  const { state, challenge: ch } = useFrameStore()
  const latest = state.history[state.history.length - 1]!
  const tested = latest.analysis
  const draft = state.draft.members
  const joints = frameJointCoordinates(ch.frame)
  const p = (j: FrameJointId) => ({ x: X0 + joints[j].x * PX_PER_M, y: Y0 - joints[j].y * PX_PER_M })
  const sectionIndex = (id: FrameMemberId) => Math.max(0, ch.sections.findIndex((s) => s.id === draft[id].sectionId))
  const result = (id: FrameMemberId): Readonly<BracedFrameMemberResult> | undefined => (tested.status === 'solved' ? tested.members[id] : undefined)
  const present = (id: FrameMemberId) => !isDiagonalId(id) || draft[id].present
  const absent = FRAME_MEMBER_IDS.filter((id) => !present(id))

  return (
    <>
      <svg
        viewBox="0 0 290 285"
        role="img"
        aria-label={`Two-storey braced frame elevation${absent.length > 0 ? `; diagonals not present: ${absent.map((id) => memberName(id).toLowerCase()).join(', ')}` : ''}`}
        aria-describedby={FRAME_SUMMARY_ID}
        className="beam-scene frame-scene"
      >
        {/* Pinned supports. */}
        {(['j1', 'j2'] as const).map((j) => {
          const { x, y } = p(j)
          return (
            <g key={j} className="frame-support">
              <polygon points={`${x},${y} ${x - 8},${y + 12} ${x + 8},${y + 12}`} />
              <line x1={x - 13} y1={y + 14} x2={x + 13} y2={y + 14} />
            </g>
          )
        })}
        {/* Members: absent diagonals first so present members draw on top. */}
        {[...FRAME_MEMBER_IDS].sort((a, b) => Number(present(a)) - Number(present(b))).map((id) => {
          const t = FRAME_MEMBERS[id]
          const a = p(t.i)
          const b = p(t.j)
          if (!present(id)) return <line key={id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="frame-member-absent" />
          const r = result(id)
          const w = 1.5 + sectionIndex(id)
          if (r === undefined) return <line key={id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="frame-member-neutral" strokeWidth={w} />
          if (r.sense === 'compression') {
            return (
              <g key={id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="frame-member-compression" strokeWidth={w + 3} />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="frame-member-compression-core" strokeWidth={Math.max(1, w + 3 - 2.6)} />
              </g>
            )
          }
          return <line key={id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={r.sense === 'tension' ? 'frame-member-tension' : 'frame-member-zero'} strokeWidth={w} />
        })}
        {/* Force labels (T / C / 0 with kN), latest tested result only. */}
        {FRAME_MEMBER_IDS.filter(present).map((id) => {
          const r = result(id)
          if (r === undefined) return null
          const t = FRAME_MEMBERS[id]
          const a = p(t.i)
          const b = p(t.j)
          const text = r.sense === 'zero' ? '0' : `${SENSE_KEYS[r.sense]} ${formatKn(r.forceN).replace(' kN', '')}`
          if (t.kind === 'column') {
            const left = a.x < X0 + 1
            return (
              <text key={id} x={a.x + (left ? -6 : 6)} y={(a.y + b.y) / 2 + 3} textAnchor={left ? 'end' : 'start'} className="frame-label">
                {text}
              </text>
            )
          }
          if (t.kind === 'beam') {
            return (
              <text key={id} x={(a.x + b.x) / 2} y={a.y - 5} textAnchor="middle" className="frame-label">
                {text}
              </text>
            )
          }
          return (
            <text key={id} x={a.x + (b.x - a.x) * 0.28} y={a.y + (b.y - a.y) * 0.28 + 3} textAnchor="middle" className="frame-label">
              {text}
            </text>
          )
        })}
        {/* Configured loads. */}
        {ch.loads.map((l) => {
          const { x, y } = p(l.jointId)
          return (
            <g key={l.jointId} className="frame-load">
              {l.fxN !== 0 && (
                <>
                  <line x1={l.fxN > 0 ? x - 44 : x + 44} y1={y} x2={l.fxN > 0 ? x - 6 : x + 6} y2={y} />
                  <polygon points={l.fxN > 0 ? `${x - 4},${y} ${x - 10},${y - 4} ${x - 10},${y + 4}` : `${x + 4},${y} ${x + 10},${y - 4} ${x + 10},${y + 4}`} />
                  <text x={l.fxN > 0 ? x - 26 : x + 26} y={y - 5} textAnchor="middle" className="frame-load-label">
                    {formatKn(l.fxN).replace('.0 kN', ' kN')}
                  </text>
                </>
              )}
              {l.fyN !== 0 && (
                <>
                  <line x1={x} y1={l.fyN < 0 ? y - 32 : y + 32} x2={x} y2={l.fyN < 0 ? y - 6 : y + 6} />
                  <polygon points={l.fyN < 0 ? `${x},${y - 4} ${x - 4},${y - 10} ${x + 4},${y - 10}` : `${x},${y + 4} ${x - 4},${y + 10} ${x + 4},${y + 10}`} />
                  <text x={x + 5} y={l.fyN < 0 ? y - 25 : y + 30} className="frame-load-label">
                    {formatKn(l.fyN).replace('.0 kN', ' kN')}
                  </text>
                </>
              )}
            </g>
          )
        })}
        {/* Hinged joints. */}
        {(Object.keys(joints) as FrameJointId[]).map((j) => {
          const { x, y } = p(j)
          return <circle key={j} cx={x} cy={y} r={3} className="frame-joint" />
        })}
      </svg>
      <details className="frame-key">
        <summary>Drawing key</summary>
        <ul className="frame-legend" aria-label="Line pattern key">
          <li>
            <svg viewBox="0 0 24 8" aria-hidden="true">
              <line x1={1} y1={4} x2={23} y2={4} className="frame-member-tension" strokeWidth={2} />
            </svg>
            Solid: tension (T)
          </li>
          <li>
            <svg viewBox="0 0 24 8" aria-hidden="true">
              <line x1={1} y1={4} x2={23} y2={4} className="frame-member-compression" strokeWidth={5} />
              <line x1={1} y1={4} x2={23} y2={4} className="frame-member-compression-core" strokeWidth={2.4} />
            </svg>
            Double: compression (C)
          </li>
          <li>
            <svg viewBox="0 0 24 8" aria-hidden="true">
              <line x1={1} y1={4} x2={23} y2={4} className="frame-member-zero" strokeWidth={2} />
            </svg>
            Dotted: ≈ 0
          </li>
          <li>
            <svg viewBox="0 0 24 8" aria-hidden="true">
              <line x1={1} y1={4} x2={23} y2={4} className="frame-member-absent" />
            </svg>
            Faint dashed: not present
          </li>
        </ul>
      </details>
    </>
  )
}

/** The complete fallback: a notice (announced once, like the beam's) and the SVG elevation. */
export default function BracedFrameFallback({ onUnavailable }: ViewportProps) {
  const announced = useRef(false)
  useEffect(() => {
    if (announced.current) return
    announced.current = true
    onUnavailable?.(FRAME_FALLBACK_NOTICE)
  }, [onUnavailable])
  return (
    <>
      <p className="frame-fallback-notice">{FRAME_FALLBACK_NOTICE}</p>
      <BracedFrameElevation />
    </>
  )
}
