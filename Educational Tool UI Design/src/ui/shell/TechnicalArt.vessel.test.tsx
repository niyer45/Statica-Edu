import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { catalog } from '../../challenge/catalog'
import TechnicalArt from './TechnicalArt'

// Task 69 (PVS-18): the Pressure Vessel I card draws its own vessel, not another challenge's art.

afterEach(cleanup)

describe('TechnicalArt vessel', () => {
  it('is the art of the Pressure Vessel I card', () => {
    expect(catalog.find((e) => e.title === 'Pressure Vessel I')).toMatchObject({ id: '007', art: 'vessel', discipline: 'Structures', difficulty: 'intermediate', available: true })
  })

  it('draws a closed shell with two heads from camera-facing patches only, labelled FIG. 07', () => {
    const { container } = render(<TechnicalArt kind="vessel" />)
    const polygons = [...container.querySelectorAll('polygon')]
    // Front half of the 32-sided shell plus the visible patches of the two 8 × 32 domes.
    expect(polygons.length).toBeGreaterThan(150)
    expect(polygons.length).toBeLessThan(32 + 2 * 8 * 32)
    expect(container.textContent).toContain('FIG. 07')
    // No point load or torque: the only accent is the internal pressure, five short arrows pointing
    // outward from the shell and the two head poles (owner request 2026-10-19).
    expect(container.querySelector('path.art-accent')).toBeNull()
    const accents = container.querySelectorAll('g.art-accent')
    expect(accents).toHaveLength(1)
    expect(accents[0]!.querySelectorAll(':scope > g')).toHaveLength(5)
    const other = render(<TechnicalArt kind="bracket" />).container
    expect(other.querySelectorAll('polygon').length).not.toBe(polygons.length)
  })
})
