'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { labelTemplateProvenance } from './labelTemplateState';
import { labelSenderChanges, toLabelSenderSnapshot } from '@/lib/delivery/labelAudit.core';
import { formatShortDateTime } from '@/lib/format';
import { staffDisplayName } from '@/lib/utils/staff-name';
import type {
  DeliveryLabelTemplate,
  LabelTemplateHistoryEntry,
  LabelTemplateMeta,
} from '@/types/delivery-label';

interface LabelTemplateFormProps {
  template: DeliveryLabelTemplate;
  meta?: LabelTemplateMeta | null;
  /** Recent audit rows, newest first (ARGUS #306). */
  history?: LabelTemplateHistoryEntry[];
  /** True when a saved override exists that a reset would discard. */
  canReset?: boolean;
  isResetting?: boolean;
  onReset?: () => void;
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
 *
 * ARGUS #305 - with no editable sender there is no unsaved edit to lose, but a
 * reset must still be explicit: it now asks for confirmation and the panel
 * shows who last saved/reset the template and when.
 */
export function LabelTemplateForm({
  template,
  meta,
  history = [],
  canReset = false,
  isResetting = false,
  onReset,
}: LabelTemplateFormProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);

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

          <p className="text-xs text-sand-ink" data-testid="label-template-provenance">
            {labelTemplateProvenance(meta)}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/settings/store" className="text-sm underline hover:text-terracotta">
              Edit Store Profile
            </Link>
            {canReset && onReset && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-mist"
                onClick={() => setConfirmingReset(true)}
                disabled={isResetting}
                aria-busy={isResetting}
              >
                {isResetting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {isResetting ? 'Resetting…' : 'Reset to default'}
              </Button>
            )}
          </div>

          {confirmingReset && onReset && (
            <div
              role="alertdialog"
              aria-label="Confirm template reset"
              className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              <p className="font-medium">Reset the saved waybill template?</p>
              <p className="text-xs">
                This discards the saved template override. Sender details still come from the
                Store Profile, so the printed label keeps the business name and contact.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmingReset(false)}
                  disabled={isResetting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setConfirmingReset(false);
                    onReset();
                  }}
                  disabled={isResetting}
                  data-testid="label-template-reset-confirm"
                >
                  Yes, reset
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Recent changes</CardTitle>
          <CardDescription>
            Sender values recorded by each save or reset, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-espresso/50">
              No waybill template changes have been recorded yet.
            </p>
          ) : (
            <ol className="space-y-3">
              {history.map((entry) => {
                const before = toLabelSenderSnapshot(entry.before);
                const changes = labelSenderChanges(before, toLabelSenderSnapshot(entry.after));
                const isReset = before !== null && entry.after === null;
                return (
                  <li
                    key={entry.id}
                    className="rounded-md border border-mist/60 bg-linen/30 px-3 py-2"
                  >
                    <p className="text-sm text-espresso">
                      {isReset ? 'Reset to defaults' : 'Saved'} ·{' '}
                      {formatShortDateTime(entry.createdAt)}
                    </p>
                    <p className="text-xs text-sand-ink">
                      {entry.actorEmail ? staffDisplayName(entry.actorEmail) : 'Unknown user'}
                      {entry.actorRole && entry.actorRole !== 'UNKNOWN'
                        ? ` · ${entry.actorRole.replace(/_/g, ' ').toLowerCase()}`
                        : ''}
                    </p>
                    {changes.length === 0 ? (
                      <p className="mt-1 text-xs text-sand-ink">
                        {isReset ? 'Saved override removed.' : 'No sender value changed.'}
                      </p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-xs text-espresso/70">
                        {changes.map((change) => (
                          <li key={change.field}>
                            {change.field}: {change.from || '(blank)'} →{' '}
                            {change.to || '(cleared)'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
