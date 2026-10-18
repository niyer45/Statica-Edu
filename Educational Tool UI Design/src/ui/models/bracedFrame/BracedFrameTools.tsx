import { useEffect, useRef } from 'react'
import { FRAME_MEMBER_IDS, isDiagonalId, STOREY_DIAGONALS, type DiagonalId, type FrameJointId, type FrameMemberId } from '../../../geometry/bracedFrame/template'
import Icon from '../../icons/Icon'
import { diagonalToggleName, formatKn, memberName, useFrameStore } from './shared'

// Braced frame design tools (task 49.3, decluttered in task 56; BFR-04, BFR-16, MM-22, MODE-04).
// Four diagonal toggles (buttons named by storey and direction, with aria-pressed, a diagonal
// glyph and a visible On / Off state, never color alone) and one section select per member,
// grouped as columns, beams and diagonals with short visible names. Every edit is dispatched to the frame reducer
// (toggleDiagonal / setMemberSection); a rejected edit keeps the draft and its reason is
// announced once. Fixed values (geometry, supports, loads, material) stay read-only in a
// collapsed disclosure. An absent diagonal keeps its section choice for when it is re-enabled.

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

/** Visible short names; each select's accessible name is the full member name (aria-label). */
const SHORT_NAMES: Readonly<Record<FrameMemberId, string>> = {
  col1L: 'Lower left',
  col1R: 'Lower right',
  col2L: 'Upper left',
  col2R: 'Upper right',
  beam1: 'Floor',
  beam2: 'Roof',
  diag1a: 'Lower',
  diag1b: 'Lower',
  diag2a: 'Upper',
  diag2b: 'Upper',
}

const MEMBER_GROUPS: readonly { title: string; ids: readonly FrameMemberId[] }[] = [
  { title: 'Columns', ids: FRAME_MEMBER_IDS.filter((id) => id.startsWith('col')) },
  { title: 'Beams', ids: FRAME_MEMBER_IDS.filter((id) => id.startsWith('beam')) },
  { title: 'Diagonals', ids: FRAME_MEMBER_IDS.filter(isDiagonalId) },
]

/** Decorative bay with its diagonal (solid when present, dashed when not); the text says which. */
function DiagonalGlyph({ id, present }: { id: DiagonalId; present: boolean }) {
  const rising = id.endsWith('a')
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="frame-diagonal-glyph">
      <rect x={1.5} y={1.5} width={13} height={13} />
      <line x1={rising ? 1.5 : 14.5} y1={14.5} x2={rising ? 14.5 : 1.5} y2={1.5} className={present ? 'present' : 'absent'} />
    </svg>
  )
}

export default function BracedFrameTools({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const { state, challenge: ch, dispatch } = useFrameStore()
  const members = state.draft.members
  const pending = useRef(false)
  useEffect(() => {
    if (!pending.current) return
    pending.current = false
    if (state.draftErrors.length > 0) onAnnounce(state.draftErrors[0]!.message)
  }, [state.draftErrors, onAnnounce])

  const toggle = (memberId: string) => {
    pending.current = true
    dispatch({ type: 'edit', edit: { type: 'toggleDiagonal', memberId } })
  }
  const setSection = (memberId: FrameMemberId, sectionId: string) => {
    pending.current = true
    dispatch({ type: 'edit', edit: { type: 'setMemberSection', memberId, sectionId } })
  }

  return (
    <div className="frame-tools">
      <div className="section-heading">
        BRACING <span>01</span>
      </div>
      <div className="frame-toggles" role="group" aria-label="Diagonal bracing">
        {([2, 1] as const).map((storey) => (
          <div className="frame-storey" key={storey}>
            <p className="frame-storey-title">{storey === 1 ? 'Lower' : 'Upper'} storey</p>
            {STOREY_DIAGONALS[storey].map((id) => {
              const present = members[id].present
              return (
                <button
                  key={id}
                  type="button"
                  className={`frame-toggle ${present ? 'on' : ''}`}
                  aria-pressed={present}
                  aria-label={diagonalToggleName(id)}
                  title={diagonalToggleName(id)}
                  onClick={() => toggle(id)}
                >
                  <DiagonalGlyph id={id} present={present} />
                  <small aria-hidden="true">{present ? '✓ On' : 'Off'}</small>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="section-heading dimensions-heading">
        MEMBER SIZES <span>02</span>
      </div>
      {MEMBER_GROUPS.map((group) => (
        <fieldset className="frame-sections" key={group.title}>
          <legend>{group.title}</legend>
          {group.ids.map((id) => {
            const selectId = `frame-section-${id}`
            const absent = isDiagonalId(id) && !members[id].present
            return (
              <div className="frame-section-field" key={id}>
                <label htmlFor={selectId}>
                  {SHORT_NAMES[id]}
                  {isDiagonalId(id) && <DiagonalGlyph id={id} present={!absent} />}
                  {absent && <small>off</small>}
                </label>
                <select
                  id={selectId}
                  aria-label={`${memberName(id)}${absent ? ', not present (choice kept)' : ''}`}
                  value={members[id].sectionId}
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
        </fieldset>
      ))}
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
