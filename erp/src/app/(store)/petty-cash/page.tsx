import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PettyCashDashboard from '@/components/petty-cash/PettyCashDashboard';

export const metadata = {
  title: 'Petty Cash',
};

export default function PettyCashPage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="space-y-4 p-6">
            <div className="h-8 w-48 animate-pulse rounded bg-mist" />
            <div className="h-28 w-full animate-pulse rounded bg-mist" />
          </div>
        }
      >
        <PettyCashDashboard />
      </Suspense>
    </ErrorBoundary>
  );
}
