'use client';

import { Button } from '@/components/ui/button';

/**
 * M34-01 (BUG-78) — the "Open in App" action for a saved report.
 *
 * Deliberately a component rather than an inline `<a>`: it makes the unsafe case
 * impossible to reintroduce. The caller passes an href that has already been
 * built from a validated slug; when the stored `reportType` is not a report the
 * app knows (legacy rows written before the allowlist), there is no href at all
 * and the action renders disabled with an explicit label instead of a blank or
 * off-site link.
 */
export function SavedReportOpenButton({ href }: { href: string | null }) {
  if (!href) {
    return (
      <Button
        variant="outline"
        disabled
        title="This report type is no longer available in the app"
      >
        Unknown report
      </Button>
    );
  }

  return (
    <Button variant="outline" asChild>
      <a href={href}>Open in App</a>
    </Button>
  );
}