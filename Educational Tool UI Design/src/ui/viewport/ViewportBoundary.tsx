import { Component, type ComponentType, type ReactNode } from 'react'
import FallbackViewport, { type ViewportProps } from './FallbackViewport'

export interface ViewportBoundaryProps extends ViewportProps {
  children: ReactNode
  /** Main-bundle fallback view: the beam's 2D viewport unless a model supplies its own. */
  fallback?: ComponentType<ViewportProps>
}

/** Outside Suspense: catches lazy import rejection as well as Canvas/context creation errors. */
export default class ViewportBoundary extends Component<ViewportBoundaryProps, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    const Fallback = this.props.fallback ?? FallbackViewport
    return this.state.failed ? <Fallback onUnavailable={this.props.onUnavailable} /> : this.props.children
  }
}
