'use client';

import { Banknote, CreditCard, Tag, ArrowLeftRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatRupee } from '@/lib/format';
import type { ReturnRefundMethod } from '@/generated/prisma/client';
import type Decimal from 'decimal.js';

interface ReturnRefundOptionsStepProps {
  refundTotal: Decimal;
  refundMethod: ReturnRefundMethod;
  cardReversalReference: string;
  reason: string;
  onChange: (patch: Partial<{ refundMethod: ReturnRefundMethod; cardReversalReference: string; reason: string }>) => void;
}

const METHODS: {
  value: ReturnRefundMethod;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'CASH', label: 'Cash', description: 'Return money to the customer from the cash drawer immediately.', icon: Banknote },
  { value: 'CARD_REVERSAL', label: 'Card Reversal', description: 'Process a manual reversal on the card terminal and record the reference number.', icon: CreditCard },
  { value: 'STORE_CREDIT', label: 'Store Credit', description: 'Issue a credit note. The customer can redeem it on a future purchase.', icon: Tag },
  { value: 'EXCHANGE', label: 'Exchange Items', description: 'Return these items and apply the refund value toward new items immediately.', icon: ArrowLeftRight },
];

export function ReturnRefundOptionsStep({
  refundTotal,
  refundMethod,
  cardReversalReference,
  reason,
  onChange,
}: ReturnRefundOptionsStepProps) {
  return (
    <div className="space-y-5">
      {/* Refund total header - hidden during exchange */}
      {refundMethod !== 'EXCHANGE' ? (
        <div className="rounded-lg border border-sand bg-linen p-4 text-center">
          <p className="font-body text-xs text-mist uppercase tracking-wide mb-1">
            Refund Amount
          </p>
          <p className="font-mono text-2xl font-bold text-espresso">
            {formatRupee(refundTotal.toNumber())}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/5 p-4 text-center">
          <p className="font-body text-sm text-terracotta">
            The refund value of {formatRupee(refundTotal.toNumber())} will be applied as credit on the next cart.
          </p>
        </div>
      )}

      {/* Refund method selection */}
      <div className="space-y-2">
        {METHODS.map((method) => {
          const Icon = method.icon;
          const isSelected = refundMethod === method.value;

          return (
            <div key={method.value}>
              <button
                type="button"
                onClick={() => onChange({ refundMethod: method.value })}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
                  isSelected
                    ? 'border-terracotta bg-terracotta/5'
                    : 'border-mist/30 bg-white hover:bg-linen/50'
                }`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full mt-0.5 ${
                    isSelected ? 'bg-terracotta text-white' : 'bg-mist/20 text-mist'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className={`font-body text-sm font-medium ${isSelected ? 'text-espresso' : 'text-espresso/80'}`}>
                    {method.label}
                  </p>
                  <p className="font-body text-xs text-mist mt-0.5">
                    {method.description}
                  </p>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 mt-1 flex items-center justify-center ${
                    isSelected ? 'border-terracotta' : 'border-mist'
                  }`}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-terracotta" />}
                </div>
              </button>

              {/* Card reversal reference input */}
              {method.value === 'CARD_REVERSAL' && isSelected && (
                <div className="ml-11 mt-2 mb-1">
                  <Label htmlFor="card-ref" className="font-body text-xs text-espresso">
                    Reversal Reference Number
                  </Label>
                  <Input
                    id="card-ref"
                    value={cardReversalReference}
                    onChange={(e) => onChange({ cardReversalReference: e.target.value })}
                    maxLength={50}
                    placeholder="Enter card terminal reference"
                    className="mt-1 font-mono text-sm"
                  />
                </div>
              )}

              {/* Store credit note */}
              {method.value === 'STORE_CREDIT' && isSelected && (
                <p className="ml-11 mt-2 mb-1 font-body text-xs text-mist">
                  A store credit record will be created. The credit can be redeemed at checkout once Phase 04 CRM is complete.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Return reason */}
      <div className="space-y-1.5">
        <Label htmlFor="return-reason" className="font-body text-sm text-espresso">
          Return Reason
        </Label>
        <Textarea
          id="return-reason"
          value={reason}
          onChange={(e) => onChange({ reason: e.target.value.slice(0, 200) })}
          placeholder="Customer changed their mind — wrong size"
          maxLength={200}
          rows={3}
          className="font-body text-sm resize-none"
        />
        <p className="font-body text-[11px] text-mist text-right">
          {reason.length} / 200
        </p>
      </div>
    </div>
  );
}
