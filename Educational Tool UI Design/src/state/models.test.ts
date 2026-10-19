import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../test/arbitraries'
import { BEAM_MODEL_REF } from '../challenge/types'
import { evaluate } from '../evaluation/evaluate'
import { scorePrediction } from '../evaluation/prediction'
import { validateDesign } from '../geometry/validate'
import { analyze, MODEL_ID } from '../physics/analyze'
import { exportDesign, importDesign } from './importExport'
import { beamModel, modelFor, modelOf, REGISTERED_MODEL_IDS, requireModel, UnregisteredModelError } from './models'
import { cloneDesign, sameDesignIgnoringId } from './session'

// Model registry (task 34.1 step 1; MM-01–MM-07). The beam definition must be a thin wrapper
// over the existing functions so beam results and saves cannot drift (MM-03, MM-17).

const ch = bundledChallenge()

describe('model registry', () => {
  it('registers the beam, torsion, vibration, heat sink, bracket, braced-frame and axial-rod models; the beam identity matches the analysis modelId', () => {
    expect(REGISTERED_MODEL_IDS).toEqual(['eulerBernoulliCantileverTipForce', 'circularShaftTorsion', 'sdofBaseIsolation', 'plateFinHeatSink', 'boltedLBracket', 'pinJointedBracedFrame', 'axialTieRod'])
    expect(beamModel.ref).toEqual({ id: MODEL_ID, version: 1 })
    expect(beamModel.ref).toBe(BEAM_MODEL_REF)
    expect(beamModel.envelopeVersion).toBe(1)
  })

  it('wraps the existing beam functions', () => {
    expect(beamModel.validateDesign).toBe(validateDesign)
    const analysis = analyze(ch.initialDesign, ch)
    expect(beamModel.analyze(ch.initialDesign, ch)).toEqual(analysis)
    expect(beamModel.evaluate(ch.initialDesign, analysis, ch)).toEqual(evaluate(ch.initialDesign, analysis, ch))
    expect(beamModel.scorePrediction).toBe(scorePrediction)
    expect(beamModel.importDesign).toBe(importDesign)
    expect(beamModel.exportDesign).toBe(exportDesign)
    expect(beamModel.cloneDesign).toBe(cloneDesign)
    expect(beamModel.sameDesignIgnoringId).toBe(sameDesignIgnoringId)
  })

  it('reads tip deflection as the beam primary prediction metric', () => {
    const analysis = analyze(ch.initialDesign, ch)
    expect(beamModel.primaryMetric.id).toBe('tipDeflectionM')
    expect(beamModel.primaryMetric.read(analysis)).toBe(analysis.tipDeflectionM)
  })

  it('treats a challenge without model as the beam and honors an explicit beam model', () => {
    expect(ch.model).toBeUndefined()
    expect(modelOf(ch)).toBe(BEAM_MODEL_REF)
    expect(modelOf({ model: { id: MODEL_ID, version: 1 } })).toEqual(BEAM_MODEL_REF)
    expect(requireModel(ch)).toBe(beamModel)
  })

  it.each([
    ['unknown id', { id: 'notARegisteredModel', version: 1 }],
    ['other torsion version', { id: 'circularShaftTorsion', version: 2 }],
    ['other vibration version', { id: 'sdofBaseIsolation', version: 2 }],
    ['other heat sink version', { id: 'plateFinHeatSink', version: 2 }],
    ['other bracket version', { id: 'boltedLBracket', version: 2 }],
    ['retired stepped-bar bracket', { id: 'steppedBarBracket', version: 1 }],
    ['other braced-frame version', { id: 'pinJointedBracedFrame', version: 2 }],
    ['other beam version', { id: MODEL_ID, version: 2 }],
  ])('never substitutes another model for an %s', (_name, ref) => {
    expect(modelFor(ref)).toBeUndefined()
    expect(() => requireModel({ model: ref })).toThrow(UnregisteredModelError)
    expect(() => requireModel({ model: ref })).toThrow(`"${ref.id}" version ${ref.version} is not available`)
  })
})
