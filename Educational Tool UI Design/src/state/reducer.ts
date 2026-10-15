import type { Challenge, LockedField } from '../challenge/types'
import { deepFreeze } from '../challenge/deepFreeze'
import { evaluate } from '../evaluation/evaluate'
import { scorePrediction } from '../evaluation/prediction'
import type { TestResult } from '../evaluation/types'
import { analyze, PhysicsInvariantError } from '../physics/analyze'
import { clampParam, paramsOf, trySetParam } from '../geometry/clamp'
import { convertSection } from '../geometry/convert'
import type { BeamDesign, GeometryError, Section } from '../geometry/sections'
import { validateDesign } from '../geometry/validate'
import { importDesign } from './importExport'
import { cloneDesign, draftStatusOf, type Action, type SessionState } from './session'

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
// Prediction and test actions (task 19.1) validate before gating, analyze frozen snapshots,
// and append immutable results. Learning-loop actions (19.2) preserve all history entries.

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

/** Store a validated checkpoint response; the UI dispatches runTest after confirmation. */
function setPrediction(s: SessionState, a: Extract<Action, { type: 'setPrediction' }>): SessionState {
  const validDirection = a.direction === 'increase' || a.direction === 'decrease' || a.direction === 'same'
  const validExplanation = a.explanation === undefined || (typeof a.explanation === 'string' && a.explanation.length <= 500)
  if (!validDirection || !validExplanation) {
    return {
      ...s,
      pendingPrediction: undefined,
      ui: {
        ...s.ui,
        predictionDialogOpen: true,
        notice: {
          kind: 'error',
          message: !validDirection ? 'Select a prediction direction: increase, decrease, or same.' : 'Prediction explanation must contain at most 500 characters.',
        },
      },
    }
  }
  const previous = s.history[s.history.length - 1]!
  return {
    ...s,
    pendingPrediction: deepFreeze({
      iteration: previous.iteration + 1,
      direction: a.direction,
      ...(a.explanation !== undefined ? { explanation: a.explanation } : {}),
      createdAt: a.now,
    }),
    ui: { ...s.ui, notice: undefined },
  }
}

/** Validate first (Req 17.2 takes precedence over the design pseudocode's gating order). */
function runTest(s: SessionState, a: Extract<Action, { type: 'runTest' }>, ch: Challenge): SessionState {
  const errors = validateDesign(s.draft, ch)
  if (errors.length > 0) {
    return { ...s, draftErrors: errors, ui: { ...s.ui, predictionDialogOpen: false } }
  }
  const previous = s.history[s.history.length - 1]!
  const iteration = previous.iteration + 1
  const prediction = s.pendingPrediction?.iteration === iteration ? s.pendingPrediction : undefined
  if (ch.predictionPolicy.requiredOnIterations.includes(iteration) && prediction === undefined) {
    return { ...s, draftErrors: [], pendingPrediction: undefined, ui: { ...s.ui, predictionDialogOpen: true, notice: undefined } }
  }
  try {
    const snapshot = deepFreeze(cloneDesign(s.draft))
    const analysis = analyze(snapshot, ch)
    const evaluation = evaluate(snapshot, analysis, ch)
    const result: TestResult = deepFreeze({
      id: a.id,
      iteration,
      designSnapshot: snapshot,
      analysis,
      evaluation,
      accepted: evaluation.accepted,
      failures: [...evaluation.failures],
      ...(prediction !== undefined ? {
        prediction: { ...prediction },
        predictionOutcome: scorePrediction(prediction, previous, analysis),
      } : {}),
      timestamp: a.now,
    })
    const history = Object.freeze([...s.history, result])
    const selected = new Set([...s.compareSelection, result.id])
    const compareSelection = history.filter((r) => r.iteration > 0 && selected.has(r.id)).slice(-3).map((r) => r.id)
    return {
      ...s,
      history,
      draftStatus: 'tested',
      draftErrors: [],
      pendingPrediction: undefined,
      compareSelection,
      ui: { ...s.ui, predictionDialogOpen: false, notice: undefined },
    }
  } catch (error) {
    if (!(error instanceof PhysicsInvariantError)) throw error
    return {
      ...s,
      draftErrors: [],
      ui: { ...s.ui, predictionDialogOpen: false, notice: { kind: 'error', message: error.message } },
    }
  }
}

/** Deterministic fresh draft identity without clock/randomness or an Action API extension. */
function copyForRestore(snapshot: Readonly<BeamDesign>, s: SessionState): BeamDesign {
  const used = new Set([s.draft.id, ...s.history.flatMap((r) => [r.id, r.designSnapshot.id])])
  let suffix = 1
  let id = `${snapshot.id}:restored:${suffix}`
  while (used.has(id)) id = `${snapshot.id}:restored:${++suffix}`
  return { ...cloneDesign(snapshot), id }
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
    case 'setPrediction':
      return setPrediction(s, a)
    case 'cancelPrediction':
      return { ...s, pendingPrediction: undefined, ui: { ...s.ui, predictionDialogOpen: false, notice: undefined } }
    case 'runTest':
      return runTest(s, a, ch)
    case 'restore': {
      const result = s.history.find((r) => r.id === a.testResultId)
      if (result === undefined) return s
      const draft = copyForRestore(result.designSnapshot, s)
      return { ...s, draft, draftStatus: draftStatusOf(draft, s.history), draftErrors: [], pendingPrediction: undefined, ui: { predictionDialogOpen: false } }
    }
    case 'toggleCompare': {
      const result = s.history.find((r) => r.id === a.testResultId)
      if (result === undefined || result.iteration === 0) return s
      if (s.compareSelection.includes(result.id)) {
        return { ...s, compareSelection: s.compareSelection.filter((id) => id !== result.id), ui: { ...s.ui, notice: undefined } }
      }
      if (s.compareSelection.length >= 3) {
        return { ...s, ui: { ...s.ui, notice: { kind: 'info', message: 'At most three iterations can be compared alongside the Baseline.' } } }
      }
      const selected = new Set([...s.compareSelection, result.id])
      return { ...s, compareSelection: s.history.filter((r) => r.iteration > 0 && selected.has(r.id)).map((r) => r.id), ui: { ...s.ui, notice: undefined } }
    }
    case 'setReflection':
      // Reject hostile/oversized payloads; valid text is stored verbatim, without grading.
      return typeof a.text === 'string' && a.text.length <= 2000 ? { ...s, reflectionAnswer: a.text } : s
    case 'submit': {
      const result = s.history.find((r) => r.id === a.testResultId)
      if (result === undefined || result.iteration < 1 || s.reflectionAnswer.trim() === '') return s
      return { ...s, submission: deepFreeze({ testResultId: result.id, status: result.evaluation.status, reflection: s.reflectionAnswer, efficiency: { ...result.evaluation.efficiency }, submittedAt: a.now }) }
    }
    case 'importDesign': {
      const imported = importDesign(a.json, ch)
      // The UI obtains reasons from the same pure helper; Req 23.6 forbids changing even UI state here.
      if (!imported.ok) return s
      return { ...s, draft: imported.value, draftStatus: draftStatusOf(imported.value, s.history), draftErrors: [], pendingPrediction: undefined, ui: { predictionDialogOpen: false } }
    }
    case 'reset': {
      // History is append-only even on reset (Req 18.1); no baseline is regenerated.
      const draft = copyForRestore(s.history[0]!.designSnapshot, s)
      return { ...s, draft, draftStatus: draftStatusOf(draft, s.history), draftErrors: [], pendingPrediction: undefined, compareSelection: [], reflectionAnswer: '', submission: undefined, ui: { predictionDialogOpen: false } }
    }
  }
}
