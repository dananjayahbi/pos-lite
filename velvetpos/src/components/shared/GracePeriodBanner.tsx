import { Clock } from 'lucide-react';

interface GracePeriodBannerProps {
  visible: boolean;
  graceEndsAt?: Date | string | null;
}

export default function GracePeriodBanner({
  visible,
  graceEndsAt,
}: GracePeriodBannerProps) {
  if (!visible) return null;

  const supportEmail =
    process.env.SUPPORT_EMAIL ?? 'support@velvetpos.com';

  let dateText = 'soon';
  if (graceEndsAt) {
    dateText = new Date(graceEndsAt).toLocaleDateString('en-LK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <div className="sticky top-0 z-50 flex w-full items-center justify-center gap-2 bg-amber-600 px-4 py-3 text-white">
      <Clock size={20} className="shrink-0" />
      <p className="text-sm">
        Your payment is overdue. Your account will be suspended on{' '}
        <span className="font-semibold">{dateText}</span>.
      </p>
      <a
        href={`mailto:${supportEmail}?subject=Billing%20Issue`}
        className="ml-2 shrink-0 rounded bg-white/20 px-3 py-1 text-sm font-medium hover:bg-white/30"
      >
        Resolve Now
      </a>
    </div>
  );
}
