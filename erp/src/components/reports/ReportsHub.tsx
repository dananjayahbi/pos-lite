import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer } from '@/components/shared/PageContainer';
import { visibleReportCatalog } from '@/lib/reports/report-catalog';

/**
 * Landing page for `/reports`.
 *
 * The report sub-pages live under their own routes and the shared report
 * layout supplies the sidebar, but `/reports` itself previously had no page —
 * so the URL 404'd even though it is linked from the daily-summary email and
 * listed as a module entry point. This hub renders the permitted reports as a
 * directory and links straight into each report.
 */
export function ReportsHub({ permissions }: { permissions: readonly string[] }) {
  const groups = visibleReportCatalog(permissions);

  return (
    <PageContainer maxWidth="7xl" className="space-y-8">
      <header>
        <h1 className="text-espresso font-display text-2xl font-bold">Reports</h1>
        <p className="text-sand mt-1 text-sm">
          Analytics and audit reporting for this store. Pick a report to set its date range, then export
          or save it.
        </p>
      </header>

      {groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No reports available</CardTitle>
            <CardDescription>
              Your role does not include report permissions. Ask an owner or manager for access.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="space-y-3">
            <div>
              <h2 className="text-espresso font-display text-lg font-semibold">{group.label}</h2>
              <p className="text-sand text-sm">{group.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.entries.map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="border-mist bg-pearl hover:border-terracotta/50 rounded-xl border transition-colors"
                >
                  <Card className="h-full ring-0">
                    <CardHeader>
                      <CardTitle>{entry.label}</CardTitle>
                      <CardDescription>{entry.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-terracotta text-sm font-medium">
                      Open report
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </PageContainer>
  );
}
