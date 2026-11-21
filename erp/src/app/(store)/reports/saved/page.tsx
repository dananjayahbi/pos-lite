'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { SavedReportOpenButton } from '@/components/reports/SavedReportOpenButton';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import {
  SAVED_REPORT_NAME_MAX_LENGTH,
  validateSavedReportName,
} from '@/lib/reports/savedReportValidation.core';
import { savedReportsListMode } from '@/lib/reports/savedReportsList.core';
import { hasSavedReportArtifact } from '@/lib/reports/savedReportArtifact.core';
import { savedReportSnapshotMeta } from '@/lib/reports/savedReportAccess.core';
import {
  buildReportHref,
  normalizeReportType,
  resolveReportTitle,
} from '@/lib/reports/report-config';

interface SavedReportRecord {
  id: string;
  name: string;
  reportType: string;
  filters: Record<string, unknown>;
  format?: string;
  storageKey?: string | null;
  fileUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatReportType(reportType: string) {
  const slug = normalizeReportType(reportType);
  if (!slug) return 'Unknown report';
  return resolveReportTitle(buildReportHref(slug));
}

/**
 * M34-01 (BUG-78): the href is ALWAYS composed from a known slug.
 *
 * The old builder walked `reportType.startsWith('/') ? reportType : ...`,
 * which turned a persisted `//evil.com/x` into a protocol-relative href
 * (confirmed reachable today, since it passes the `startsWith('/')` test)
 * — one click navigated off-site. Even with the new server-side allowlist,
 * the client never trusts the stored string.
 */
function buildSavedReportHref(savedReport: SavedReportRecord) {
  const slug = normalizeReportType(savedReport.reportType);
  const route = slug ? buildReportHref(slug) : null;

  if (!route) return null;

  const params = new URLSearchParams();

  Object.entries(savedReport.filters ?? {}).forEach(([key, value]) => {
    if (typeof value === 'string') {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string') {
          params.append(key, item);
        }
      });
    }
  });

  const query = params.toString();
  return query ? `${route}?${query}` : route;
}

export default function SavedReportsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<SavedReportRecord | null>(null);
  const [nextName, setNextName] = useState('');
  const [deletingReport, setDeletingReport] = useState<SavedReportRecord | null>(null);
  const nameCheck = validateSavedReportName(nextName);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ success: boolean; data: SavedReportRecord[] }>({
    queryKey: ['saved-reports-page'],
    queryFn: async () => {
      const res = await fetch('/api/reports/saved');
      if (!res.ok) throw new Error('Failed to fetch saved reports');
      return res.json();
    },
  });

  const reports = data?.data ?? [];
  const mode = savedReportsListMode({
    isLoading,
    isError,
    count: reports.length,
  });
  const grouped = useMemo(() => {
    return reports.reduce<Record<string, SavedReportRecord[]>>((acc, report) => {
      const key = formatReportType(report.reportType);
      acc[key] = [...(acc[key] ?? []), report];
      return acc;
    }, {});
  }, [reports]);

  const renameMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error('No report selected');
      // Mirror the server's shared short-text rule before the round-trip.
      const check = validateSavedReportName(nextName);
      if (!check.ok) throw new Error(check.message ?? 'Invalid name');
      const res = await fetch(`/api/reports/saved/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: check.name }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? 'Failed to rename report');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-reports-page'] });
      toast.success('Saved report renamed');
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reports/saved/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Failed to delete report');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-reports-page'] });
      toast.success('Saved report deleted');
      setDeletingReport(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Saved Reports</h1>
        <p className="mt-1 text-sm text-sand-ink">Open, rename, or remove the report presets you’ve collected across the reporting suite.</p>
      </div>

      {mode === 'loading' ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : mode === 'error' ? (
        <Card className="border-red-200">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="font-medium text-red-700">Saved reports could not be loaded.</p>
            <p className="text-sm text-red-600">This is a load failure, not an empty library.</p>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : mode === 'empty' ? (
        <Card className="border-mist">
          <CardContent className="py-16 text-center text-sand-ink">
            No saved reports yet. Save a preset from any report screen to manage it here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([group, groupReports]) => (
            <Card key={group} className="border-mist">
              <CardHeader>
                <CardTitle className="text-espresso">{group}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupReports.map((report) => (
                  <div key={report.id} className="flex flex-col gap-4 rounded-lg border border-mist bg-pearl/40 p-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-espresso">{report.name}</p>
                        <span className="rounded bg-mist/50 px-1.5 py-0.5 font-mono text-[10px] uppercase text-sand-ink">
                          {report.format ?? "pdf"}
                        </span>
                      </div>
                      <p className="text-xs text-sand-ink">Created {new Date(report.createdAt).toLocaleString()} · Updated {new Date(report.updatedAt).toLocaleString()}</p>
                      <p className="font-mono text-[11px] text-sand-ink break-all">
                        {Object.keys(report.filters ?? {}).length === 0 ? 'No filters saved' : JSON.stringify(report.filters)}
                      </p>
                      {(() => {
                        const snapshot = savedReportSnapshotMeta(report.filters);
                        if (!snapshot.asOf) return null;
                        return (
                          <p className="text-xs text-amber-700">
                            Snapshot as of {new Date(snapshot.asOf).toLocaleString()} - Open in App
                            shows current data.
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {hasSavedReportArtifact(report) ? (
                        <>
                          <Button variant="outline" asChild>
                            <a
                              href={`/api/reports/saved/${report.id}/download?view=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View
                            </a>
                          </Button>
                          <Button variant="outline" asChild>
                            <a href={`/api/reports/saved/${report.id}/download`}>Download</a>
                          </Button>
                        </>
                      ) : (
                        <span className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                          Artifact unavailable - view/download disabled
                        </span>
                      )}
                      <SavedReportOpenButton href={buildSavedReportHref(report)} />
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditing(report);
                          setNextName(report.name);
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        variant="outline"
                        className="border-terracotta text-terracotta hover:bg-terracotta/10"
                        onClick={() => setDeletingReport(report)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">Rename saved report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="saved-report-name">Name</Label>
              <Input
                id="saved-report-name"
                value={nextName}
                maxLength={SAVED_REPORT_NAME_MAX_LENGTH}
                aria-invalid={!nameCheck.ok && nextName.length > 0}
                aria-describedby="saved-report-name-help"
                onChange={(event) => setNextName(event.target.value)}
              />
              <p
                id="saved-report-name-help"
                className={`font-body text-xs ${nameCheck.ok ? 'text-mist-ink' : 'text-red-600'}`}
              >
                {nameCheck.ok
                  ? `${nextName.trim().length}/${SAVED_REPORT_NAME_MAX_LENGTH} characters`
                  : (nameCheck.message ?? 'Enter a name')}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                onClick={() => renameMutation.mutate()}
                disabled={renameMutation.isPending || !nameCheck.ok}
              >
                {renameMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deletingReport !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingReport(null);
        }}
        title="Delete saved report?"
        description={`“${deletingReport?.name ?? ''}” and its stored file will be removed permanently. This cannot be undone.`}
        detail="Open or download the report first if you need a copy."
        pending={deleteMutation.isPending}
        confirmLabel="Delete report"
        onConfirm={() => {
          if (deletingReport) deleteMutation.mutate(deletingReport.id);
        }}
      />
    </div>
  );
}
