'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useProductWizardStore } from '@/stores/productWizardStore';
import { WizardProgressBar } from '@/components/wizard/WizardProgressBar';
import { WizardStep1BasicInfo } from '@/components/wizard/WizardStep1BasicInfo';
import { WizardStep2Variants } from '@/components/wizard/WizardStep2Variants';
import { Card } from '@/components/ui/card';

export default function NewProductPage() {
  const router = useRouter();
  const { hasPermission, isLoading } = usePermissions();
  const step = useProductWizardStore((s) => s.step);
  const resetWizard = useProductWizardStore((s) => s.resetWizard);

  useEffect(() => {
    if (!isLoading && !hasPermission('product:create')) {
      router.replace('/inventory');
    }
  }, [isLoading, hasPermission, router]);

  // Reset wizard on unmount (handles browser back button)
  useEffect(() => {
    return () => {
      resetWizard();
    };
  }, [resetWizard]);

  if (isLoading) return null;
  if (!hasPermission('product:create')) return null;

  return (
    <main className="min-h-screen bg-linen p-6 md:p-8">
      <div className="mx-auto max-w-[800px]">
        <Card className="border-mist bg-pearl p-6 md:p-8">
          <WizardProgressBar currentStep={step} />
          <div className="mt-8">
            {step === 1 && <WizardStep1BasicInfo />}
            {step === 2 && <WizardStep2Variants />}
            {step === 3 && (
              <div className="text-center text-mist py-12">
                <p className="font-display text-xl text-espresso">
                  Step 3: Review
                </p>
                <p className="text-sm mt-2">Coming soon</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
