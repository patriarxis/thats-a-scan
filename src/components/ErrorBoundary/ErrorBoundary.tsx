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

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className={styles.errorPage}>
            <div className={styles.errorCard}>
              <p className={styles.errorTitle}>Something went wrong</p>
              <p className={styles.errorMessage}>
                {this.state.error?.message ?? "An unexpected error occurred."}
              </p>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className={styles.retryBtn}
              >
                Try again
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
