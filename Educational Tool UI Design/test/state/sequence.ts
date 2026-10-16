import fc from 'fast-check'
import { bundledChallenge } from '../arbitraries'
import { assertProperty } from '../pbt'
import { createHarness, SessionCommand, sessionCommands, type CommandInput, type InvariantHook } from './model'

/** Shared setup for later state properties: multiple tests, edits, a gated request and restore. */
export function sequenceHarness(hook: InvariantHook) {
  const h = createHarness(bundledChallenge(), { hooks: [hook] })
  const inputs: CommandInput[] = [
    { kind: 'runTest' },
    { kind: 'literal', action: { type: 'setPrediction', direction: 'same', now: 'p1' } },
    { kind: 'runTest' },
    { kind: 'literal', action: { type: 'applySection', kind: 'rectangle' } },
    { kind: 'setCurrentParam', value: 0.06, mode: 'strict' },
    { kind: 'runTest' },
    { kind: 'literal', action: { type: 'setPrediction', direction: 'decrease', now: 'p3' } },
    { kind: 'runTest' },
    { kind: 'target', type: 'restore', target: 'baseline' },
    { kind: 'runTest' },
    { kind: 'target', type: 'restore', target: 'latest' },
    { kind: 'importCurrent' },
    { kind: 'literal', action: { type: 'setReflection', text: '  Material distribution matters.  ' } },
    { kind: 'target', type: 'submit', target: 'latest' },
    { kind: 'literal', action: { type: 'setReflection', text: ' ' } },
    { kind: 'target', type: 'submit', target: 'latest' },
    { kind: 'literal', action: { type: 'reset' } },
  ]
  for (const input of inputs) new SessionCommand(input).run(h.model, h.real)
  return h
}

export function assertSequences(makeHook: () => InvariantHook) {
  const ch = bundledChallenge()
  assertProperty(fc.property(sessionCommands(ch), (commands) => {
    fc.modelRun(() => sequenceHarness(makeHook()), commands)
  }))
}
