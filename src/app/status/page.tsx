'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type ComponentStatus = 'operational' | 'degraded' | 'down' | 'external';

interface HealthResponse {
  status: string;
  latency: number;
  timestamp: string;
}

function statusBadge(status: ComponentStatus) {
  switch (status) {
    case 'operational':
      return <Badge className="bg-terracotta text-white">Operational</Badge>;
    case 'degraded':
      return <Badge className="bg-sand text-espresso">Degraded</Badge>;
    case 'down':
      return <Badge className="bg-red-500 text-white">Down</Badge>;
    case 'external':
      return <Badge className="bg-mist text-espresso">External</Badge>;
  }
}

function overallBanner(statuses: ComponentStatus[]) {
  if (statuses.some((s) => s === 'down')) {
    return 'bg-red-100 text-red-800';
  }
  if (statuses.some((s) => s === 'degraded')) {
    return 'bg-amber-100 text-amber-800';
  }
  return 'bg-terracotta text-white';
}

function overallLabel(statuses: ComponentStatus[]) {
  if (statuses.some((s) => s === 'down')) {
    return 'System Outage';
  }
  if (statuses.some((s) => s === 'degraded')) {
    return 'Degraded Performance';
  }
  return 'All Systems Operational';
}

function deriveApiStatus(
  data: HealthResponse | undefined,
  isError: boolean,
): ComponentStatus {
  if (isError || !data) return 'down';
  if (data.status === 'ok') return 'operational';
  return 'degraded';
}

function deriveDbStatus(
  data: HealthResponse | undefined,
  isError: boolean,
): ComponentStatus {
  if (isError || !data) return 'down';
  if (data.latency < 150) return 'operational';
  if (data.latency <= 500) return 'degraded';
  return 'down';
}

function deriveAuthStatus(
  isSuccess: boolean,
  isError: boolean,
): ComponentStatus {
  if (isError) return 'degraded';
  if (isSuccess) return 'operational';
  return 'degraded';
}

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json() as Promise<HealthResponse>;
}

async function fetchAuthStatus(): Promise<{ ok: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 500);

  try {
    const res = await fetch('/api/auth/session', {
      signal: controller.signal,
    });
    return { ok: res.ok };
  } finally {
    clearTimeout(timeout);
  }
}

function PingDot({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="relative ml-2 inline-flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terracotta opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-terracotta" />
    </span>
  );
}

function ComponentCard({
  title,
  status,
  latency,
  subtitle,
  isFetching,
}: {
  title: string;
  status: ComponentStatus;
  latency?: number;
  subtitle?: string;
  isFetching: boolean;
}) {
  return (
    <Card className="border-mist">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-espresso text-sm font-medium">
          {title}
          <PingDot active={isFetching && status !== 'external'} />
        </CardTitle>
        {statusBadge(status)}
      </CardHeader>
      <CardContent>
        {latency !== undefined && (
          <p className="font-mono text-xs text-terracotta" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
            {latency}ms latency
          </p>
        )}
        {subtitle && (
          <p className="text-mist text-xs">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function StatusPage() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  const authQuery = useQuery({
    queryKey: ['auth-session-status'],
    queryFn: fetchAuthStatus,
    refetchInterval: 30_000,
  });

  const apiStatus = deriveApiStatus(healthQuery.data, healthQuery.isError);
  const dbStatus = deriveDbStatus(healthQuery.data, healthQuery.isError);
  const authStatus = deriveAuthStatus(authQuery.isSuccess, authQuery.isError);
  const whatsappStatus: ComponentStatus = 'external';

  const statuses: ComponentStatus[] = [apiStatus, dbStatus, authStatus];

  return (
    <div className="bg-pearl min-h-screen">
      {/* Brand header */}
      <header className="px-6 pt-10 pb-6 text-center">
        <h1>
          <span className="font-heading text-espresso text-[32px] font-bold">
            Velvet
          </span>
          <span className="text-espresso text-[32px] font-light">POS</span>
        </h1>
        <p className="text-mist mt-1 text-sm">System Status</p>
      </header>

      {/* Overall status banner */}
      <div className="mx-auto max-w-3xl px-6">
        <Card className={`${overallBanner(statuses)} mb-8 border-0`}>
          <CardContent className="py-4 text-center">
            <p className="text-lg font-semibold">{overallLabel(statuses)}</p>
          </CardContent>
        </Card>

        {/* Component cards grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ComponentCard
            title="API"
            status={apiStatus}
            {...(healthQuery.data?.latency !== undefined ? { latency: healthQuery.data.latency } : {})}
            isFetching={healthQuery.isFetching}
          />
          <ComponentCard
            title="Database"
            status={dbStatus}
            {...(healthQuery.data?.latency !== undefined ? { latency: healthQuery.data.latency } : {})}
            isFetching={healthQuery.isFetching}
          />
          <ComponentCard
            title="WhatsApp API"
            status={whatsappStatus}
            subtitle="Third-party service — status not monitored"
            isFetching={false}
          />
          <ComponentCard
            title="Authentication"
            status={authStatus}
            isFetching={authQuery.isFetching}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-linen mt-12 py-6 text-center">
        <p className="text-mist text-xs">
          Status checks refresh automatically every 30 seconds.
        </p>
      </footer>
    </div>
  );
}
