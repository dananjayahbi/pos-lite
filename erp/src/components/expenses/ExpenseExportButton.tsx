'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ExpenseExportButtonProps {
  className?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
}

/**
 * ARGUS #396 - downloads the filtered expense register (every account and
 * petty-cash fund), not the first active fund's petty-cash audit trail.
 */
export function ExpenseExportButton({
  className,
  dateFrom,
  dateTo,
  category,
}: ExpenseExportButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleExport = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (category && category !== 'ALL') params.set('category', category);

      const res = await fetch(`/api/store/expenses/export?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expense-register-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Expense register downloaded');
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
      Export Register
    </Button>
  );
}
