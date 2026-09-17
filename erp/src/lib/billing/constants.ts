export const GRACE_PERIOD_DAYS = 7;

/**
 * Default trial length for a newly provisioned tenant subscription.
 *
 * This is the value `createTrialSubscription` has always applied inline; it is
 * named here so the seed (M30-01 block `1d`) and the service cannot drift
 * apart, and so the trial policy is stated in one place. See
 * `src/lib/billing/provisioning.ts` for the full trial-policy assumption
 * (the client's D-level policy answer is still outstanding).
 */
export const TRIAL_PERIOD_DAYS = 30;
