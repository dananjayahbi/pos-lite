'use client';

import { Button } from '@/components/ui/button';
import { ShippingLabel, printSampleSheet } from './ShippingLabel';
import { SAMPLE_ADDRESS, SAMPLE_DELIVERY } from './sampleLabel';
import type { DeliveryLabelTemplate } from '@/types/delivery-label';

export function LabelPreview({ template }: { template: DeliveryLabelTemplate }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-espresso">Live preview</p>
          <p className="text-xs text-sand-ink">
            A4 landscape · 2 waybills per sheet · 148.5 × 210 mm each.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => printSampleSheet(template)}>
          Print 2-up sample
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-dashed border-sand/50 bg-white/50 p-4">
        {/* Scaled down so the full A5-sized waybill fits the editor column. */}
        <div className="mx-auto h-[168mm] w-[118.8mm]">
          <div className="h-[210mm] w-[148.5mm] origin-top-left scale-[0.8] bg-white shadow-sm">
            <ShippingLabel
              template={template}
              address={SAMPLE_ADDRESS}
              delivery={SAMPLE_DELIVERY}
              waybillId={SAMPLE_DELIVERY.waybill}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
