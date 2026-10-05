import { Component } from 'react';

/**
 * Catches render-time errors so one bad component cannot blank the entire app.
 *
 * Without this, any render throw unmounts the whole React tree and the user is
 * left staring at a blank page with no way back — no nav, no sign-out, nothing.
 * That is exactly what happened when the account overview treated the orders
 * envelope as an array.
 *
 * Note this cannot catch errors in event handlers or async code; those are the
 * job of the toast/error paths in `useAsync`.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Kept for the console: the component stack is what makes a render crash
    // diagnosable at all.
    console.error('Unhandled render error:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
          <h1 className="text-lg font-medium text-ink">Something went wrong</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            This page failed to render. Reloading usually clears it.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-canvas p-3 text-left text-[12px] text-muted">
            {String(error?.message || error)}
          </pre>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-medium text-paper"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
                window.history.pushState({}, '', '/');
                window.location.reload();
              }}
              className="rounded-full border border-line px-5 py-2.5 text-[13.5px] font-medium text-ink"
            >
              Go to home
            </button>
          </div>
        </div>
      </div>
    );
  }
}