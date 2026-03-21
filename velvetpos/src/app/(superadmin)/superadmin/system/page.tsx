import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

async function checkDatabaseHealth() {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    return { connected: true, latency, error: null };
  } catch (err) {
    return {
      connected: false,
      latency: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

const envLabel: Record<string, { label: string; className: string }> = {
  development: { label: "Development", className: "text-blue-600" },
  test: { label: "Test", className: "text-purple-600" },
  production: { label: "Production", className: "text-green-700" },
};

export default async function SystemHealthPage() {
  const db = await checkDatabaseHealth();

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const nodeEnv = process.env.NODE_ENV ?? "development";
  const envInfo = envLabel[nodeEnv] ?? {
    label: nodeEnv,
    className: "text-espresso",
  };
  const dbRegion = process.env.DATABASE_REGION ?? "Not configured";
  const deployEnv = process.env.DEPLOYMENT_ENVIRONMENT ?? "Not configured";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-espresso">
          System Health
        </h1>
        <span className="text-sm text-espresso/60">
          Refreshed at{" "}
          {new Date().toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "medium",
          })}
        </span>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Database Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-espresso">Database</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-espresso/70">PostgreSQL</p>
            {db.connected ? (
              <p className="text-green-700">
                <span className="mr-1">●</span>Connected — {db.latency}ms
              </p>
            ) : (
              <div>
                <p className="text-red-600">
                  <span className="mr-1">●</span>Unreachable
                </p>
                {db.error && (
                  <p className="mt-1 truncate text-xs text-red-500">
                    {db.error}
                  </p>
                )}
              </div>
            )}
            <p className="text-espresso/60">Region: {dbRegion}</p>
          </CardContent>
        </Card>

        {/* Application Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-espresso">Application</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Environment:{" "}
              <span className={envInfo.className}>{envInfo.label}</span>
            </p>
            <p className="text-espresso/60">Deployment: {deployEnv}</p>
            <p className="text-espresso/60">Framework: Next.js 15</p>
          </CardContent>
        </Card>

        {/* Storage Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-espresso">Storage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-espresso/70">Media Storage</p>
            <p className="text-espresso/60">
              Storage metrics require integration with the configured media
              storage provider (Supabase Storage or Cloudinary).
            </p>
            <Badge className="bg-mist text-espresso/60">
              Coming in Phase 5
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-espresso">
          Recent Activity
        </h2>

        {logs.length === 0 ? (
          <p className="mt-4 text-center text-sm text-espresso/50">
            No activity recorded yet.
          </p>
        ) : (
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor ID</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: (typeof logs)[number]) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">
                    {log.createdAt.toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "medium",
                    })}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.actorId ? log.actorId.slice(0, 8) : "System"}
                  </TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.entityType}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.entityId.slice(0, 8)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
