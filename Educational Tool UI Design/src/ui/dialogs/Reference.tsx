import type { ReactNode } from 'react'
import TeX from '../math/TeX'

// Shared parts of the challenge reference dialogs (the light-bulb links; task 65): typeset
// formulas, a few key points, and the model limits in small print. Static text only, no
// computed numbers.

export function Formula({ tex, text, caption }: { tex: string; text: string; caption: string }) {
  return (
    <figure className="reference-formula">
      <TeX tex={tex} text={text} />
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

export function KeyPoints({ points }: { points: readonly ReactNode[] }) {
  return (
    <div className="reference-points">
      <h3>Key points</h3>
      <ul>
        {points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Model limits: what the idealized model leaves out, plus any assumptions or sources. Collapsed by
 * default so the key points lead; the same unsupported effects are also listed with each result.
 */
export function FinePrint({ unsupported, children }: { unsupported: readonly string[]; children?: ReactNode }) {
  return (
    <details className="reference-fineprint">
      <summary>What this model leaves out</summary>
      <p>This idealized model does not include: {unsupported.join(', ')}.</p>
      {children}
    </details>
  )
}
