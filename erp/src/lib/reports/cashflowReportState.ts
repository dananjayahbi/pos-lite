/**
 * Client state for the Cash Flow report (ARGUS #421).
 *
 * Before this helper the page rendered its heading and date inputs but no
 * feedback when the request was forbidden, aborted or failed: the report area
 * simply disappeared. One pure state machine now decides which of the idle,
 * loading, error, empty and ready surfaces is visible, and never shows a
 * partial report after an error.
 */

export type CashFlowReportMode =
  | 'permission-loading'
  | 'denied'
  | 'idle'
  | 'loading'
  | 'error'
  | 'empty'
  | 'ready';

export interface CashFlowReportErrorLike {
  status?: number;
  message?: string;
}

export interface CashFlowReportStateInput {
  canView: boolean;
  isPermissionLoading: boolean;
  hasGenerated: boolean;
  isLoading: boolean;
  error: CashFlowReportErrorLike | null;
  hasActivity: boolean;
}

export interface CashFlowReportState {
  mode: CashFlowReportMode;
  /** The report body may render only in this state. */
  showReport: boolean;
  showEmpty: boolean;
  canGenerate: boolean;
  canRetry: boolean;
  message: string | null;
}

const DEFAULT_ERROR = 'Could not generate the cash flow report.';

/**
 * Resolve the visible surface from session permission and query state. Server
 * authorization is still enforced by the API; this gate exists so a denied or
 * failed request produces a clear message instead of an empty page.
 */
export function resolveCashFlowReportState(
  input: CashFlowReportStateInput,
): CashFlowReportState {
  if (input.isPermissionLoading) {
    return {
      mode: 'permission-loading',
      showReport: false,
      showEmpty: false,
      canGenerate: false,
      canRetry: false,
      message: null,
    };
  }

  if (!input.canView) {
    return {
      mode: 'denied',
      showReport: false,
      showEmpty: false,
      canGenerate: false,
      canRetry: false,
      message:
        'You do not have permission to view the cash flow report. Contact your administrator if you need access.',
    };
  }

  if (!input.hasGenerated) {
    return {
      mode: 'idle',
      showReport: false,
      showEmpty: false,
      canGenerate: true,
      canRetry: false,
      message: null,
    };
  }

  if (input.isLoading) {
    return {
      mode: 'loading',
      showReport: false,
      showEmpty: false,
      canGenerate: false,
      canRetry: false,
      message: null,
    };
  }

  if (input.error) {
    const forbidden = input.error.status === 403 || input.error.status === 401;
    return {
      mode: forbidden ? 'denied' : 'error',
      showReport: false,
      showEmpty: false,
      canGenerate: true,
      canRetry: forbidden ? false : true,
      message:
        input.error.message ??
        (forbidden
          ? 'You do not have permission to view the cash flow report.'
          : DEFAULT_ERROR),
    };
  }

  if (!input.hasActivity) {
    return {
      mode: 'empty',
      showReport: false,
      showEmpty: true,
      canGenerate: true,
      canRetry: false,
      message: null,
    };
  }

  return {
    mode: 'ready',
    showReport: true,
    showEmpty: false,
    canGenerate: true,
    canRetry: false,
    message: null,
  };
}
