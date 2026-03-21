import * as Sentry from "@sentry/nextjs";

export function setSentryTenantContext({
  tenantId,
  tenantSlug,
  userId,
  userEmail,
}: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
}) {
  Sentry.setContext("tenant", { tenantId, tenantSlug });
  Sentry.setUser({ id: userId, email: userEmail });
}

export function clearSentryContext() {
  Sentry.setUser(null);
  Sentry.setContext("tenant", null);
}
