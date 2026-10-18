import { createContext, useContext } from 'react'
import type { ModelRef } from '../../challenge/types'
import { modelOf } from '../../state/models'
import { useModelStore } from '../state/store'
import { beamUi } from './beam'
import { heatSinkUi } from './heatSink'
import { bracketUi } from './bracket'
import { bracedFrameUi } from './bracedFrame'
import { torsionUi } from './torsion'
import type { ModelUi } from './types'
import { vibrationUi } from './vibration'

// Model UI registry (task 34.2; MM-20). Maps an explicit model id to its workbench UI. A model
// with a runtime but no UI here cannot be opened (bootstrap refuses it), so no model is ever
// shown through another model's components. Tests may provide a different map through
// ModelUiContext; production uses the default registry only.
//
// The default map is built on first use, not at module load: model UI modules import shared
// components that import this registry, so an eager map could capture an uninitialized entry
// depending on import order.

let defaults: ReadonlyMap<string, ModelUi> | undefined

/** The production registry. */
export function defaultModelUis(): ReadonlyMap<string, ModelUi> {
  defaults ??= new Map([
    ['eulerBernoulliCantileverTipForce', beamUi],
    ['circularShaftTorsion', torsionUi],
    ['sdofBaseIsolation', vibrationUi],
    ['plateFinHeatSink', heatSinkUi],
    ['boltedLBracket', bracketUi],
    ['pinJointedBracedFrame', bracedFrameUi],
  ])
  return defaults
}

/** Overrides the production registry for a subtree (tests only); null means the default. */
export const ModelUiContext = createContext<ReadonlyMap<string, ModelUi> | null>(null)

/** The UI for a model identity in a registry, or undefined. Versions share one UI per id. */
export function modelUiFor(ref: Readonly<ModelRef>, registry: ReadonlyMap<string, ModelUi> | null = null): ModelUi | undefined {
  return (registry ?? defaultModelUis()).get(ref.id)
}

/** The active challenge's model UI; throws rather than substituting another model's UI. */
export function useModelUi(): ModelUi {
  const registry = useContext(ModelUiContext)
  const ref = modelOf(useModelStore<unknown, never, { model?: ModelRef }>().challenge)
  const ui = modelUiFor(ref, registry)
  if (ui === undefined) throw new Error(`No workbench is available for analysis model "${ref.id}".`)
  return ui
}
