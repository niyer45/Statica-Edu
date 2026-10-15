import type { Challenge, LockedField } from '../challenge/types'
import { clampParam, paramsOf, trySetParam } from '../geometry/clamp'
import { convertSection } from '../geometry/convert'
import type { BeamDesign, GeometryError, Section } from '../geometry/sections'
import { validateDesign } from '../geometry/validate'
import { draftStatusOf, type Action, type SessionState } from './session'

// Session reducer (design "sessionReducer(s, a, ch)").
// Pure: never reads the clock or randomness, never mutates `s` or `ch`; same inputs give
// deep-equal outputs. History entries are carried over by reference (append-only).
//
// Edit actions (task 13.1; Req 4.1, 4.2, 4.4, 6.6, 6.8, 7.6, 7.8, 15.9, 16.1, 16.2, 16.9):
//   applySection   convertSection to the target kind (bbox preserved)
//   setParam       'clamp' → clampParam (always valid); 'strict' → trySetParam (all-or-nothing)
//   setOrientation 0 | 90 only; anything else → BAD_ORIENTATION
// Every candidate draft is re-checked with validateDesign before it is accepted, so the draft
// is always valid and locked fields (lengthM, materialId) can never change. A rejected edit
// keeps `draft` and `draftStatus` unchanged and records the errors in `draftErrors`
// (Req 15.9, 16.9). An accepted edit clears `draftErrors` and recomputes `draftStatus`
// against the latest Test_Result, ignoring the design id (Req 16.1, 16.2).
//
// Remaining actions (setPrediction, cancelPrediction, runTest, restore, toggleCompare,
// setReflection, submit, importDesign, reset) are implemented in task 19; until then they
// return the input state unchanged.

const LOCKED_LABELS: Readonly<Record<LockedField, string>> = {
  lengthM: 'The beam length',
  materialId: 'The material',
  forceN: 'The load',
  support: 'The support',
}

function isLockedField(param: string): param is LockedField {
  return Object.prototype.hasOwnProperty.call(LOCKED_LABELS, param)
}

/** Keeps draft and draftStatus; records why the edit was rejected. */
function reject(s: SessionState, errors: GeometryError[]): SessionState {
  return { ...s, draftErrors: errors }
}

/** Accepts `section`/`orientation` changes only if the resulting design validates. */
function acceptDraft(s: SessionState, candidate: BeamDesign, ch: Challenge): SessionState {
  const errors = validateDesign(candidate, ch)
  if (errors.length > 0) return reject(s, errors)
  return { ...s, draft: candidate, draftErrors: [], draftStatus: draftStatusOf(candidate, s.history) }
}

function withSection(s: SessionState, section: Section, ch: Challenge): SessionState {
  return acceptDraft(s, { ...s.draft, section }, ch)
}

function setParam(
  s: SessionState,
  param: string,
  valueM: number,
  mode: 'clamp' | 'strict',
  ch: Challenge,
): SessionState {
  if (isLockedField(param)) {
    return reject(s, [
      {
        code: 'LOCKED_FIELD_CHANGED',
        param,
        message: `${LOCKED_LABELS[param]} is fixed by the challenge and cannot be changed.`,
      },
    ])
  }
  const section = s.draft.section
  if (mode === 'strict') {
    const r = trySetParam(section, param, valueM, ch.sectionLimits)
    return r.ok ? withSection(s, r.value, ch) : reject(s, r.error)
  }
  if (!(paramsOf(section.kind) as readonly string[]).includes(param)) {
    return reject(s, [
      {
        code: 'SECTION_NOT_ALLOWED',
        param,
        message: `"${param}" is not a dimension of a ${section.kind} section.`,
      },
    ])
  }
  return withSection(s, clampParam(section, param, valueM, ch.sectionLimits), ch)
}

export function sessionReducer(s: SessionState, a: Action, ch: Challenge): SessionState {
  switch (a.type) {
    case 'applySection': {
      if (!(ch.allowedSections as readonly string[]).includes(a.kind)) {
        // validateDesign reports SECTION_NOT_ALLOWED for the unconverted kind.
        return acceptDraft(s, { ...s.draft, section: { ...s.draft.section, kind: a.kind } as Section }, ch)
      }
      return withSection(s, convertSection(s.draft.section, a.kind, ch.sectionLimits, ch.sectionDefaults), ch)
    }
    case 'setParam':
      return setParam(s, a.param, a.valueM, a.mode, ch)
    case 'setOrientation': {
      const o: unknown = a.orientationDeg
      if (o !== 0 && o !== 90) {
        return reject(s, [
          {
            code: 'BAD_ORIENTATION',
            param: 'orientationDeg',
            message: `Orientation must be exactly 0° or 90° (got ${String(o)}).`,
          },
        ])
      }
      return acceptDraft(s, { ...s.draft, orientationDeg: o }, ch)
    }
    // TODO(task 19.1): runTest, setPrediction, cancelPrediction.
    case 'setPrediction':
    case 'cancelPrediction':
    case 'runTest':
    // TODO(task 19.2): restore, toggleCompare, setReflection, submit, importDesign, reset.
    case 'restore':
    case 'toggleCompare':
    case 'setReflection':
    case 'submit':
    case 'importDesign':
    case 'reset':
      return s
  }
}
