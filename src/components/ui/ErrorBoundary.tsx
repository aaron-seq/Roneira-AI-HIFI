"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="card max-w-md p-8 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "rgba(231,76,60,0.1)" }}
            >
              <AlertTriangle className="h-7 w-7" style={{ color: "#E74C3C" }} />
            </div>
            <h3 className="mb-2 text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Something went wrong
            </h3>
            <p className="mb-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
              An unexpected error occurred while rendering this component.
            </p>
            {this.state.error && (
              <p
                className="mb-4 rounded-lg p-3 text-left font-mono text-xs"
                style={{ background: "var(--color-surface)", color: "#E74C3C" }}
              >
                {this.state.error.message}
              </p>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: "var(--color-info)", border: "1px solid var(--color-border)" }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </button>
              <a
                href="/dashboard/market-overview"
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ background: "var(--color-info)" }}
              >
                <Home className="h-3.5 w-3.5" />
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Inline error display for non-critical failures */
export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex items-center gap-4 p-4" style={{ border: "1px solid rgba(231,76,60,0.3)" }}>
      <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "#E74C3C" }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
          style={{ color: "var(--color-info)", border: "1px solid var(--color-border)" }}
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  );
}

/** Empty state component */
export function EmptyState({
  icon: Icon = AlertTriangle,
  title = "No data available",
  description = "Check back later or try a different filter.",
  action,
  actionLabel = "Refresh",
}: {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="card flex flex-col items-center py-16">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "var(--color-surface-offset)" }}
      >
        <Icon className="h-7 w-7" style={{ color: "var(--color-text-faint)" }} />
      </div>
      <h3 className="mb-1 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
        {title}
      </h3>
      <p className="mb-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {description}
      </p>
      {action && (
        <button
          onClick={action}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors hover:bg-white/5"
          style={{ color: "var(--color-info)", border: "1px solid var(--color-border)" }}
        >
          <RefreshCw className="h-3 w-3" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
