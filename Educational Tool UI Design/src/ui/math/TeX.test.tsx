import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import TeX from './TeX'

// Task 65: reference formulas are typeset by a lazily loaded KaTeX, with plain text until then.

afterEach(cleanup)

describe('TeX', () => {
  it('shows the plain-text formula first, then KaTeX output with fractions and MathML', async () => {
    const { container } = render(<TeX tex={String.raw`\delta = \dfrac{F L^{3}}{3 E I}`} text="δ = FL³ ÷ 3EI" />)
    expect(screen.getByText('δ = FL³ ÷ 3EI')).toBeTruthy()
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull())
    expect(screen.queryByText('δ = FL³ ÷ 3EI')).toBeNull()
    expect(container.querySelector('.katex .mfrac')).not.toBeNull()
    expect(container.querySelector('math mfrac')).not.toBeNull()
    expect(container.querySelector('annotation')!.textContent).toBe(String.raw`\delta = \dfrac{F L^{3}}{3 E I}`)
  })
})
