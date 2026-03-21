"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorBoundaryFallback } from "./ErrorBoundaryFallback";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorId: "" };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = Date.now().toString(36).slice(-8);
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack, errorId: this.state.errorId },
    });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorBoundaryFallback
          error={this.state.error ?? new Error("Unknown error")}
          resetErrorBoundary={() => this.setState({ hasError: false, error: null, errorId: "" })}
          errorId={this.state.errorId}
        />
      );
    }
    return this.props.children;
  }
}
