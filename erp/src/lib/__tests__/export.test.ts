import { describe, it, expect } from 'vitest';
import { toCsv, csvDownloadResponse, type CsvColumn } from '@/lib/export';

interface Row {
  name: string;
  value: number;
  note: string | null;
}

const columns: CsvColumn<Row>[] = [
  { header: 'Name', value: (r) => r.name },
  { header: 'Value', value: (r) => r.value },
  { header: 'Note', value: (r) => r.note },
];

describe('toCsv (doc 41)', () => {
  it('writes a header row and data rows', () => {
    const csv = toCsv(columns, [
      { name: 'Tea', value: 120.5, note: 'monthly' },
      { name: 'Travel', value: 800, note: null },
    ]);
    const lines = csv.replace('\uFEFF', '').split('\r\n');
    expect(lines[0]).toBe('Name,Value,Note');
    expect(lines[1]).toBe('Tea,120.5,monthly');
    expect(lines[2]).toBe('Travel,800,');
  });

  it('escapes commas, quotes and newlines per RFC-4180', () => {
    const csv = toCsv(columns, [
      { name: 'Office, Stationery', value: 1, note: 'say "hi"\nnext' },
    ]);
    const line = csv.replace('\uFEFF', '').split('\r\n')[1];
    expect(line).toContain('"Office, Stationery"');
    expect(line).toContain('"say ""hi""\nnext"');
  });

  it('prepends a UTF-8 BOM for Excel compatibility', () => {
    const csv = toCsv(columns, [{ name: 'a', value: 1, note: null }]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });
});

describe('csvDownloadResponse (doc 41)', () => {
  it('returns a CSV attachment with the right headers', () => {
    const res = csvDownloadResponse('a,b', 'export.csv');
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(res.headers.get('Content-Disposition')).toContain('export.csv');
  });
});
