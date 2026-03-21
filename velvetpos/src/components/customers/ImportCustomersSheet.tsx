'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Upload, Download, FileUp } from 'lucide-react';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  skippedDetails: string[];
  errorDetails: Array<{ row: number; message: string }>;
}

interface ImportCustomersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportCustomersSheet({ open, onOpenChange, onSuccess }: ImportCustomersSheetProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const headers = 'Name,Phone,Email,Gender,Birthday,Tags,Notes\n';
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_import_template.csv';
    a.click();
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
        onSuccess();
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setFile(null);
      setResult(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-espresso">Import Customers</SheetTitle>
          <SheetDescription>
            Upload a CSV file to bulk-import customers. Max 500 rows, 2MB.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Format description */}
          <div className="rounded-lg border border-mist/30 bg-linen p-3">
            <p className="font-body text-xs text-espresso font-medium mb-1">Required columns:</p>
            <p className="font-mono text-[11px] text-sand">
              Name, Phone, Email, Gender, Birthday, Tags, Notes
            </p>
            <p className="font-body text-xs text-mist mt-1.5">
              Gender: MALE / FEMALE / OTHER. Birthday: YYYY-MM-DD. Tags: comma-separated.
            </p>
          </div>

          {/* Download template */}
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>

          {/* File input */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-mist/50 py-8 hover:border-terracotta/50 transition-colors"
            >
              <FileUp className="h-8 w-8 text-mist" />
              <span className="font-body text-sm text-mist">
                {file ? file.name : 'Click to select a CSV file'}
              </span>
            </button>
          </div>

          {/* Import button */}
          <Button onClick={handleImport} disabled={!file || uploading} className="w-full">
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? 'Importing...' : 'Import'}
          </Button>

          {/* Results */}
          {result && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 flex-1 text-center">
                  <p className="font-mono text-lg text-green-700 font-bold">{result.imported}</p>
                  <p className="font-body text-xs text-green-600">Imported</p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex-1 text-center">
                  <p className="font-mono text-lg text-amber-700 font-bold">{result.skipped}</p>
                  <p className="font-body text-xs text-amber-600">Skipped</p>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex-1 text-center">
                  <p className="font-mono text-lg text-red-700 font-bold">{result.errors}</p>
                  <p className="font-body text-xs text-red-600">Errors</p>
                </div>
              </div>

              {result.skippedDetails.length > 0 && (
                <div>
                  <p className="font-body text-xs text-amber-700 font-medium mb-1">Skipped:</p>
                  <ul className="space-y-0.5">
                    {result.skippedDetails.map((s, i) => (
                      <li key={i} className="font-body text-xs text-amber-600">{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.errorDetails.length > 0 && (
                <div>
                  <p className="font-body text-xs text-red-700 font-medium mb-1">Errors:</p>
                  <ul className="space-y-0.5">
                    {result.errorDetails.map((e, i) => (
                      <li key={i} className="font-body text-xs text-red-600">
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
