import { Component, type ReactNode } from 'react'
import FallbackViewport, { type ViewportProps } from './FallbackViewport'

/** Outside Suspense: catches lazy import rejection as well as Canvas/context creation errors. */
export default class ViewportBoundary extends Component<ViewportProps & { children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <FallbackViewport onUnavailable={this.props.onUnavailable} /> : this.props.children
  }
}
