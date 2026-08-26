'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Dispute actions for a reconciled ledger entry. Opens a dispute (with reason +
 * amount) on eligible rows, or moves an open dispute through resolution
 * (UNDER_REVIEW / ACCEPTED / REJECTED / CLOSED). Kept modular so it can be
 * reused from the ledger table and any open-dispute listing.
 */
export function DisputeActions({
  entryId,
  disputeId,
  disputeStatus,
  expectedCod,
  onOpen,
  onUpdate,
}: {
  entryId: string;
  disputeId?: string | null;
  disputeStatus?: string | null;
  expectedCod: number | string;
  onOpen: (input: { ledgerEntryId: string; reason: string; disputedAmount: number }) => void;
  onUpdate: (input: { disputeId: string; status: string; resolutionNote?: string }) => void;
}) {
  const [openForm, setOpenForm] = useState(false);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState(String(Number(expectedCod) || 0));

  if (!disputeId) {
    if (!openForm) {
      return (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpenForm(true)}>
          Dispute
        </Button>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Dispute reason"
          className="w-44 rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          placeholder="Amount"
          className="w-44 rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() =>
              onOpen({ ledgerEntryId: entryId, reason, disputedAmount: Number(amount) || 0 })
            }
          >
            Submit
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpenForm(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Open dispute — allow advancing through resolution.
  const terminal = ['ACCEPTED', 'REJECTED', 'CLOSED'].includes(disputeStatus ?? '');
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" size="sm" disabled={terminal}>
        {disputeStatus ?? 'Open'}
      </Button>
      {!terminal && (
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onUpdate({ disputeId, status: 'UNDER_REVIEW' })}
          >
            Review
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onUpdate({ disputeId, status: 'ACCEPTED' })}
          >
            Accept
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onUpdate({ disputeId, status: 'REJECTED' })}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
