'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { DeliveryLabelTemplate } from '@/types/delivery-label';

interface LabelTemplateFormProps {
  template: DeliveryLabelTemplate;
}

function SenderValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-espresso">{label}</p>
      <p className={value ? 'text-sm text-espresso/70' : 'text-sm text-red-600'}>
        {value || 'Not configured'}
      </p>
    </div>
  );
}

/**
 * ARGUS #301 - the sender is the audited Store Profile. The old editable
 * brand/contact fields could print a stale business name, so this panel is now
 * read-only and points staff at the single source of truth.
 */
export function LabelTemplateForm({ template }: LabelTemplateFormProps) {
  return (
    <div className="space-y-6">
      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Sender details</CardTitle>
          <CardDescription>
            Printed in the Proof of Delivery block. These values come from the Store Profile so
            the waybill always shows the audited business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SenderValue label="Sender name (From)" value={template.brandName} />
          <SenderValue label="Sender contact" value={template.fromContact} />
          <SenderValue label="Pickup address" value={template.pickupAddress ?? ''} />

          <p className="rounded-md border border-mist/60 bg-linen/40 px-3 py-2 text-xs text-sand-ink">
            {template.brandName && template.fromContact
              ? 'The pickup address prints only when it is set in the Store Profile.'
              : 'The waybill cannot print until the Store Profile has a business name and phone number.'}
          </p>

          <Link href="/settings/store" className="inline-block text-sm underline hover:text-terracotta">
            Edit Store Profile
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
