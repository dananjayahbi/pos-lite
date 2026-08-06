'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UploadCloud } from 'lucide-react';

interface RemittanceUploadProps {
  onImport: (file: File) => void;
}

/**
 * Labeled file input for uploading a Trans Express remittance CSV statement.
 * The statement is matched against the expected-receivables ledger by waybill.
 */
export function RemittanceUpload({ onImport }: RemittanceUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    onImport(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-espresso/10 bg-linen/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <UploadCloud className="mt-0.5 h-5 w-5 shrink-0 text-espresso/50" />
        <div>
          <Label htmlFor="remittance-csv" className="font-medium text-espresso">
            Import Remittance Statement
          </Label>
          <p className="mt-1 max-w-md text-xs text-espresso/50">
            Upload the Trans Express portal CSV export. Expected columns:{' '}
            <span className="font-mono text-espresso/70">
              waybill, amount, fees, status, date
            </span>
            . Matching is by waybill ID and is idempotent — re-uploading never double-settles.
          </p>
        </div>
      </div>
      <div className="shrink-0">
        <input
          ref={inputRef}
          id="remittance-csv"
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          Choose CSV
        </Button>
      </div>
    </div>
  );
}
