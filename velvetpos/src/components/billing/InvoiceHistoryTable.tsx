"use client";

import Decimal from "decimal.js";
import { FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InvoiceStatus = "PENDING" | "PAID" | "FAILED" | "VOIDED";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  amount: string;
  currency: string;
  status: InvoiceStatus;
}

interface InvoiceHistoryTableProps {
  invoices: InvoiceRow[];
}

const STATUS_BADGE: Record<InvoiceStatus, { label: string; className: string }> = {
  PAID: {
    label: "Paid",
    className: "bg-green-100 text-green-800 border-green-300",
  },
  PENDING: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  FAILED: {
    label: "Failed",
    className: "bg-red-100 text-red-800 border-red-300",
  },
  VOIDED: {
    label: "Voided",
    className: "border-mist text-mist-foreground",
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(raw: string, currency: string): string {
  const num = Number(new Decimal(raw).toFixed(2));
  return `${currency} ${num.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function InvoiceHistoryTable({
  invoices,
}: InvoiceHistoryTableProps) {
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-mist py-12 text-mist-foreground/50">
        <FileText className="mb-2 h-10 w-10" />
        <p className="text-sm">No invoices yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-mist/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-linen hover:bg-linen">
            <TableHead className="text-espresso">Invoice #</TableHead>
            <TableHead className="text-espresso">Billing Period</TableHead>
            <TableHead className="text-espresso text-right">Amount</TableHead>
            <TableHead className="text-espresso">Status</TableHead>
            <TableHead className="text-espresso text-center">
              Download
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv, idx) => {
            const badge = STATUS_BADGE[inv.status];
            return (
              <TableRow
                key={inv.id}
                className={idx % 2 === 0 ? "bg-pearl" : "bg-linen"}
              >
                <TableCell className="font-mono text-sm">
                  {inv.invoiceNumber}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(inv.billingPeriodStart)} –{" "}
                  {formatDate(inv.billingPeriodEnd)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatAmount(inv.amount, inv.currency)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={badge.className}>
                    {badge.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <a
                    href={`/api/invoices/${inv.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-espresso hover:text-terracotta"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
