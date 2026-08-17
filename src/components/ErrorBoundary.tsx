import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center bg-surface p-8">
          <div className="max-w-lg rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="mb-2 text-lg font-bold text-red-400">Something went wrong</p>
            <p className="mb-4 text-sm text-red-300/80 font-mono break-all">
              {this.state.error.message}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}