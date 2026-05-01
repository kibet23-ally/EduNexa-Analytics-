import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; name?: string },
  State
> {
  constructor(props: { children: React.ReactNode; name?: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-red-700">
              {this.props.name || 'Page'} crashed
            </h2>
            <pre className="text-xs text-red-600 bg-red-100 p-4 rounded-xl overflow-auto whitespace-pre-wrap">
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack?.slice(0, 500)}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
