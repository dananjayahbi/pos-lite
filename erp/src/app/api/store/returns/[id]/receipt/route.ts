import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getReturnById } from '@/lib/services/return.service';
import { buildReturnReceiptHtml } from '@/lib/return-receipt-renderer';

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;"><h1>${title}</h1><p>${message}</p></body></html>`;
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return new Response(htmlPage('Unauthorized', 'Please log in to view this receipt.'), {
        status: 401,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const tenantId = session.user.tenantId;
    const { id } = await props.params;

    let returnRecord;
    try {
      returnRecord = await getReturnById(tenantId, id);
    } catch {
      return new Response(htmlPage('Not Found', 'The requested return was not found.'), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, settings: true },
    });

    if (!tenant) {
      return new Response(htmlPage('Error', 'Tenant not found.'), {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const cashierName = returnRecord.initiatedBy?.email ?? 'Unknown';
    const managerName = returnRecord.authorizedBy?.email ?? 'Unknown';
    const html = buildReturnReceiptHtml(returnRecord, tenant, cashierName, managerName);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      },
    });
  } catch (error) {
    console.error('GET /api/store/returns/[id]/receipt error:', error);
    return new Response(htmlPage('Error', 'An unexpected error occurred.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
