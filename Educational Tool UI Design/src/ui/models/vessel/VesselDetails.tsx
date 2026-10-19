import type { VesselAnalysis } from '../../../physics/vessel/types'
import { formatLimit, formatVessel, useVesselStore } from './shared'

// Pressure vessel result details shown under the 3D or 2D view (task 69; MM-22, D-26). A text
// summary of the LATEST TESTED design (the canvas and the 2D drawing describe themselves through
// it) and a collapsed table of the three checked membrane stresses with their locations. All
// values come from the stored analysis and evaluation.

export const SUMMARY_ID = 'vessel-view-summary'

/** One-line description of the stored stresses, volume and length. */
export function stressSummary(a: Pick<VesselAnalysis, 'hoopStressPa' | 'longitudinalStressPa' | 'headStressPa' | 'volumeM3' | 'overallLengthM'>): string {
  return `hoop stress ${formatVessel(a.hoopStressPa, 'Pa')}, longitudinal stress ${formatVessel(a.longitudinalStressPa, 'Pa')}, head stress ${formatVessel(a.headStressPa, 'Pa')} · volume ${formatVessel(a.volumeM3, 'm3')} · overall length ${formatVessel(a.overallLengthM, 'm')}`
}

export default function VesselDetails() {
  const { state } = useVesselStore()
  const latest = state.history[state.history.length - 1]!
  const a = latest.analysis
  const check = (id: string) => latest.evaluation.constraints.find((c) => c.id === id)!
  const result = (ok: boolean) => (ok ? '✓ Pass' : '✗ Fail')
  const rows: [string, string][] = [
    ['Shell, around the circumference', 'hoopStress'],
    ['Shell, along the axis', 'longitudinalStress'],
    ['Heads, in every direction', 'headStress'],
  ]
  return (
    <>
      <p id={SUMMARY_ID} className="viewport-label vessel-summary" aria-live="off">
        A steel air receiver: a cylindrical shell closed by two hemispherical heads, cut away to show both walls.
        {' '}Latest tested: {stressSummary(a)}
        {state.draftStatus === 'draft' && ' · draft changed since this test'}
      </p>
      <details className="vessel-sections">
        <summary>Checked stresses</summary>
        <table aria-label="Checked stresses of the latest tested design">
          <thead>
            <tr>
              <th scope="col">Location</th>
              <th scope="col">Stress</th>
              <th scope="col">Limit</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([location, id]) => {
              const c = check(id)
              return (
                <tr key={id}>
                  <th scope="row">{location}</th>
                  <td>{formatVessel(c.value, c.unit)}</td>
                  <td>{formatLimit(c)}</td>
                  <td>{result(c.passed)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </details>
    </>
  )
}
