import { Component, type ReactNode } from 'react'
import FallbackViewport, { type ViewportProps } from './FallbackViewport'

/**
 * Outside Suspense: catches lazy import rejection as well as Canvas/context creation errors.
 * `fallback` lets a model supply its own main-bundle view (task 54.2); the beam's typed SVG
 * fallback is the default.
 */
export default class ViewportBoundary extends Component<ViewportProps & { children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return this.props.fallback ?? <FallbackViewport onUnavailable={this.props.onUnavailable} />
  }
}
