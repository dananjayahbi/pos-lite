'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter, usePathname } from 'next/navigation';

interface AppointmentsLayoutProps {
  children: React.ReactNode;
}

export function AppointmentsLayout({ children }: AppointmentsLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    { value: '/appointments', label: 'Calendar' },
    { value: '/appointments/list', label: 'List' },
    { value: '/appointments/services', label: 'Services' },
    { value: '/appointments/settings', label: 'Settings' },
  ];

  return (
    <div data-testid="appointments-page" className="space-y-4 p-4 md:p-6">
      {/* ARGUS #136: the tab strip was the only page chrome. */}
      <div>
        <h1 className="text-2xl font-semibold text-espresso">Appointments</h1>
        <p className="text-sm text-espresso/60">
          Calendar, list, services and settings for the appointment book.
        </p>
      </div>
      <Tabs value={pathname} onValueChange={(v) => router.push(v)}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {children}
    </div>
  );
}
