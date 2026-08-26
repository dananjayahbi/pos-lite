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
    <div className="space-y-4">
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
