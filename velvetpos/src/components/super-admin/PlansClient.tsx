'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PlanFormDialog from '@/components/super-admin/PlanFormDialog';

export interface SerializedPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  maxUsers: number;
  maxProductVariants: number;
  features: string[];
  isActive: boolean;
  createdAt: Date | string;
  _count: { subscriptions: number };
}

interface PlansClientProps {
  initialPlans: SerializedPlan[];
}

const formatLKR = (value: number) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(value);

async function fetchPlans(): Promise<SerializedPlan[]> {
  const res = await fetch('/api/admin/plans');
  const json = await res.json();
  if (!json.success) throw new Error('Failed to fetch plans');
  return json.data.map((plan: Record<string, unknown>) => ({
    ...plan,
    monthlyPrice: Number(plan.monthlyPrice),
    annualPrice: Number(plan.annualPrice),
  }));
}

export default function PlansClient({ initialPlans }: PlansClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SerializedPlan | undefined>(undefined);

  const { data: plans, refetch } = useQuery<SerializedPlan[]>({
    queryKey: ['admin', 'plans'],
    queryFn: fetchPlans,
    initialData: initialPlans,
  });

  const handleAdd = () => {
    setEditingPlan(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (plan: SerializedPlan) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    refetch();
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={handleAdd}>Add Plan</Button>
      </div>

      <div className="rounded-md border border-mist bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan Name</TableHead>
              <TableHead className="text-right">Monthly Price (LKR)</TableHead>
              <TableHead className="text-right">Annual Price (LKR)</TableHead>
              <TableHead className="text-right">Max Users</TableHead>
              <TableHead className="text-right">Max Variants</TableHead>
              <TableHead className="text-right">Active Subscribers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-mist">
                  No subscription plans found.
                </TableCell>
              </TableRow>
            )}
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium text-espresso">{plan.name}</TableCell>
                <TableCell className="text-right">{formatLKR(plan.monthlyPrice)}</TableCell>
                <TableCell className="text-right">{formatLKR(plan.annualPrice)}</TableCell>
                <TableCell className="text-right">{plan.maxUsers}</TableCell>
                <TableCell className="text-right">{plan.maxProductVariants}</TableCell>
                <TableCell className="text-right">{plan._count.subscriptions}</TableCell>
                <TableCell>
                  <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(plan)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PlanFormDialog
        key={editingPlan?.id ?? 'new'}
        existingPlan={editingPlan}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
