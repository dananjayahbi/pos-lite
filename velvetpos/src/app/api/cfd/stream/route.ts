import { cfdEmitter } from '@/lib/cfdEmitter';
import type { CFDCartPayload } from '@/lib/cfdEmitter';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get('tenantSlug');

  if (!tenantSlug) {
    return new Response(JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'tenantSlug is required' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const eventName = `cfd-update-${tenantSlug}`;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const listener = (payload: CFDCartPayload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // Stream closed — clean up happens in cancel
        }
      };

      // Send initial keepalive
      controller.enqueue(encoder.encode(': keepalive\n\n'));

      cfdEmitter.on(eventName, listener);

      // Keepalive every 20 seconds
      const keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepaliveInterval);
        }
      }, 20_000);

      // Store cleanup refs on the controller for cancel
      (controller as unknown as Record<string, unknown>)._cfdCleanup = () => {
        cfdEmitter.off(eventName, listener);
        clearInterval(keepaliveInterval);
      };
    },
    cancel(controller) {
      const cleanup = (controller as unknown as Record<string, () => void>)?._cfdCleanup;
      if (typeof cleanup === 'function') cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
