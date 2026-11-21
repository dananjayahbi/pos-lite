'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { stockTakeIdReference, stockTakeIdValue } from '@/lib/stock/stock-take-id';

interface StockTakeIdProps {
  id: string;
  /** Optional visible prefix length; the full id remains in `title`/copy. */
  className?: string;
}

/**
 * ARGUS #191 - full, copyable session identifier.
 *
 * The cell shows a compact reference (both ends) but exposes the complete cuid
 * in the tooltip and copies it verbatim, so an operator can hand the exact id
 * to support without retyping a truncated fragment.
 */
export function StockTakeId({ id, className }: StockTakeIdProps) {
  const full = stockTakeIdValue(id);
  const reference = stockTakeIdReference(full);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      toast.success('Session ID copied');
    } catch {
      toast.error('Could not copy the session ID');
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <span className="font-mono text-xs text-espresso" title={full}>
        {reference}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-mist-ink hover:text-espresso"
        aria-label={`Copy session ID ${full}`}
        title={`Copy full ID: ${full}`}
        onClick={handleCopy}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </span>
  );
}
