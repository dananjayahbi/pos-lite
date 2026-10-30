'use client';

import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Field limits mirror the server contracts so the UI cannot submit something
 * the API will reject: `WalkInSchema.name` is unbounded-trimmed but the shared
 * `CreateCustomerSchema` caps names at 100, and `zSriLankaPhone` caps the raw
 * input at 20 characters (+94XXXXXXXXX is 12).
 */
const NAME_MAX_LENGTH = 100;
const PHONE_MAX_LENGTH = 20;

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: (customer: { id: string; name: string; phone: string; creditBalance: string }) => void;
}

interface AddCustomerFormProps {
  onCancel: () => void;
  onLinked: (customer: { id: string; name: string; phone: string; creditBalance: string }) => void;
}

/**
 * Quick customer capture for the POS (doc 32).
 *
 * A created-and-linked customer is optional: the cart can also complete the
 * sale in pure guest mode (see `CartPanel`'s "Continue as guest" action). When
 * the cashier does want to attribute the sale, this inline form captures just
 * a name and a mobile number instead of the full CRM flow.
 */
export function AddCustomerDialog({ open, onOpenChange, onLinked }: AddCustomerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {/* Keying on `open` remounts the form on every open, so its state is
            fresh without a state-resetting effect. */}
        {open && <AddCustomerForm onCancel={() => onOpenChange(false)} onLinked={onLinked} />}
      </DialogContent>
    </Dialog>
  );
}

function AddCustomerForm({ onCancel, onLinked }: AddCustomerFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // M14-03 (req 2.2): mirror the server `zSriLankaPhone` contract client-side —
  // strip separators, then require +94XXXXXXXXX or 0XXXXXXXXX. Blocks submit on
  // a malformed number and shows an inline hint (the API still re-validates).
  const normalizedPhone = phone.trim().replace(/[\s\-().]/g, '');
  const phoneValid = /^(\+94\d{9}|0\d{9})$/.test(normalizedPhone);
  const canSubmit = name.trim().length > 0 && phoneValid && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/store/sales/walkin-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { id: string; name: string; phone: string; creditBalance: string };
        error?: { code: string; message: string };
      };
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? 'Failed to add customer');
        setIsSubmitting(false);
        return;
      }
      toast.success(`Customer added — ${json.data!.name}`);
      onLinked(json.data!);
    } catch {
      setError('Network error — please try again');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">Add Customer</DialogTitle>
        <DialogDescription className="font-body text-sm text-mist">
          Enter a name and mobile number to save this customer and link them to
          the current sale.
        </DialogDescription>
      </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="add-customer-name" className="font-body">
              Customer Name
            </Label>
            <Input
              id="add-customer-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nimal Perera"
              maxLength={NAME_MAX_LENGTH}
              className="mt-1.5"
              disabled={isSubmitting}
              autoFocus
            />
            <p className="mt-1 text-right font-body text-[11px] text-mist">
              {name.length}/{NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <Label htmlFor="add-customer-phone" className="font-body">
              Mobile Number
            </Label>
            <Input
              id="add-customer-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0771234567"
              maxLength={PHONE_MAX_LENGTH}
              className="mt-1.5 font-mono"
              disabled={isSubmitting}
            />
            {phone.trim().length > 0 && !phoneValid ? (
              <p className="mt-1 font-body text-xs text-[#9B2226]">
                Use +94XXXXXXXXX or 0XXXXXXXXX
              </p>
            ) : (
              <p className="mt-1 text-right font-body text-[11px] text-mist">
                {phone.length}/{PHONE_MAX_LENGTH}
              </p>
            )}
          </div>

          {error && <p className="text-sm font-body text-[#9B2226]">{error}</p>}

          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-auto w-full py-3 bg-espresso text-pearl font-body text-base font-bold hover:bg-espresso/90"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                Add &amp; Link Customer
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full text-center font-body text-sm text-mist hover:text-espresso transition-colors"
          >
            Cancel
          </button>
        </form>
    </>
  );
}
