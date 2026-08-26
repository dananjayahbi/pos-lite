'use client';

import { Button } from '@/components/ui/button';
import { ShippingLabel, printSampleLabel } from './ShippingLabel';
import {
  SAMPLE_ADDRESS,
  SAMPLE_DELIVERY,
  SAMPLE_LABEL_EXTRAS,
} from './sampleLabel';
import type { DeliveryLabelTemplate } from '@/types/delivery-label';

export function LabelPreview({ template }: { template: DeliveryLabelTemplate }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-espresso">Live preview</p>
        <Button size="sm" variant="outline" onClick={() => printSampleLabel(template)}>
          Print sample
        </Button>
      </div>
      <div className="rounded-lg border border-dashed border-sand/50 bg-white/50 p-4">
        <ShippingLabel
          template={template}
          address={SAMPLE_ADDRESS}
          delivery={SAMPLE_DELIVERY}
          waybillId={SAMPLE_LABEL_EXTRAS.waybillId}
          origin={SAMPLE_LABEL_EXTRAS.origin}
          pickupAddress={SAMPLE_LABEL_EXTRAS.pickupAddress}
        />
      </div>
    </div>
  );
}
