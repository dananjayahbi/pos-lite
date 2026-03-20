'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { ImportProgressBar } from '@/components/csv/ImportProgressBar';
import { CsvUploadZone } from '@/components/csv/CsvUploadZone';
import { ColumnMappingTable } from '@/components/csv/ColumnMappingTable';
import { ImportPreviewTable } from '@/components/csv/ImportPreviewTable';

const STEPS = [
  { number: 1, label: 'Upload' },
  { number: 2, label: 'Map Columns' },
  { number: 3, label: 'Preview & Confirm' },
];

export default function ImportPage() {
  const router = useRouter();
  const { hasPermission, isLoading } = usePermissions();

  const [step, setStep] = useState(1);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoading && !hasPermission('product:create')) {
      router.push('/inventory');
    }
  }, [isLoading, hasPermission, router]);

  const handleParsed = (
    data: Record<string, string>[],
    hdrs: string[],
    name: string,
  ) => {
    setParsedData(data);
    setHeaders(hdrs);
    setFileName(name);
    setStep(2);
  };

  const handleMappingConfirmed = (mapping: Record<string, string>) => {
    setColumnMapping(mapping);
    setStep(3);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linen">
        <p className="font-body text-mist">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linen py-8 px-4">
      <div className="mx-auto max-w-[860px] rounded-lg bg-pearl p-6 shadow-sm">
        {/* Breadcrumb */}
        <p className="font-body text-xs text-mist mb-1">
          <Link href="/inventory" className="hover:underline">
            Inventory
          </Link>
          {' → Import Products'}
        </p>

        {/* Title */}
        <h1 className="font-display text-2xl text-espresso mb-4">
          Import Products
        </h1>

        {/* Template download */}
        <p className="font-body text-sm mb-6">
          <a
            href="/api/store/products/csv-template"
            className="text-terracotta hover:underline"
          >
            Download CSV template
          </a>
        </p>

        {/* Progress bar */}
        <div className="mb-8">
          <ImportProgressBar currentStep={step} steps={STEPS} />
        </div>

        {/* Step content */}
        {step === 1 && <CsvUploadZone onParsed={handleParsed} />}

        {step === 2 && (
          <ColumnMappingTable
            headers={headers}
            data={parsedData}
            onMappingConfirmed={handleMappingConfirmed}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <ImportPreviewTable
            data={parsedData}
            mapping={columnMapping}
            onBack={() => setStep(2)}
          />
        )}

        {/* File info reminder */}
        {step > 1 && fileName && (
          <p className="mt-4 font-body text-xs text-mist">
            File: {fileName} — {parsedData.length} rows
          </p>
        )}
      </div>
    </div>
  );
}
