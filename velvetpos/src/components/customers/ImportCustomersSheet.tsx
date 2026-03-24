'use client';

import { CustomerImportPanel } from '@/components/customers/CustomerImportPanel';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface ImportCustomersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportCustomersSheet({ open, onOpenChange, onSuccess }: ImportCustomersSheetProps) {
  const handleClose = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-espresso">Import Customers</SheetTitle>
          <SheetDescription>
            Upload a CSV file to bulk-import customers. Max 500 rows, 2MB.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <CustomerImportPanel onSuccess={onSuccess} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
