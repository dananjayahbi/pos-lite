'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Send, Info } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface BroadcastComposerProps {
  message: string;
  onMessageChange: (message: string) => void;
  recipientCount: number | null;
  isSending: boolean;
  onSend: () => void;
}

const MAX_CHARS = 500;
const WARN_THRESHOLD = 480;

// ── Component ────────────────────────────────────────────────────────────────

export function BroadcastComposer({
  message,
  onMessageChange,
  recipientCount,
  isSending,
  onSend,
}: BroadcastComposerProps) {
  const [showVariableGuide, setShowVariableGuide] = useState(false);
  const charCount = message.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isNearLimit = charCount > WARN_THRESHOLD;
  const isSendDisabled =
    !message.trim() || isOverLimit || recipientCount === 0 || recipientCount === null || isSending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="broadcast-message" className="text-sm font-semibold text-espresso uppercase tracking-wide">
          Compose Message
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setShowVariableGuide(!showVariableGuide)}
                className="text-sand hover:text-espresso transition-colors"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-xs">
                Use <code className="font-mono bg-linen px-1 rounded">{'{{name}}'}</code> for
                customer&apos;s first name and{' '}
                <code className="font-mono bg-linen px-1 rounded">{'{{storeName}}'}</code> for
                your store name.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {showVariableGuide && (
        <div className="rounded-lg border border-mist bg-linen p-3 text-xs text-espresso space-y-1">
          <p className="font-semibold">Template Variables:</p>
          <p>
            <code className="font-mono bg-pearl px-1 rounded">{'{{name}}'}</code> — Customer&apos;s
            first name
          </p>
          <p>
            <code className="font-mono bg-pearl px-1 rounded">{'{{storeName}}'}</code> — Your store
            name
          </p>
        </div>
      )}

      <Textarea
        id="broadcast-message"
        placeholder="Hi {{name}}! Check out our latest arrivals at {{storeName}}..."
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        maxLength={MAX_CHARS + 50}
        rows={6}
        className="resize-none font-mono text-sm border-mist"
      />

      <div className="flex items-center justify-between">
        <p
          className={`text-xs font-mono ${
            isOverLimit
              ? 'text-red-600 font-bold'
              : isNearLimit
                ? 'text-red-500'
                : 'text-sand'
          }`}
        >
          {charCount}/{MAX_CHARS}
        </p>
      </div>

      <Button
        onClick={onSend}
        disabled={isSendDisabled}
        className="w-full bg-terracotta hover:bg-terracotta/90 text-pearl font-semibold"
      >
        {isSending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-pearl border-t-transparent" />
            Sending…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send Broadcast
          </span>
        )}
      </Button>
    </div>
  );
}
