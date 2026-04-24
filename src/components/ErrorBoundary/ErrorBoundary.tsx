"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import styles from "./ErrorBoundary.module.scss";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  componentDidMount() {
    if (process.env.NODE_ENV === "production") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("forceErrorBoundary")) return;
    this.setState({
      hasError: true,
      error: new Error("Manually triggered error boundary (development only)."),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className={styles.errorPage}>
            <div className={styles.errorGlyph} aria-hidden="true">!</div>
            <h1 className={styles.errorTitle}>Error</h1>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={styles.reloadBtn}
            >
              Reload page
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
