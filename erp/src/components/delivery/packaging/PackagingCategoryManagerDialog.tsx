'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PackagingCategoryEditor } from '@/components/delivery/packaging/PackagingCategoryEditor';

interface PackagingCategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PackagingCategoryManagerDialog({
  open,
  onOpenChange,
}: PackagingCategoryManagerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Packaging categories</DialogTitle>
          <DialogDescription>
            Add, rename or remove the categories used to group packaging stock.
          </DialogDescription>
        </DialogHeader>

        <PackagingCategoryEditor />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
