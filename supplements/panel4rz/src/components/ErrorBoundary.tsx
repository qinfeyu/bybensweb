import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-slate-900 border border-rose-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-700 rounded-xl flex items-center justify-center font-black text-lg">!</div>
              <div>
                <h1 className="text-lg font-black text-white">Application Error</h1>
                <p className="text-xs text-rose-300">Something went wrong while rendering the panel</p>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-rose-400">Error Message:</p>
              <pre className="text-xs text-white font-mono whitespace-pre-wrap break-all">
                {this.state.error?.message}
              </pre>
            </div>

            {this.state.error?.stack && (
              <div className="bg-slate-800 rounded-xl p-4 space-y-2 max-h-64 overflow-y-auto">
                <p className="text-xs font-bold text-slate-400">Stack Trace:</p>
                <pre className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap break-all">
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3 rounded-xl text-sm transition-all"
            >
              Reload Panel
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
