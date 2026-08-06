import "server-only";

import { transExpressRequest } from "@/lib/courier/trans-express/client";
import type { CourierResult } from "@/lib/courier/types";
import type { CourierEnv } from "@/generated/prisma/client";

interface LoginResponse {
  token?: string;
  status?: string;
}

/**
 * Authenticate to the Trans Express API.
 * - Production prefers a long-lived API key (used directly as the bearer token).
 * - Staging (or accounts without an API key) logs in with email/password via
 *   POST /login/client and returns the issued token.
 */
export async function transExpressAuthenticate(
  account: { email?: string; password?: string; apiKey?: string; env: CourierEnv },
): Promise<CourierResult<string>> {
  // API key (production): used verbatim as the bearer token.
  if (account.apiKey) {
    return { ok: true, data: account.apiKey };
  }

  if (!account.email || !account.password) {
    return {
      ok: false,
      error: {
        category: "AUTH",
        message: "Trans Express account has no API key or credentials configured",
      },
    };
  }

  const result = await transExpressRequest<LoginResponse>(
    account.env,
    "/login/client",
    {
      method: "POST",
      body: { email: account.email, password: account.password },
      timeoutMs: 15_000,
    },
  );

  if (!result.ok) {
    return result;
  }

  const token = result.data?.token;
  if (!token) {
    return {
      ok: false,
      error: {
        category: "AUTH",
        message: "Trans Express login succeeded but returned no token",
      },
    };
  }

  return { ok: true, data: token };
}
