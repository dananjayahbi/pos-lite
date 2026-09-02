'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { copyTextToClipboard } from '@/lib/clipboard';

interface CopyableTextProps {
  /** The text to copy to the clipboard. */
  value: string;
  /** What the value represents, e.g. "Sale ID" — used for aria/title + toast. */
  label?: string;
  /** Additional class names for the wrapper (text styling lives on children). */
  className?: string;
}

/**
 * Renders text with an adjacent copy button. Shows a transient checkmark and
 * toast when copied.
 */
export function CopyableText({
  value,
  label = 'value',
  className,
}: CopyableTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(value);
    if (!ok) {
      toast.error(`Could not copy ${label.toLowerCase()}`);
      return;
    }
    setCopied(true);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <span className="break-all font-mono">{value}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 p-0.5 text-mist hover:text-espresso transition-colors"
        aria-label={`Copy ${label.toLowerCase()}`}
        title={`Copy ${label.toLowerCase()}`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-[#2D6A4F]" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
