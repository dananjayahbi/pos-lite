'use client';

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  type LucideIcon,
} from 'lucide-react';
import type { PaymentTone } from '@/lib/paymentPresentation';

/**
 * Banner for a payment outcome on the checkout return / confirmation screens.
 * Purely presentational — the wording and tone come from
 * `presentPaymentStatus` so every surface renders the same verdict the same way.
 */

const TONE_STYLES: Record<
  PaymentTone,
  { icon: LucideIcon; border: string; bg: string; text: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    border: 'border-[#97c93e]/40',
    bg: 'bg-[#97c93e]/10',
    text: 'text-[#dcf3a8]',
    iconColor: 'text-[#97c93e]',
  },
  pending: {
    icon: Clock,
    border: 'border-amber-400/35',
    bg: 'bg-amber-400/10',
    text: 'text-amber-100',
    iconColor: 'text-amber-300',
  },
  failure: {
    icon: AlertCircle,
    border: 'border-red-400/40',
    bg: 'bg-red-400/10',
    text: 'text-red-100',
    iconColor: 'text-red-300',
  },
  neutral: {
    icon: Info,
    border: 'border-white/12',
    bg: 'bg-white/5',
    text: 'text-[#cbd5e1]',
    iconColor: 'text-[#94a3b8]',
  },
};

interface PaymentReturnBannerProps {
  tone: PaymentTone;
  title: string;
  description: string;
  /** Optional supporting line, e.g. a card method or order total. */
  meta?: string | undefined;
}

export function PaymentReturnBanner({
  tone,
  title,
  description,
  meta,
}: PaymentReturnBannerProps) {
  const style = TONE_STYLES[tone];
  const Icon = style.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-2xl border p-4 ${style.border} ${style.bg}`}
    >
      <Icon size={22} className={`mt-0.5 shrink-0 ${style.iconColor}`} aria-hidden />
      <div className="min-w-0">
        <p className={`text-base font-medium ${style.text}`}>{title}</p>
        <p className="mt-1 text-sm text-[#cbd5e1]">{description}</p>
        {meta ? <p className="mt-2 text-xs text-[#94a3b8]">{meta}</p> : null}
      </div>
    </div>
  );
}
