"use client";

import Decimal from "decimal.js";
import { AlertTriangle, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GRACE_PERIOD_DAYS } from "@/lib/billing/constants";

type Status = "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";

interface SubscriptionOverviewCardProps {
  planName: string;
  status: Status;
  monthlyAmount: string;
  currency: string;
  currentPeriodEnd: string;
  trialEndsAt: string | undefined;
}

const STATUS_BADGE: Record<
  Status,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Active",
    className: "bg-green-100 text-green-800 border-green-300",
  },
  TRIAL: {
    label: "Trial",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  PAST_DUE: {
    label: "Past Due",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  SUSPENDED: {
    label: "Suspended",
    className: "bg-red-100 text-red-800 border-red-300",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "border-mist text-mist-foreground",
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatAmount(raw: string): string {
  const num = Number(new Decimal(raw).toFixed(2));
  return num.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SubscriptionOverviewCard({
  planName,
  status,
  monthlyAmount,
  currency,
  currentPeriodEnd,
  trialEndsAt,
}: SubscriptionOverviewCardProps) {
  const badge = STATUS_BADGE[status];
  const periodEnd = new Date(currentPeriodEnd);

  const graceDaysRemaining =
    status === "PAST_DUE"
      ? Math.max(
          0,
          GRACE_PERIOD_DAYS -
            Math.ceil(
              (Date.now() - periodEnd.getTime()) / (1000 * 60 * 60 * 24),
            ),
        )
      : 0;

  return (
    <Card className="border-t-[3px] border-t-espresso bg-pearl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-espresso">{planName}</CardTitle>
          <Badge variant="outline" className={badge.className}>
            {badge.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="font-mono text-xl text-espresso">
          {currency} {formatAmount(monthlyAmount)} / month
        </p>

        {status === "TRIAL" && trialEndsAt && (
          <p className="text-sm text-mist-foreground/70">
            Trial ends on{" "}
            <span className="font-medium">{formatDate(trialEndsAt)}</span>
          </p>
        )}

        {(status === "ACTIVE" || status === "PAST_DUE") && (
          <p className="text-sm text-mist-foreground/70">
            Next billing date:{" "}
            <span className="font-medium">
              {formatDate(currentPeriodEnd)}
            </span>
          </p>
        )}

        {status === "PAST_DUE" && (
          <div className="flex items-start gap-2 rounded-md border border-terracotta/30 bg-terracotta/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" />
            <p className="text-sm text-terracotta">
              Payment overdue — {graceDaysRemaining} grace day
              {graceDaysRemaining !== 1 ? "s" : ""} remaining before
              suspension.
            </p>
          </div>
        )}

        {status === "SUSPENDED" && (
          <div className="flex items-start gap-2 rounded-md border border-espresso/20 bg-espresso/5 p-3">
            <Ban className="mt-0.5 h-4 w-4 shrink-0 text-espresso" />
            <p className="text-sm text-espresso">
              Your access is suspended. Renew to restore access.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
