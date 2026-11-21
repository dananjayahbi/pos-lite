'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
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
import {
  SAVED_REPORTS_PAGE_SIZE,
  filterSavedReports,
  paginateSavedReports,
  savedReportFilterChips,
  savedReportsListMode,
} from '@/lib/reports/savedReportsList.core';
import { formatShortDateTime } from '@/lib/format';
import { hasSavedReportArtifact } from '@/lib/reports/savedReportArtifact.core';
import { savedReportSnapshotMeta } from '@/lib/reports/savedReportAccess.core';
import {
  buildSavedReportHref,
  savedReportDownloadHref,
} from '@/lib/reports/savedReportLink.core';
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

export default function SavedReportsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<SavedReportRecord | null>(null);
  const [nextName, setNextName] = useState('');
  const [deletingReport, setDeletingReport] = useState<SavedReportRecord | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
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
  // ARGUS #449 - search and paginate a growing library instead of dumping every
  // preset onto one page.
  const filtered = useMemo(() => filterSavedReports(reports, search), [reports, search]);
  const paged = paginateSavedReports(filtered, page, SAVED_REPORTS_PAGE_SIZE);
  const grouped = useMemo(() => {
    return paged.items.reduce<Record<string, SavedReportRecord[]>>((acc, report) => {
      const key = formatReportType(report.reportType);
      acc[key] = [...(acc[key] ?? []), report];
      return acc;
    }, {});
  }, [paged.items]);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Saved Reports</h1>
          <p className="mt-1 text-sm text-sand-ink">
            Open, rename, or remove the report presets you’ve collected across the reporting
            suite.
          </p>
          {mode === 'ready' && (
            <p className="mt-1 font-body text-xs text-mist-ink">
              {reports.length} {reports.length === 1 ? 'preset' : 'presets'}
              {search.trim() !== '' ? ` · ${filtered.length} matching` : ''}
            </p>
          )}
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-ink"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search presets, filters, report type…"
            aria-label="Search saved reports"
            className="pl-9"
          />
        </div>
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
      ) : filtered.length === 0 ? (
        <Card className="border-mist">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sand-ink">
            <p>No saved reports match “{search.trim()}”.</p>
            <Button variant="outline" size="sm" onClick={() => setSearch('')}>
              Clear search
            </Button>
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
                {groupReports.map((report) => {
                  const snapshot = savedReportSnapshotMeta(report.filters);
                  const chips = savedReportFilterChips(report.filters);
                  const dataAsOf = snapshot.asOf ?? report.updatedAt ?? report.createdAt;
                  return (
                  <div key={report.id} className="flex flex-col gap-4 rounded-lg border border-mist bg-pearl/40 p-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-espresso">{report.name}</p>
                        <span className="rounded bg-mist/50 px-1.5 py-0.5 font-mono text-[10px] uppercase text-sand-ink">
                          {report.format ?? "pdf"}
                        </span>
                      </div>
                      <p className="text-xs text-sand-ink">
                        Created {formatShortDateTime(report.createdAt)} · Updated{' '}
                        {formatShortDateTime(report.updatedAt)}
                      </p>
                      <p className="text-xs text-amber-800">
                        Data as of {formatShortDateTime(dataAsOf)}
                        {snapshot.asOf
                          ? ' (saved snapshot; Open in App shows current data)'
                          : ' (artifact generation time)'}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {chips.length === 0 ? (
                          <span className="text-xs text-sand-ink">No filters saved</span>
                        ) : (
                          chips.map((chip) => (
                            <span
                              key={chip.key}
                              className="inline-flex items-center gap-1 rounded-full border border-mist bg-white px-2 py-0.5 text-[11px] text-espresso"
                            >
                              <span className="text-sand-ink">{chip.label}</span>
                              {chip.value}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {hasSavedReportArtifact(report) ? (
                        <>
                          <Button variant="outline" asChild>
                            <a
                              href={savedReportDownloadHref(report.id, true)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View
                            </a>
                          </Button>
                          <Button variant="outline" asChild>
                            <a href={savedReportDownloadHref(report.id)}>Download</a>
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
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {paged.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-body text-sm text-sand-ink">
                Showing {(paged.page - 1) * paged.pageSize + 1}–
                {Math.min(paged.page * paged.pageSize, paged.total)} of {paged.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paged.page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <span className="font-body text-sm text-sand-ink">
                  Page {paged.page} of {paged.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paged.page >= paged.totalPages}
                  onClick={() => setPage((current) => Math.min(paged.totalPages, current + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
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
