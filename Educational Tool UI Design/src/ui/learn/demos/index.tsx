import type { ReactNode } from 'react'
import type { DemoKind } from '../../../learn/types'
import { AXIAL_DEMOS } from './axial'
import { BEAM_DEMOS } from './beam'
import { TORSION_DEMOS } from './torsion'

// Demo registry (task 67). Each module's demos live in their own file and are added here; a demo
// renders its controls, drawing, text readout and a one-line note on the model it idealizes.

const DEMOS: Readonly<Record<DemoKind, () => ReactNode>> = {
  ...BEAM_DEMOS,
  ...TORSION_DEMOS,
  ...AXIAL_DEMOS,
}

export default function Demo({ kind }: { kind: DemoKind }) {
  return <div className="learn-demo">{DEMOS[kind]()}</div>
}
