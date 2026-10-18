import { expect, it } from 'vitest'
import { bundledChallenge } from '../arbitraries'
import { initSession, type Action } from '../../src/state/session'
import { sessionReducer } from '../../src/state/reducer'
import { exportDesign, importDesign } from '../../src/state/importExport'
import { createHarness } from './model'

it('runs the design Example Usage flow with cancel, rejection, restore and accepted submission', () => {
  const ch = bundledChallenge()
  let s = createHarness(ch).real.state
  const dispatch = (action: Action) => { s = sessionReducer(s, action, ch) }
  // The baseline is already an I-section, turned 90°: stand it upright and resize it to the reference.
  dispatch({ type: 'applySection', kind: 'iSection' })
  dispatch({ type: 'setOrientation', orientationDeg: 0 })
  for (const [param, valueM] of [['heightM', 0.06], ['widthM', 0.04], ['flangeThicknessM', 0.004], ['webThicknessM', 0.003]] as const) dispatch({ type: 'setParam', param, valueM, mode: 'strict' })
  dispatch({ type: 'runTest', now: 't', id: 't1' })
  expect(s.ui.predictionDialogOpen).toBe(true)
  dispatch({ type: 'cancelPrediction' })
  expect(s.history).toHaveLength(1)
  dispatch({ type: 'runTest', now: 't', id: 't1' })
  dispatch({ type: 'setPrediction', direction: 'decrease', now: 'p' })
  dispatch({ type: 'runTest', now: 't', id: 't1' })
  expect(s.history[1]!.evaluation.status).toBe('accepted')
  expect(s.history[1]!.predictionOutcome?.matched).toBe(true)
  const tested = s
  dispatch({ type: 'setParam', param: 'heightM', valueM: 0.001, mode: 'strict' })
  expect(s.draft).toBe(tested.draft)
  expect(s.draftErrors[0]?.code).toBe('BELOW_MIN')
  const rejected = s
  dispatch({ type: 'restore', testResultId: 'unknown' })
  expect(s).toBe(rejected)
  dispatch({ type: 'restore', testResultId: 'model:baseline' })
  expect(s.draft.section).toEqual(ch.initialDesign.section)
  dispatch({ type: 'setReflection', text: ' Moving material to flanges raised I. ' })
  const before = s
  dispatch({ type: 'submit', testResultId: 'model:baseline', now: 'submit' })
  expect(s).toBe(before)
  dispatch({ type: 'submit', testResultId: 't1', now: 'submit' })
  expect(s.submission?.status).toBe('accepted')
  expect(s.submission?.reflection).toBe(' Moving material to flanges raised I. ')
  const payload = JSON.parse(exportDesign(s.draft, ch))
  payload.design.lengthM = 1
  payload.design.materialId = 'other'
  const imported = importDesign(payload, ch)
  expect(imported.ok).toBe(false)
  if (!imported.ok) expect(imported.error).toHaveLength(2)
  const bad = structuredClone(ch)
  bad.initialDesign.lengthM = -1
  expect(initSession(bad, 't', 'base').ok).toBe(false)
})
