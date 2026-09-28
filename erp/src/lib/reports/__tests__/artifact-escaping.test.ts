// @vitest-environment node
import { describe, it, expect } from 'vitest';

import { buildXlsxHtml, buildPrintHtml, escapeHTML, type ReportColumn, type ReportRow } from '@/lib/reports/export';

/**
 * M34-02 (BUG-77) — the artifact sink audit the doc asks for.
 *
 * `generateReportFile` (route.ts:137) renders saved reports SERVER-SIDE, so a
 * markup-bearing saved-report name is closer to an exploit than a React text
 * child would be. These tests prove the sink escapes: the XLSX path and the
 * print/PDF shell both interpolate every dynamic value through `escapeHTML`, so
 * a name of `<script>alert(1)</script>` can never produce an executable element.
 *
 * Scope note: `generate-report.ts` (which also owns a CSV emitter) is NOT
 * imported here — it hard-imports `jspdf`/`jspdf-autotable`, which are absent
 * from this repo (the pre-existing TS2307 pair). The escaping audit therefore
 * targets the HTML-building module that actually interpolates user text, which
 * is precisely the sink the doc flags.
 */
const columns: ReportColumn[] = [{ key: 'name', header: 'Name' }];
const rows: ReportRow[] = [{ name: 'Tea' }];

describe('buildXlsxHtml escaping (M34-02 / BUG-77)', () => {
  it('escapes a markup-bearing sheet name', () => {
    const html = buildXlsxHtml('<script>alert(1)</script>', columns, rows);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes markup inside data cells', () => {
    const html = buildXlsxHtml('Sheet', columns, [{ name: '<img src=x onerror=alert(1)>' }]);
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img');
  });

  it('escapes markup inside column headers', () => {
    const html = buildXlsxHtml('Sheet', [{ key: 'name', header: '<b>Name</b>' }], rows);
    expect(html).not.toContain('<b>Name</b>');
    expect(html).toContain('&lt;b&gt;Name&lt;/b&gt;');
  });

  it('still emits the workbook table it is supposed to build', () => {
    expect(buildXlsxHtml('Sheet', columns, rows)).toContain('<table border="1">');
  });
});

describe('buildPrintHtml escaping (M34-02 / BUG-77)', () => {
  it('escapes the report title so a saved name cannot inject markup', () => {
    const html = buildPrintHtml('<script>alert(1)</script>', '2026-01-01 to 2026-01-31', columns, rows);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('still emits the real table structure it is supposed to build', () => {
    const html = buildPrintHtml('Sales', 'range', columns, rows);
    expect(html).toContain('<table>');
    expect(html).toContain('<th');
  });

  it('escapes the title in the <title> tag as well as the heading', () => {
    const html = buildPrintHtml('</title><script>alert(1)</script>', '', columns, rows);
    expect(html).not.toContain('</title><script>');
    expect(html).toContain('&lt;/title&gt;');
  });

  it('escapes the date range', () => {
    const html = buildPrintHtml('Sales', '<script>alert(1)</script>', columns, rows);
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('retains its own print script (the escaping is not over-broad)', () => {
    expect(buildPrintHtml('Sales', 'range', columns, rows)).toContain('window.print()');
  });
});

describe('escapeHTML (M34-02 / BUG-77)', () => {
  it('covers the five HTML-significant characters', () => {
    expect(escapeHTML(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('escapes the ampersand first so entities cannot be smuggled in', () => {
    expect(escapeHTML('&#60;script&#62;')).toBe('&amp;#60;script&amp;#62;');
  });
});