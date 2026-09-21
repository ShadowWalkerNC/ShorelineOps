import React from 'react'

interface State { error: Error | null }

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[UI] Unhandled render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div role="alert" className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">This screen could not load</h1>
          <p className="mt-2 text-sm text-slate-600">Your data was not changed. Reload the application and try again. If the problem continues, give support the time it occurred and the page you were using.</p>
          <button onClick={() => window.location.reload()} className="mt-5 min-h-12 rounded-lg bg-blue-700 px-5 font-semibold text-white">Reload application</button>
        </div>
      </main>
    )
  }
}
