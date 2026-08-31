import type { StorageMetrics } from '@/lib/superadmin/storage-metrics';
import { formatBytes } from '@/lib/superadmin/storage-metrics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HardDrive, AlertTriangle, Package } from 'lucide-react';

type Props = {
  metrics: StorageMetrics;
};

export default function StorageMetricsCard({ metrics }: Props) {
  const { available, provider, bucket, objectCount, totalBytes, folders, error } = metrics;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-espresso">Storage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {available ? (
          <>
            <div className="flex items-center gap-4">
              <HardDrive className="h-8 w-8 text-espresso/60" />
              <div className="space-y-1">
                <p className="font-medium text-espresso">{formatBytes(totalBytes)} used</p>
                <p className="text-espresso/60">
                  {objectCount.toLocaleString('en-US')} objects · {provider}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-espresso/10 bg-linen/50 px-3 py-2">
              <span className="text-espresso/60">Bucket</span>
              <span className="font-mono text-espresso">{bucket}</span>
            </div>

            {folders.length > 0 ? (
              <div className="mt-2">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-espresso/50">
                  <Package className="h-3.5 w-3.5" /> By Folder
                </p>
                <div className="max-h-48 overflow-y-auto rounded-md border border-espresso/10">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prefix</TableHead>
                        <TableHead className="text-right">Objects</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {folders.map((folder) => (
                        <TableRow key={folder.prefix}>
                          <TableCell className="font-mono text-xs">{folder.prefix}</TableCell>
                          <TableCell className="text-right text-xs">
                            {folder.count.toLocaleString('en-US')}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {formatBytes(folder.bytes)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <p className="text-espresso/50">No objects found in this bucket.</p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="font-medium text-espresso">Metrics unavailable</p>
            </div>
            {error && <p className="text-xs text-espresso/60">{error}</p>}
            <Badge className="bg-mist text-espresso/60">Configure Cloudflare R2</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
