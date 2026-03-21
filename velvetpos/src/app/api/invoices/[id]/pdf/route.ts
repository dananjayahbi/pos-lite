import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInvoiceHtml } from "@/lib/billing/invoice-template";

// ─── GET /api/invoices/[id]/pdf ─────────────────────────────────────────────
// Returns invoice as an HTML page with print-optimized CSS.
// Users can print to PDF from the browser (Ctrl+P / Cmd+P).
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, tenantId } = session.user;
  if (role !== "OWNER" && role !== "MANAGER" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      tenant: { include: { users: { where: { role: "OWNER" }, take: 1 } } },
      subscription: { include: { plan: true } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Tenant scoping — non-super-admins can only view their own tenant invoices
  if (role !== "SUPER_ADMIN" && invoice.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ownerEmail = invoice.tenant.users[0]?.email ?? "N/A";

  const html = generateInvoiceHtml({
    invoiceNumber: invoice.invoiceNumber,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
    billingPeriodStart: invoice.billingPeriodStart,
    billingPeriodEnd: invoice.billingPeriodEnd,
    amount: invoice.amount,
    currency: invoice.currency,
    status: invoice.status,
    paidAt: invoice.paidAt,
    tenant: { name: invoice.tenant.name },
    subscription: { plan: { name: invoice.subscription.plan.name } },
    ownerEmail,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.html"`,
    },
  });
}
