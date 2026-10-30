'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRupee } from '@/lib/format';

import type { POLine } from './poTypes';

/** Read-only order lines, including the per-line total a buyer actually checks. */
export function POLinesTable({ lines }: { lines: POLine[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Lines</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-sand/30 bg-pearl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-center">Ordered</TableHead>
                <TableHead className="text-center">Received</TableHead>
                <TableHead className="text-right">Expected Cost</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
                <TableHead className="text-right">Actual Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <p className="font-medium text-espresso">{line.productNameSnapshot}</p>
                    <p className="text-xs text-mist">{line.variantDescriptionSnapshot}</p>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{line.variant.sku}</TableCell>
                  <TableCell className="text-center">{line.orderedQty}</TableCell>
                  <TableCell className="text-center">
                    <span className={line.receivedQty > 0 ? 'text-green-600' : ''}>
                      {line.receivedQty} / {line.orderedQty}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatRupee(line.expectedCostPrice)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatRupee(Number(line.expectedCostPrice) * line.orderedQty)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {line.actualCostPrice != null ? formatRupee(line.actualCostPrice) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
