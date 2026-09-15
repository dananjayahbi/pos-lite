import { describe, it, expect } from 'vitest';

import { ok, envelopeError, toErrorResponse } from '@/lib/api/error-envelope';
import { ApiError } from '@/lib/api/errors';

async function bodyOf(res: { json(): unknown }) {
  // NextResponse in node test env: read via the underlying Response.
  return (await (res as unknown as Response).json()) as Record<string, unknown>;
}

describe('XC-02 canonical envelope', () => {
  it('success: { success:true, data } and optional meta', async () => {
    const a = await bodyOf(ok([1, 2, 3]));
    expect(a).toEqual({ success: true, data: [1, 2, 3] });

    const b = await bodyOf(ok([1], { meta: { page: 1, limit: 20, total: 1, hasMore: false } }));
    expect(b).toEqual({
      success: true,
      data: [1],
      meta: { page: 1, limit: 20, total: 1, hasMore: false },
    });
  });

  it('error: { success:false, error:{ code, message, details? } }', async () => {
    const e = await bodyOf(envelopeError(ApiError.conflict('dup')));
    expect(e).toEqual({ success: false, error: { code: 'CONFLICT', message: 'dup' } });

    const d = await bodyOf(envelopeError(ApiError.validation('bad', [{ path: 'x' }])));
    expect(d).toEqual({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'bad', details: [{ path: 'x' }] },
    });
  });

  it('toErrorResponse: ApiError passthrough; unknown → 500 without internals', async () => {
    const thrown = new Error(
      'Unique constraint failed on the fields: (`tenantId`,`name`) — prisma at /home/dev/.next/server/app/api/store/products/route.ts:183',
    );
    Object.assign(thrown, { name: 'SomeOtherError' });
    const res = toErrorResponse(thrown, 'test');
    expect(res.status).toBe(500);
    const body = await bodyOf(res);
    const err = (body as { error: { message: string } }).error;
    expect(err.message).toBe('An unexpected error occurred');
    expect(JSON.stringify(body)).not.toMatch(/prisma|\.next|home\/dev/i);
  });
});
