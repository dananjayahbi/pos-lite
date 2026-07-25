'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  actorRole: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogDetailModalProps {
  entry: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatActionName(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

function displayValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function getAllKeys(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  const keys = new Set<string>();
  if (before) Object.keys(before).forEach((k) => keys.add(k));
  if (after) Object.keys(after).forEach((k) => keys.add(k));
  return Array.from(keys).sort();
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AuditLogDetailModal({ entry, open, onOpenChange }: AuditLogDetailModalProps) {
  if (!entry) return null;

  const hasBefore = entry.before !== null && Object.keys(entry.before).length > 0;
  const hasAfter = entry.after !== null && Object.keys(entry.after).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-espresso">
            {formatActionName(entry.action)}
          </DialogTitle>
          <p className="text-sm text-sand">{formatDate(entry.createdAt)}</p>
        </DialogHeader>

        {/* Summary */}
        <div className="space-y-1 text-sm">
          <div className="flex gap-2">
            <span className="text-sand">Entity Type:</span>
            <span className="text-espresso">{entry.entityType}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-sand">Entity ID:</span>
            <span className="font-mono text-espresso">{entry.entityId}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-sand">Performed By:</span>
            <span className="text-espresso">
              {entry.actorId ?? 'System'}
              {entry.actorRole && (
                <Badge variant="outline" className="ml-2 text-xs border-mist">
                  {entry.actorRole.replace('_', ' ')}
                </Badge>
              )}
            </span>
          </div>
          {entry.ipAddress && (
            <div className="flex gap-2">
              <span className="text-sand">IP:</span>
              <span className="font-mono text-espresso text-xs">{entry.ipAddress}</span>
            </div>
          )}
        </div>

        {/* Diff / Detail */}
        <div className="mt-4">
          {hasBefore && hasAfter ? (
            /* Before / After diff */
            <div className="rounded-lg border border-mist overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-linen/40">
                    <th className="px-3 py-2 text-left text-espresso font-medium">Field</th>
                    <th className="px-3 py-2 text-left text-terracotta font-medium">Before</th>
                    <th className="px-3 py-2 text-left text-espresso font-medium">After</th>
                  </tr>
                </thead>
                <tbody>
                  {getAllKeys(entry.before, entry.after).map((key) => {
                    const bVal = entry.before?.[key];
                    const aVal = entry.after?.[key];
                    const changed = displayValue(bVal) !== displayValue(aVal);
                    return (
                      <tr key={key} className="border-t border-mist/50">
                        <td className="px-3 py-1.5 font-mono text-xs text-espresso">{key}</td>
                        <td className={`px-3 py-1.5 text-xs ${changed ? 'bg-terracotta/10 text-terracotta' : 'text-sand'}`}>
                          {changed && <span className="mr-1">−</span>}
                          {displayValue(bVal)}
                        </td>
                        <td className={`px-3 py-1.5 text-xs ${changed ? 'bg-espresso/5 text-espresso' : 'text-sand'}`}>
                          {changed && <span className="mr-1">+</span>}
                          {displayValue(aVal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : hasAfter ? (
            /* Created With display */
            <div className="rounded-lg border border-mist overflow-hidden">
              <div className="bg-linen/40 px-3 py-2 text-sm font-medium text-espresso">
                Created With
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(entry.after!).map(([key, val]) => (
                    <tr key={key} className="border-t border-mist/50">
                      <td className="px-3 py-1.5 font-mono text-xs text-espresso">{key}</td>
                      <td className="px-3 py-1.5 text-xs text-espresso">{displayValue(val)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm italic text-sand">No detail data recorded.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
