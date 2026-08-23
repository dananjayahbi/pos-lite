import { Suspense } from 'react';
import RecoveryPerformanceClient from '@/components/reports/RecoveryPerformanceClient';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function RecoveryPerformancePage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <RecoveryPerformanceClient />
      </ErrorBoundary>
    </Suspense>
  );
}
