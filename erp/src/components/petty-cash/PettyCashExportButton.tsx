'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PettyCashExportButtonProps {
  className?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
}

/**
 * Triggers a client-side download of the petty-cash audit-trail export (doc 41)
 * for the current date range / category filter.
 */
export function PettyCashExportButton({
  className,
  dateFrom,
  dateTo,
  category,
}: PettyCashExportButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleExport = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (category && category !== 'ALL') params.set('category', category);

      const res = await fetch(`/api/store/petty-cash/export?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `petty-cash-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Petty cash export downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className={className}
      onClick={handleExport}
      disabled={downloading}
    >
      {downloading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Export
    </Button>
  );
}
