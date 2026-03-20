'use client';

import { useCallback, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface CsvUploadZoneProps {
  onParsed: (data: Record<string, string>[], headers: string[], fileName: string) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.csv'];
const ALLOWED_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];

export function CsvUploadZone({ onParsed }: CsvUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<{
    fileName: string;
    rowCount: number;
    headers: string[];
    data: Record<string, string>[];
  } | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return 'Invalid file type. Please upload a .csv file.';
    }
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload a .csv file.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File is too large. Maximum size is 5 MB.';
    }
    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      setParseResult(null);

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setIsParsing(true);

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        worker: true,
        complete: (results) => {
          setIsParsing(false);
          if (results.errors.length > 0 && results.data.length === 0) {
            setError('Failed to parse CSV file. Please check the format.');
            return;
          }
          const headers = results.meta.fields ?? [];
          setParseResult({
            fileName: file.name,
            rowCount: results.data.length,
            headers,
            data: results.data,
          });
        },
        error: () => {
          setIsParsing(false);
          setError('Failed to parse CSV file. Please check the format.');
        },
      });
    },
    [validateFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleFile],
  );

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg transition-colors ${
          isDragOver
            ? 'border-2 border-solid border-terracotta bg-terracotta/10'
            : 'border-2 border-dashed border-sand bg-linen'
        }`}
      >
        <Upload className="mb-3 h-10 w-10 text-mist" />
        <p className="font-body text-espresso">
          Drag your CSV file here, or click to browse
        </p>
        <p className="font-body text-xs text-mist mt-1">
          Supports .csv files up to 5 MB
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleInputChange}
      />

      {error && (
        <p className="font-body text-sm text-red-600">{error}</p>
      )}

      {isParsing && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-56" />
        </div>
      )}

      {parseResult && (
        <div className="rounded-lg border border-sand bg-pearl p-4 space-y-3">
          <p className="font-body text-sm text-espresso">
            <span className="font-semibold">{parseResult.fileName}</span>
            {' — '}
            {parseResult.rowCount} row{parseResult.rowCount !== 1 ? 's' : ''} detected
          </p>
          <div className="flex flex-wrap gap-1.5">
            {parseResult.headers.map((h) => (
              <span
                key={h}
                className="rounded-full bg-linen px-2.5 py-0.5 font-mono text-xs text-espresso border border-sand"
              >
                {h}
              </span>
            ))}
          </div>
          <Button
            onClick={() =>
              onParsed(parseResult.data, parseResult.headers, parseResult.fileName)
            }
            className="bg-espresso text-pearl hover:bg-espresso/90"
          >
            Continue to Map Columns →
          </Button>
        </div>
      )}
    </div>
  );
}
