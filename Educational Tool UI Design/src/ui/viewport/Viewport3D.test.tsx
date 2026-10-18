import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { useSession, useDispatch } from '../state/store'
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera } from 'three'
import Viewport3D, { beamContainsPointer } from './Viewport3D'

const clock = () => '2026-10-15T00:00:00.000Z'
let state: ReturnType<typeof useSession>
function Probe() {
  state = useSession()
  const dispatch = useDispatch()
  return (
    <>
      <button
        onClick={() => dispatch({ type: 'applySection', kind: 'rectangle' })}
      >
        Apply rectangle
      </button>
      <button
        onClick={() =>
          dispatch({
            type: 'setParam',
            param: 'webThicknessM',
            valueM: 0.006,
            mode: 'strict',
          })
        }
      >
        Set web
      </button>
      <button
        onClick={() => dispatch({ type: 'setOrientation', orientationDeg: 0 })}
      >
        Rotate
      </button>
    </>
  )
}
function setup() {
  const boot = bootstrap(bundledChallengeResult, clock, () => 'baseline', 'parametric')
  if (!boot.ok) throw new Error(boot.error.message)
  return render(
    <StoreProvider
      challenge={boot.value.challenge}
      initialSession={boot.value.session}
      clock={clock}
      newId={() => 'test'}
    >
      <Viewport3D />
      <Probe />
    </StoreProvider>,
  )
}
afterEach(cleanup)

describe('viewport presentation (task 14.3)', () => {
  it('keeps the summary synchronized with typed geometry, orientation and stored results', () => {
    setup()
    const summary = () => screen.getByTestId('scene-summary').textContent
    // The baseline is an I-section turned 90° (task 59).
    expect(summary()).toContain('I-section, orientation 90°')
    expect(summary()).toContain('Width 36.50 mm')
    expect(summary()).toContain('Height 84.00 mm')
    expect(summary()).toContain('Flange thickness 3.00 mm')
    expect(summary()).toContain('Web thickness 7.00 mm')
    expect(summary()).toContain('600 mm')
    expect(summary()).toContain('300 N downward')
    const storedShape = summary()!.split('Deformed shape shows')[1]
    fireEvent.click(screen.getByText('Set web'))
    fireEvent.click(screen.getByText('Rotate'))
    expect(summary()).toContain('I-section, orientation 0°')
    expect(summary()).toContain('Flange thickness 3.00 mm')
    expect(summary()).toContain('Web thickness 6.00 mm')
    fireEvent.click(screen.getByText('Apply rectangle'))
    expect(summary()).toContain('Rectangle, orientation 0°')
    expect(summary()).toContain('Width 36.50 mm')
    expect(summary()).toContain('Height 84.00 mm')
    expect(summary()!.split('Deformed shape shows')[1]).toBe(storedShape)
  })

  it('keeps every camera control and deformation toggle independent of session state', () => {
    setup()
    const before = state
    const toggle = screen.getByRole('button', { name: 'Show deformation' })
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Exaggerated visualization (×15)')).toBeTruthy()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByText('Exaggerated visualization (×15)')).toBeNull()
    fireEvent.click(toggle)
    for (const name of ['Zoom in', 'Zoom out', 'Reset view', 'Fit view'])
      fireEvent.click(screen.getByRole('button', { name }))
    expect(state).toBe(before)
    expect(
      screen.getByRole('img', { name: 'Material is fixed by the challenge' }),
    ).toBeTruthy()
  })
})

describe('beam drop highlighting', () => {
  it('highlights beam hits rather than empty canvas, and ignores invalid coordinates', () => {
    const camera = new PerspectiveCamera(45, 1, 0.01, 10)
    camera.position.set(0, 0, 2)
    camera.lookAt(0, 0, 0)
    const geometry = new BoxGeometry(0.2, 0.2, 0.2)
    const material = new MeshBasicMaterial()
    const beam = new Mesh(geometry, material)
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 } as DOMRect)
    const target = { camera, beam, canvas }
    expect(beamContainsPointer(target, 100, 100)).toBe(true)
    expect(beamContainsPointer(target, 10, 10)).toBe(false)
    expect(beamContainsPointer(target, NaN, 100)).toBe(false)
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 } as DOMRect)
    expect(beamContainsPointer(target, 100, 100)).toBe(false)
    geometry.dispose()
    material.dispose()
  })
})
