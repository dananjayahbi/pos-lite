'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DialogSubmitRowProps {
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  disabled: boolean;
  onCancel: () => void;
  variant?: 'primary' | 'danger';
}

/** Shared footer so every payment-account dialog's primary action behaves alike. */
export function DialogSubmitRow({
  submitLabel,
  pendingLabel,
  isPending,
  disabled,
  onCancel,
  variant = 'primary',
}: DialogSubmitRowProps) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Button
        type="submit"
        disabled={disabled || isPending}
        className={
          variant === 'danger'
            ? 'bg-[#9B2226] font-body text-pearl hover:bg-[#9B2226]/90'
            : 'bg-espresso font-body text-pearl hover:bg-espresso/90'
        }
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {pendingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        disabled={isPending}
        className="font-body text-sand hover:text-espresso"
      >
        Cancel
      </Button>
    </div>
  );
}
