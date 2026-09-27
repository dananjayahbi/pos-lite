'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getOrderPayment,
  type PublicOrderPayment,
} from '@/lib/api/orderPayment';
import { isPaymentSettled } from '@/lib/paymentPresentation';

/**
 * Polls the ERP for an order's payment status.
 *
 * PayHere's `return_url` contains no payment status, and its server-to-server
 * `notify_url` callback may arrive a beat after the browser gets back — so the
 * confirmation page polls until the status settles, then stops. Bounded: it
 * gives up after `maxAttempts` and reports "still confirming" rather than
 * hammering the ERP forever.
 *
 * The wait is an awaited in-loop delay rather than a self-scheduling
 * `setTimeout`, so a slow response can never stack overlapping requests and no
 * callback has to reference itself. Cancellation is a per-run signal object
 * checked after every await, so an in-flight poll cannot write state into an
 * unmounted component.
 */

interface UseOrderPaymentPollingOptions {
  tenantSlug: string;
  orderRef: string;
  /** Delay between polls, ms. */
  intervalMs?: number;
  /** Give up after this many polls. */
  maxAttempts?: number;
  /** Disable polling entirely (e.g. a COD order needs no confirmation). */
  enabled?: boolean;
}

export interface OrderPaymentPollingState {
  payment: PublicOrderPayment | null;
  /** True while a fetch is in flight and no result has arrived yet. */
  loading: boolean;
  /** True when the status is final, or polling has stopped. */
  settled: boolean;
  /** True when the status never settled within `maxAttempts`. */
  timedOut: boolean;
  /** True when the ERP could not be reached at all. */
  unreachable: boolean;
  refetch: () => void;
}

interface RunSignal {
  cancelled: boolean;
}

/** Awaitable pause that needs no timer bookkeeping to cancel. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function useOrderPaymentPolling({
  tenantSlug,
  orderRef,
  intervalMs = 3000,
  maxAttempts = 10,
  enabled = true,
}: UseOrderPaymentPollingOptions): OrderPaymentPollingState {
  const [payment, setPayment] = useState<PublicOrderPayment | null>(null);
  // When polling is disabled there is nothing to wait for, so start settled —
  // deriving this avoids a synchronous setState inside the effect below.
  const [loading, setLoading] = useState(enabled);
  const [settled, setSettled] = useState(!enabled);
  const [timedOut, setTimedOut] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  /** Bumped by `refetch` to restart the loop even if one is already running. */
  const [generation, setGeneration] = useState(0);
  const activeRunRef = useRef<RunSignal | null>(null);

  const poll = useCallback(
    async (signal: RunSignal) => {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const result = await getOrderPayment(tenantSlug, orderRef);
        if (signal.cancelled) return;

        if (result) {
          setPayment(result);
          setUnreachable(false);
          if (isPaymentSettled(result.paymentStatus)) {
            setSettled(true);
            setLoading(false);
            return;
          }
        }

        if (attempt >= maxAttempts) {
          // One failed fetch is not fatal (the IPN may still be landing); only
          // report "unreachable" once we have given up entirely.
          setUnreachable(result === null);
          setTimedOut(true);
          setSettled(true);
          setLoading(false);
          return;
        }

        setLoading(false);
        await delay(intervalMs);
        if (signal.cancelled) return;
      }
    },
    [tenantSlug, orderRef, intervalMs, maxAttempts],
  );

  useEffect(() => {
    if (!enabled) return;

    const signal: RunSignal = { cancelled: false };
    activeRunRef.current = signal;
    // Dispatch the first poll out of the commit phase. Sending it synchronously
    // here would write state during the effect body (a cascading render); the
    // initial `loading: true` already renders the spinner for that first frame.
    const kickoff = setTimeout(() => {
      void poll(signal);
    }, 0);

    return () => {
      clearTimeout(kickoff);
      signal.cancelled = true;
      if (activeRunRef.current === signal) activeRunRef.current = null;
    };
  }, [enabled, poll, generation]);

  /** Restart polling from scratch (e.g. a user-initiated "check again"). */
  const refetch = useCallback(() => {
    if (activeRunRef.current) activeRunRef.current.cancelled = true;
    setTimedOut(false);
    setSettled(false);
    setUnreachable(false);
    setLoading(true);
    setGeneration((n) => n + 1);
  }, []);

  return { payment, loading, settled, timedOut, unreachable, refetch };
}
