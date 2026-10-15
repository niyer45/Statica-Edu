import type { StudentChallenge } from '../../challenge/content'
import type { EvaluationStatus } from '../../evaluation/types'
import { selectDraftEnvelope, selectLatestResult } from '../../state/selectors'
import type { SessionState } from '../../state/session'
import { formatMm } from '../../units/units'
import { useChallenge, useSession } from '../state/store'
import { SECTION_KIND_LABELS, sectionParamValues } from './sceneLayout'

// Text summary of the viewport for assistive technology (Req 32.2, 32.3). Rendered next to the
// canvas (and the 2D fallback) and referenced by `aria-describedby`. Recomputed on every render,
// so it follows draft and evaluation changes in the same frame.

export const SCENE_SUMMARY_ID = 'viewport-scene-summary'

const STATUS_TEXT: Record<EvaluationStatus, string> = {
  accepted: 'accepted',
  notAccepted: 'not accepted',
  modelNotApplicable: 'model not applicable',
}

export function sceneSummaryText(s: SessionState, ch: Readonly<StudentChallenge>): string {
  const { section, orientationDeg, lengthM } = s.draft
  const params = sectionParamValues(section)
    .map((p) => `${p.label} ${formatMm(p.valueM)} mm`)
    .join(', ')
  const env = selectDraftEnvelope(s)
  const latest = selectLatestResult(s)
  const latestName = latest.label ?? `Iteration ${latest.iteration}`
  return [
    `Section: ${SECTION_KIND_LABELS[section.kind]}, orientation ${orientationDeg}°.`,
    `${params}.`,
    `Beam length ${formatMm(lengthM, 0)} mm, fixed at the wall.`,
    `Applied force ${ch.load.forceN} N downward at the free end.`,
    `Envelope ${formatMm(env.widthZM)} mm wide (Z) by ${formatMm(env.heightYM)} mm high (Y), limit ${formatMm(ch.constraints.maxWidthM, 0)} by ${formatMm(ch.constraints.maxHeightM, 0)} mm.`,
    `Deformed shape shows ${latestName}: tip deflection ${formatMm(latest.analysis.tipDeflectionM)} mm, ${STATUS_TEXT[latest.evaluation.status]}.`,
  ].join(' ')
}

export default function SceneSummary() {
  const state = useSession()
  const challenge = useChallenge()
  return (
    <p id={SCENE_SUMMARY_ID} className="sr-only" data-testid="scene-summary">
      {sceneSummaryText(state, challenge)}
    </p>
  )
}
