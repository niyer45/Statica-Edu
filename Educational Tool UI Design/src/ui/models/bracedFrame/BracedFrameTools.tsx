import { useEffect, useRef } from 'react'
import { DIAGONAL_IDS, FRAME_MEMBER_IDS, isDiagonalId, STOREY_DIAGONALS, type FrameJointId, type FrameMemberId } from '../../../geometry/bracedFrame/template'
import Icon from '../../icons/Icon'
import LockNote from '../../workbench/LockNote'
import { useGuided } from '../../workbench/useGuided'
import { diagonalToggleName, formatKn, memberName, useFrameStore } from './shared'

// Braced frame design tools (task 49.3; BFR-04, BFR-16, MM-22, MODE-04). Four diagonal toggles
// (buttons with aria-pressed and a visible Present / Not present state, never color alone) and
// one section select per member. Every edit is dispatched to the frame reducer
// (toggleDiagonal / setMemberSection); a rejected edit keeps the draft and its reason is
// announced once. Fixed values (geometry, supports, loads, material) stay read-only in a
// collapsed disclosure. An absent diagonal keeps its section choice for when it is re-enabled.
// Task 58: in Guided, controls the current step does not unlock are read-only or disabled
// with a visible reason; Parametric leaves every control editable.

const JOINT_NAMES: Readonly<Record<FrameJointId, string>> = {
  j1: 'left base',
  j2: 'right base',
  j3: 'first floor, left',
  j4: 'first floor, right',
  j5: 'roof, left',
  j6: 'roof, right',
}

/** "20.0 kN to the right" / "40.0 kN down" parts of one joint load, from the config. */
function loadText(fxN: number, fyN: number): string {
  const parts: string[] = []
  if (fxN !== 0) parts.push(`${formatKn(fxN)} ${fxN > 0 ? 'to the right' : 'to the left'}`)
  if (fyN !== 0) parts.push(`${formatKn(fyN)} ${fyN < 0 ? 'down' : 'up'}`)
  return parts.join(' and ')
}

export default function BracedFrameTools({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const { state, challenge: ch, dispatch } = useFrameStore()
  const members = state.draft.members
  const guided = useGuided()
  const bracingLocked = DIAGONAL_IDS.every((id) => guided.locked(`${id}.present`))
  const sectionsLocked = FRAME_MEMBER_IDS.every((id) => guided.locked(`${id}.section`))
  const pending = useRef(false)
  useEffect(() => {
    if (!pending.current) return
    pending.current = false
    if (state.draftErrors.length > 0) onAnnounce(state.draftErrors[0]!.message)
  }, [state.draftErrors, onAnnounce])

  const toggle = (memberId: string) => {
    if (guided.locked(`${memberId}.present`)) return
    pending.current = true
    dispatch({ type: 'edit', edit: { type: 'toggleDiagonal', memberId } })
  }
  const setSection = (memberId: FrameMemberId, sectionId: string) => {
    if (guided.locked(`${memberId}.section`)) return
    pending.current = true
    dispatch({ type: 'edit', edit: { type: 'setMemberSection', memberId, sectionId } })
  }

  return (
    <div className="frame-tools">
      <div className="section-heading">
        BRACING <span>01</span>
      </div>
      <div className="frame-toggles" role="group" aria-label="Diagonal bracing" aria-describedby={bracingLocked ? 'frame-bracing-locked' : undefined}>
        {([2, 1] as const).map((storey) => (
          <div className="frame-storey" key={storey}>
            <p className="frame-storey-title">
              Storey {storey} ({storey === 1 ? 'lower' : 'upper'})
            </p>
            {STOREY_DIAGONALS[storey].map((id) => {
              const present = members[id].present
              return (
                <button key={id} type="button" className={`frame-toggle ${present ? 'on' : ''}`} aria-pressed={present} disabled={guided.locked(`${id}.present`)} onClick={() => toggle(id)}>
                  <span>{diagonalToggleName(id)}</span>
                  <small aria-hidden="true">{present ? '✓ Present' : 'Not present'}</small>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {bracingLocked && <LockNote id="frame-bracing-locked" reason={guided.lockReason} />}
      <div className="section-heading dimensions-heading">
        MEMBER SECTIONS <span>02</span>
      </div>
      {sectionsLocked && <LockNote id="frame-sections-locked" reason={guided.lockReason} />}
      <div className="frame-sections">
        {FRAME_MEMBER_IDS.map((id) => {
          const selectId = `frame-section-${id}`
          const absent = isDiagonalId(id) && !members[id].present
          return (
            <div className="frame-section-field" key={id}>
              <label htmlFor={selectId}>
                {memberName(id)}
                {absent && <small> (not present; choice kept)</small>}
              </label>
              <select
                id={selectId}
                value={members[id].sectionId}
                disabled={guided.locked(`${id}.section`)}
                aria-describedby={guided.locked(`${id}.section`) ? 'frame-sections-locked' : undefined}
                onChange={(e) => setSection(id, e.target.value)}
              >
                {ch.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
      <details className="locked-features">
        <summary>
          <Icon name="lock" size={14} /> Some things are fixed.
        </summary>
        <dl>
          <dt>Frame</dt>
          <dd>
            One bay {ch.frame.bayWidthM.toFixed(1)} m wide, two storeys {ch.frame.storeyHeightM.toFixed(1)} m high
          </dd>
          <dt>Joints</dt>
          <dd>Pin joints: every joint is a hinge</dd>
          <dt>Supports</dt>
          <dd>Pinned at both base joints, resisting sideways load and uplift</dd>
          <dt>Loads</dt>
          <dd>
            <ul className="frame-load-list" aria-label="Fixed loads">
              {ch.loads.map((l) => (
                <li key={l.jointId}>
                  {loadText(l.fxN, l.fyN)} at the {JOINT_NAMES[l.jointId]} joint
                </li>
              ))}
            </ul>
          </dd>
          <dt>Material</dt>
          <dd>{ch.material.name}</dd>
          <dt>Members</dt>
          <dd>Columns and beams are always present</dd>
        </dl>
      </details>
    </div>
  )
}
