import { useEffect, useRef, useState } from 'react'
import './math.css'

// Typeset LaTeX for the reference dialogs (task 65). KaTeX loads as a lazy chunk the first time a
// formula is shown, so the main bundle does not grow; until then (or if it fails to load) the
// plain-text version is shown. katex.render builds DOM nodes and sets styles through the CSSOM,
// which the production CSP (`default-src 'self'`) allows; avoid \fcolorbox and \boldsymbol-style
// commands, which write style attributes. Expressions are static source strings, never user input.

type Katex = (typeof import('katex'))['default']
let katexLoad: Promise<Katex> | null = null
const loadKatex = () =>
  (katexLoad ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => m.default))

export interface TeXProps {
  /** LaTeX source, e.g. `\delta = \dfrac{F L^{3}}{3 E I}`. */
  tex: string
  /** Plain-text equivalent, shown until KaTeX has rendered. */
  text: string
}

export default function TeX({ tex, text }: TeXProps) {
  const target = useRef<HTMLSpanElement>(null)
  const [rendered, setRendered] = useState(false)
  useEffect(() => {
    let live = true
    loadKatex()
      .then((katex) => {
        if (!live || !target.current) return
        katex.render(tex, target.current, { displayMode: true, throwOnError: false, output: 'htmlAndMathml' })
        setRendered(true)
      })
      .catch(() => {
        katexLoad = null // keep the plain text; retry on the next open
      })
    return () => {
      live = false
    }
  }, [tex])
  return (
    <span className="tex">
      {!rendered && <span className="tex-text">{text}</span>}
      {/* KaTeX owns this node's children; React never renders into it. */}
      <span ref={target} hidden={!rendered} />
    </span>
  )
}
