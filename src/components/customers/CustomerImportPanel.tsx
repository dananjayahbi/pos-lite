'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Download, FileUp, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  skippedDetails: string[];
  errorDetails: Array<{ row: number; message: string }>;
}

interface CustomerImportPanelProps {
  onSuccess?: () => void;
  showBackLink?: boolean;
}

export function CustomerImportPanel({ onSuccess, showBackLink = false }: CustomerImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const headers = 'Name,Phone,Email,Gender,Birthday,Tags,Notes\n';
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'customer_import_template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('csv', file);

      const res = await fetch('/api/store/customers/import', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json?.error?.message ?? 'Import failed');
        return;
      }

      setResult(json.data);
      if (json.data.imported > 0) {
        toast.success(`Imported ${json.data.imported} customer(s)`);
        onSuccess?.();
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {showBackLink ? (
        <div>
          <Link href="/customers" className="text-sm text-terracotta hover:underline">
            ← Back to customers
          </Link>
        </div>
      ) : null}

      <div className="rounded-xl border border-mist/40 bg-pearl p-5">
        <p className="text-sm font-medium text-espresso">CSV format</p>
        <p className="mt-2 font-mono text-xs text-sand">Name, Phone, Email, Gender, Birthday, Tags, Notes</p>
        <p className="mt-2 text-xs text-mist">
          Gender accepts MALE, FEMALE, or OTHER. Birthday should use YYYY-MM-DD.
          Multiple tags can be comma-separated in a single cell.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={handleDownloadTemplate}>
          <Download className="mr-2 h-4 w-4" />
          Download Template
        </Button>
        <Button variant="outline" asChild>
          <Link href="/customers">Review existing customers</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-dashed border-mist/50 bg-linen/30 p-8 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3"
        >
          <FileUp className="h-10 w-10 text-mist" />
          <div>
            <p className="text-sm font-medium text-espresso">
              {file ? file.name : 'Choose a customer CSV file'}
            </p>
            <p className="mt-1 text-xs text-mist">Max 500 rows and 2MB per upload.</p>
          </div>
        </button>
      </div>

      <Button onClick={handleImport} disabled={!file || uploading} className="w-full sm:w-auto">
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? 'Importing...' : 'Import Customers'}
      </Button>

      {result ? (
        <div className="space-y-4 rounded-xl border border-mist/40 bg-pearl p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-center">
              <p className="font-mono text-2xl font-bold text-green-700">{result.imported}</p>
              <p className="text-xs text-green-600">Imported</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-center">
              <p className="font-mono text-2xl font-bold text-amber-700">{result.skipped}</p>
              <p className="text-xs text-amber-600">Skipped</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-center">
              <p className="font-mono text-2xl font-bold text-red-700">{result.errors}</p>
              <p className="text-xs text-red-600">Errors</p>
            </div>
          </div>

          {result.skippedDetails.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-medium text-amber-700">Skipped rows</p>
              <ul className="space-y-1 text-xs text-amber-600">
                {result.skippedDetails.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.errorDetails.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-medium text-red-700">Errors</p>
              <ul className="space-y-1 text-xs text-red-600">
                {result.errorDetails.map((detail, index) => (
                  <li key={`${detail.row}-${index}`}>
                    Row {detail.row}: {detail.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
