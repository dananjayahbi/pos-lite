import { prisma } from '@/lib/prisma';
import { MAX_ATTEMPTS, computeNextRetryAt, statusAfterFailure } from '@/lib/webhooks/retry';

/**
 * M33-02 (OBS-62) — chain accounting for webhook retries.
 *
 * A retry attempt is recorded as its own `WebhookDelivery` row (so the ledger
 * shows one row per send, mirroring the manual route's verified semantics).
 * The **chain-head** row — the original inline delivery — is the single
 * scheduler: it owns `attempt` and `nextRetryAt`, and is the only row the cron
 * sweep selects on.
 *
 * That single-scheduler rule is what prevents duplicated events. If every retry
 * row carried its own `nextRetryAt`, a failed retry would itself become due and
 * both the head and the child would drive the same event; and if a manual retry
 * did not advance the head, a retry that already succeeded would still be swept
 * a minute later. Both callers therefore funnel through this one function.
 */
export interface RetryOutcome {
  attempt: number;
  exhausted: boolean;
  nextRetryAt: Date | null;
}

export async function recordRetryOutcome(
  chainHeadId: string,
  attempt: number,
  succeeded: boolean,
): Promise<RetryOutcome> {
  const status = statusAfterFailure(attempt);
  const exhausted = status === 'EXHAUSTED' || attempt >= MAX_ATTEMPTS;
  const nextRetryAt = succeeded || exhausted ? null : computeNextRetryAt(attempt);

  await prisma.webhookDelivery.update({
    where: { id: chainHeadId },
    data: {
      attempt,
      status: exhausted ? 'EXHAUSTED' : 'FAILED',
      nextRetryAt,
    },
  });

  return { attempt, exhausted, nextRetryAt };
}