'use client';

import { useEffect, useState } from 'react';
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

interface WalkInCustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: (customer: { id: string; name: string; phone: string; creditBalance: string }) => void;
}

/**
 * Quick walk-in customer capture for the POS (doc 32).
 *
 * POS sales require a linked customer with a name and a mobile number. This
 * inline form captures just those two fields and creates/links the customer so
 * a cashier can finalize an anonymous walk-in without the full CRM flow.
 */
export function WalkInCustomerForm({ open, onOpenChange, onLinked }: WalkInCustomerFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setPhone('');
      setError('');
      setIsSubmitting(false);
    }
  }, [open]);

  const canSubmit = name.trim().length > 0 && phone.trim().length >= 7 && !isSubmitting;

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
        setError(json.error?.message ?? 'Failed to create walk-in customer');
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
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Walk-in Customer</DialogTitle>
          <DialogDescription className="font-body text-sm text-mist">
            A customer is required to finalize a sale. Enter their name and mobile
            to create a walk-in profile.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="walkin-name" className="font-body">
              Customer Name
            </Label>
            <Input
              id="walkin-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Walk-in Customer"
              className="mt-1.5"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="walkin-phone" className="font-body">
              Mobile Number
            </Label>
            <Input
              id="walkin-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0771234567"
              className="mt-1.5 font-mono"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="text-sm font-body text-[#9B2226]">{error}</p>
          )}

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
                Create &amp; Link Customer
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full text-center font-body text-sm text-mist hover:text-espresso transition-colors"
          >
            Cancel
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
