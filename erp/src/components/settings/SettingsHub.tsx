import Link from 'next/link';
import { PageContainer } from '@/components/shared/PageContainer';
import { visibleSettingsCatalog } from '@/lib/settings/settings-catalog';

/**
 * Landing page for `/settings`.
 *
 * The individual settings screens each live at their own route and the sidebar
 * links to them directly, but `/settings` itself previously had no page — so
 * the URL 404'd for anyone who typed it or followed an old link. This hub lists
 * the settings the signed-in user may open.
 */
export function SettingsHub({ permissions }: { permissions: readonly string[] }) {
  const entries = visibleSettingsCatalog(permissions);

  return (
    <PageContainer maxWidth="7xl" className="space-y-8">
      <header>
        <h1 className="text-espresso font-display text-2xl font-bold">Settings</h1>
        <p className="text-sand mt-1 text-sm">
          Configure this store. Only the sections your role can access are listed.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="text-sand text-sm">No settings sections are available for your role.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="border-mist bg-pearl hover:border-terracotta/50 rounded-xl border p-4 transition-colors"
            >
              <h2 className="text-espresso font-display text-base font-semibold">{entry.label}</h2>
              <p className="text-sand mt-1 text-sm">{entry.description}</p>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
