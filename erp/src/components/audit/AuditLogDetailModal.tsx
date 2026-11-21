'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { auditDetailMode } from '@/lib/audit/auditDetail.core';
import {
  formatAuditActionLabel,
  formatAuditDateTime,
  formatAuditRoleLabel,
} from '@/lib/audit/auditPresentation.core';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  actorName: string;
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

function displayValue(val: unknown): string {
  if (val === null || val === undefined) return '-';
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

  const mode = auditDetailMode(entry.before, entry.after);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-espresso">
            {formatAuditActionLabel(entry.action)}
          </DialogTitle>
          <p className="text-sm text-sand-ink">{formatAuditDateTime(entry.createdAt)}</p>
        </DialogHeader>

        {/* Summary */}
        <div className="space-y-1 text-sm">
          <div className="flex gap-2">
            <span className="text-sand-ink">Entity Type:</span>
            <span className="text-espresso">{entry.entityType}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-sand-ink">Entity ID:</span>
            <span className="font-mono text-espresso">{entry.entityId}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-sand-ink">User:</span>
            <span className="text-espresso">
              {entry.actorName}
              {entry.actorRole && (
                <Badge variant="outline" className="ml-2 text-xs border-mist">
                  {formatAuditRoleLabel(entry.actorRole)}
                </Badge>
              )}
            </span>
          </div>
          {entry.actorId && (
            <div className="flex gap-2">
              <span className="text-sand-ink">Actor ID:</span>
              <span className="select-all font-mono text-xs text-espresso">{entry.actorId}</span>
            </div>
          )}
          {entry.ipAddress && (
            <div className="flex gap-2">
              <span className="text-sand-ink">IP:</span>
              <span className="font-mono text-espresso text-xs">{entry.ipAddress}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-sand-ink">User agent:</span>
            <span className="break-all font-mono text-xs text-espresso">
              {entry.userAgent ?? '-'}
            </span>
          </div>
        </div>

        {/* Diff / Detail */}
        <div className="mt-4">
          {mode === 'diff' ? (
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
                        <td className={`px-3 py-1.5 text-xs ${changed ? 'bg-terracotta/10 text-terracotta' : 'text-sand-ink'}`}>
                          {changed && <span className="mr-1">−</span>}
                          {displayValue(bVal)}
                        </td>
                        <td className={`px-3 py-1.5 text-xs ${changed ? 'bg-espresso/5 text-espresso' : 'text-sand-ink'}`}>
                          {changed && <span className="mr-1">+</span>}
                          {displayValue(aVal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : mode === 'created' ? (
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
          ) : mode === 'deleted' ? (
            /* Deleted values */
            <div className="rounded-lg border border-mist overflow-hidden">
              <div className="bg-terracotta/10 px-3 py-2 text-sm font-medium text-terracotta">
                Deleted values
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(entry.before!).map(([key, val]) => (
                    <tr key={key} className="border-t border-mist/50">
                      <td className="px-3 py-1.5 font-mono text-xs text-espresso">{key}</td>
                      <td className="px-3 py-1.5 text-xs text-espresso">{displayValue(val)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm italic text-sand-ink">No detail data recorded.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
