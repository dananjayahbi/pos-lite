import { NextResponse } from 'next/server';

import {
  requireDeliveryAuth,
  validationError,
  internalError,
  badRequest,
  conflict,
  mapDeliveryError,
} from '@/lib/api/delivery-route';
import { upstreamError } from '@/lib/api/error-envelope';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { transExpressAuthenticate } from '@/lib/courier/trans-express/auth';
import {
  CourierCredentialError,
  decryptCourierAccount,
  encryptCourierSecret,
  isCourierCredentialKeyConfigured,
  isEncryptedCourierSecret,
} from '@/lib/courier/credentials';
import {
  hasCourierTestCredentials,
  resolveCourierSettingsUpdate,
  resolveCourierTestCredentials,
  validateCourierActivation,
} from '@/lib/courier/settings.core';
import { CourierSettingsSchema, CourierTestSchema } from '@/lib/validators/courier.validators';
import type { CourierSettingsInput } from '@/lib/validators/courier.validators';

function redact(account: unknown): Record<string, unknown> {
  if (!account || typeof account !== 'object') return {};
  const { password, apiKey, ...rest } = account as Record<string, unknown>;
  return {
    ...rest,
    password: password ? '••••••••' : undefined,
    apiKey: apiKey ? '••••••••' : undefined,
  };
}

/** Read an optional JSON body; an empty body is treated as `{}`. */
async function readOptionalJson(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const raw = await request.text();
  if (raw.trim() === '') return { ok: true, body: {} };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, response: validationError(null, 'Invalid JSON body') };
  }
}

export async function GET() {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageCourierSettings);
  if (!guard.ok) return guard.response;

  const account = await prisma.courierAccount.findFirst({ where: { tenantId: guard.tenantId } });
  return NextResponse.json({ success: true, data: redact(account) });
}

export async function PUT(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageCourierSettings);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = CourierSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  try {
    const input = parsed.data as CourierSettingsInput;
    const existing = await prisma.courierAccount.findFirst({ where: { tenantId: guard.tenantId } });

    // ARGUS #513: explicit clear semantics + activation validation happen
    // server-side against the merged effective account.
    const { data, effective } = resolveCourierSettingsUpdate(input, existing);
    const activationIssues = validateCourierActivation(effective);
    if (activationIssues.length > 0) {
      return validationError(activationIssues, activationIssues[0]!.message);
    }

    // ARGUS #514: never persist a clear-text secret. Existing plaintext rows are
    // lazily re-encrypted on the next save when key material is available.
    if (typeof data.password === 'string') {
      data.password = encryptCourierSecret(data.password);
    } else if (
      existing?.password &&
      !isEncryptedCourierSecret(existing.password) &&
      isCourierCredentialKeyConfigured()
    ) {
      data.password = encryptCourierSecret(existing.password);
    }
    if (typeof data.apiKey === 'string') {
      data.apiKey = encryptCourierSecret(data.apiKey);
    } else if (
      existing?.apiKey &&
      !isEncryptedCourierSecret(existing.apiKey) &&
      isCourierCredentialKeyConfigured()
    ) {
      data.apiKey = encryptCourierSecret(existing.apiKey);
    }

    const account = existing
      ? await prisma.courierAccount.update({ where: { id: existing.id }, data })
      : await prisma.courierAccount.create({
          data: { tenantId: guard.tenantId, ...data } as never,
        });

    void createAuditLog({
      tenantId: guard.tenantId,
      actorId: guard.userId,
      actorRole: 'UNKNOWN',
      entityType: 'CourierAccount',
      entityId: account.id,
      action: AUDIT_ACTIONS.COURIER_SETTINGS_UPDATED,
    });

    return NextResponse.json({ success: true, data: redact(account) });
  } catch (error) {
    console.error('PUT /api/store/delivery/settings error:', error);
    if (error instanceof CourierCredentialError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CREDENTIALS_ENCRYPTION_UNAVAILABLE',
            message:
              'Courier credential encryption is not configured. Set COURIER_CREDENTIALS_KEY (or AUTH_SECRET) before saving credentials.',
          },
        },
        { status: 503 },
      );
    }
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/store/delivery/settings
 *
 * M24-01: lets an operator verify Trans Express credentials and tell an
 * auth/credential failure apart from an outage before dispatching.
 *
 * ARGUS #513: this is a DRY RUN. The optional JSON body carries the form's
 * current values; nothing is persisted, so a failed test cannot leave an
 * invalid or active account saved. Omitted secrets fall back to the saved
 * account (the UI never re-displays them).
 */
export async function POST(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageCourierSettings);
  if (!guard.ok) return guard.response;

  const bodyResult = await readOptionalJson(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = CourierTestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  const account = await prisma.courierAccount.findFirst({ where: { tenantId: guard.tenantId } });

  let credentials: ReturnType<typeof resolveCourierTestCredentials>;
  try {
    // ARGUS #514: stored secrets are ciphertext; only the outbound credential
    // object is decrypted. The request body's fresh secret stays as typed.
    credentials = resolveCourierTestCredentials(
      parsed.data,
      account ? decryptCourierAccount(account) : null,
    );
  } catch (error) {
    console.error('POST /api/store/delivery/settings credential decrypt error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'COURIER_CREDENTIALS_UNREADABLE',
          message: 'Saved courier credentials could not be decrypted. Re-enter them and save.',
        },
      },
      { status: 500 },
    );
  }

  if (!hasCourierTestCredentials(credentials)) {
    if (!account) {
      return conflict('Add an email or API key to your Trans Express account before testing the connection');
    }
    return badRequest('Add an email or API key to your Trans Express account before testing the connection');
  }

  const auth = await transExpressAuthenticate(credentials);
  if (!auth.ok) {
    return upstreamError('COURIER_AUTH_FAILED', auth.error.message);
  }

  return NextResponse.json({
    success: true,
    data: {
      ok: true,
      env: credentials.env,
      tokenType: credentials.apiKey ? 'API_KEY' : 'PASSWORD',
      persisted: false,
    },
  });
}
