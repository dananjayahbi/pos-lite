'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface SavedReportRecord {
  id: string;
  name: string;
  reportType: string;
  filters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function formatReportType(reportType: string) {
  const cleaned = reportType.split('/').filter(Boolean).slice(-1)[0] ?? reportType;
  return cleaned.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildSavedReportHref(savedReport: SavedReportRecord) {
  const route = savedReport.reportType.startsWith('/') ? savedReport.reportType : `/reports/${savedReport.reportType}`;
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

  const { data, isLoading } = useQuery<{ success: boolean; data: SavedReportRecord[] }>({
    queryKey: ['saved-reports-page'],
    queryFn: async () => {
      const res = await fetch('/api/reports/saved');
      if (!res.ok) throw new Error('Failed to fetch saved reports');
      return res.json();
    },
  });

  const reports = data?.data ?? [];
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
      const res = await fetch(`/api/reports/saved/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName }),
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
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Saved Reports</h1>
        <p className="mt-1 text-sm text-sand">Open, rename, or remove the report presets you’ve collected across the reporting suite.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card className="border-mist">
          <CardContent className="py-16 text-center text-sand">
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
                      <p className="font-medium text-espresso">{report.name}</p>
                      <p className="text-xs text-sand">Created {new Date(report.createdAt).toLocaleString()} · Updated {new Date(report.updatedAt).toLocaleString()}</p>
                      <p className="font-mono text-[11px] text-sand break-all">
                        {Object.keys(report.filters ?? {}).length === 0 ? 'No filters saved' : JSON.stringify(report.filters)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button variant="outline" asChild>
                        <a href={buildSavedReportHref(report)}>Open</a>
                      </Button>
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
                        onClick={() => deleteMutation.mutate(report.id)}
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
              <Input id="saved-report-name" value={nextName} onChange={(event) => setNextName(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => renameMutation.mutate()} disabled={renameMutation.isPending || nextName.trim().length === 0}>
                {renameMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
