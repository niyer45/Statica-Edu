import { Component, type ReactNode } from 'react'

// Error boundary for a model's lazy 3D view (task 54): a failed chunk import, Canvas creation or
// WebGL context error renders the model's main-bundle 2D fallback instead. The beam keeps its own
// ViewportBoundary; this generic form takes the fallback as a prop.

export default class ModelViewBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
