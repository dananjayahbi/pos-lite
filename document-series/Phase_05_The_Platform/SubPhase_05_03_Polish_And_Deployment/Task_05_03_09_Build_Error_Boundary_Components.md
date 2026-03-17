# Task 05.03.09 — Build Error Boundary Components

## Metadata

| Field | Value |
|---|---|
| Task ID | 05.03.09 |
| Task Name | Build Error Boundary Components |
| SubPhase | 05.03 — Production Deployment and Polish |
| Complexity | Medium |
| Estimated Duration | 2–3 hours |
| Assignee Role | Lead Developer |
| Dependencies | Task 05.03.01 (Sentry configured), ShadCN/UI components, design tokens |
| Output Files | src/components/ErrorBoundary.tsx, src/components/ErrorBoundaryFallback.tsx, updated page layout files |

## Objective

Implement React Error Boundary components that intercept unhandled JavaScript errors occurring in the component tree and display a styled, actionable fallback UI instead of crashing the entire page. Integrate Sentry error reporting into the boundary so every caught error is automatically captured with full tenant and user context. Wrap all major page sections — including the POS CartPanel, the product grid, each report chart, and all data tables — in error boundaries so that a failure in one section does not disrupt the rest of the page.

## Context

React's Error Boundary mechanism requires a class component because it relies on the lifecycle methods componentDidCatch and getDerivedStateFromError, which have no hooks equivalent. The ErrorBoundary class component catches render errors, state update errors, and lifecycle method errors in its child component tree. It does not catch errors in event handlers (those must be handled with try/catch at the handler level), asynchronous errors (caught by TanStack Query or explicit catch blocks), or errors in the boundary component itself.

## Instructions

**Step 1: Build the ErrorBoundaryFallback Component**

Create src/components/ErrorBoundaryFallback.tsx as a functional component. This component accepts three props: error (Error object), resetErrorBoundary (a no-argument function that resets the boundary state), and errorId (string — a short identifier for support reference).

The fallback renders a full-width rounded-xl card with a linen (#EBE3DB) background and a 1px terracotta border. Inside the card, render a centered layout with the following elements in order:

A warning icon — a simple SVG triangle with an exclamation mark drawn in terracotta (#A48374), not imported from an icon library.

A heading in Playfair Display 20px espresso reading "Something went wrong".

A subtext paragraph in Inter 14px mist reading "An unexpected error occurred in this section. The error has been automatically reported."

A support reference line in Inter 12px mist reading "Reference: " followed by the errorId prop rendered in JetBrains Mono espresso. This reference code allows users to quote it when contacting support so developers can find the Sentry event.

A Retry button using the ShadCN Button component with variant="outline" and the terracotta border style. The button label is "Retry". On click, it calls the resetErrorBoundary prop function. Below the Retry button, add a secondary text button with variant="ghost" in muted mist text labelled "Reload page" that calls window.location.reload() when clicked.

Ensure the entire fallback card has a minimum height of 200px so it occupies a visually meaningful area within the page section it replaces.

**Step 2: Build the ErrorBoundary Class Component**

Create src/components/ErrorBoundary.tsx as a React class component. The component's state type has two fields: hasError (boolean) and error (Error or null). Implement getDerivedStateFromError as a static method: it receives the error argument and returns the partial state object { hasError: true, error }. This lifecycle replaces the component's state before the re-render that shows the fallback UI.

Implement componentDidCatch as an instance method receiving the error and an info object (React.ErrorInfo). Inside this method, call Sentry.captureException(error, { extra: { componentStack: info.componentStack } }) to forward the error to Sentry with full component stack context. Generate the errorId for this error snapshot by extracting the last 8 characters of a Date.now().toString(36) string — this produces a short alphanumeric reference code that correlates loosely with the Sentry event timestamp.

Implement the render method: if this.state.hasError is true, render ErrorBoundaryFallback with the error prop set to this.state.error, the resetErrorBoundary prop set to an arrow function that calls this.setState({ hasError: false, error: null }), and the errorId prop set to the generated error ID stored in component state. If hasError is false, render this.props.children directly.

The ErrorBoundary component should accept an optional fallback prop of type React.ReactNode that, if provided, renders the custom fallback instead of ErrorBoundaryFallback. This makes the component flexible enough to be used with section-specific fallbacks in the future.

**Step 3: Wrap the POS CartPanel**

In the POS terminal page, locate the CartPanel component rendering. Wrap it in an ErrorBoundary. If the CartPanel crashes (for example due to a malformed cart state in Zustand), the fallback renders inside the cart column with a Retry button that resets the boundary. After retry, users can attempt to interact with the cart again. Critically, the left-side product grid must not be affected by a CartPanel error, which is exactly what wrapping only the CartPanel achieves.

**Step 4: Wrap the Product Grid**

In the products page, locate the product list table or grid rendering. Wrap the table component in an ErrorBoundary. This ensures that a render error caused by malformed product data (for example, a decimal.js formatting failure on an unusual price value) shows the fallback card rather than crashing the entire products page including its header and navigation.

**Step 5: Wrap Each Report Chart**

In each report page — the revenue report, the inventory report, and the commission report — wrap each chart component (recharts or equivalent chart library render) in its own individual ErrorBoundary. Charts are the highest-risk render targets for runtime exceptions because they process large numeric datasets with complex aggregation logic. Wrapping each chart independently means a failure in one chart does not crash the adjacent charts or the data table on the same page.

**Step 6: Wrap Each Data Table**

Wrap every significant data table component in the application in an ErrorBoundary. This includes the sales history table, the customer table, the stock adjustment log table, the staff management table, and the expense table. Each table receives its own ErrorBoundary instance so their error states are isolated.

**Step 7: Export from Components Index**

Add exports for both ErrorBoundary and ErrorBoundaryFallback to src/components/index.ts (or create this barrel export file if it does not already exist). This enables convenient named imports from @/components throughout the application.

## Expected Output

- src/components/ErrorBoundary.tsx — React class component with getDerivedStateFromError, componentDidCatch, Sentry integration, and optional custom fallback prop
- src/components/ErrorBoundaryFallback.tsx — Styled fallback card with warning icon, support reference code, Retry button, and Reload button
- Updated POS terminal page — CartPanel wrapped in ErrorBoundary
- Updated products page — Product table wrapped in ErrorBoundary
- Updated report pages — Each chart component individually wrapped in ErrorBoundary
- All major data table components wrapped in ErrorBoundary instances

## Validation

- [ ] Deliberately throwing inside a child of ErrorBoundary in development triggers the fallback UI rather than a full page crash
- [ ] The Retry button resets the boundary state and re-renders the child component tree
- [ ] Sentry.captureException is called in componentDidCatch — visible in the Sentry Issues list after triggering the error
- [ ] The errorId support reference code is present in both the fallback UI and the corresponding Sentry event's extra context
- [ ] Crashing the CartPanel does not affect the POS product grid or navigation chrome
- [ ] Crashing one report chart does not crash adjacent charts on the same report page
- [ ] ErrorBoundaryFallback renders correctly in the VelvetPOS linen/espresso/terracotta design palette

## Notes

- React Error Boundaries only catch errors during rendering, in lifecycle methods, and in constructors of class components below them in the tree. They do not catch errors inside event handlers. For event handlers that could throw (for example a malformed Prisma response being processed client-side), use standard try/catch and display an error state via React Hook Form's setError or a toast notification.
- The errorId generated from Date.now().toString(36) is not a globally unique identifier and is not linked to Sentry by a foreign key. Its purpose is solely to give support staff a time-approximate reference they can use to search the Sentry timeline. For production-grade linkage, consider calling Sentry.lastEventId() inside componentDidCatch and passing that as the errorId instead.
