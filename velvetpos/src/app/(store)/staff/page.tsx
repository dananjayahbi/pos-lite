'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { CreateStaffSchema } from '@/lib/validators/staff.validators';
import type { CreateStaffInput } from '@/lib/validators/staff.validators';

// ── Types ────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  commissionRate: string | null;
  clockedInAt: string | null;
  createdAt: string;
}

// ── Role Badge ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-espresso text-pearl',
  MANAGER: 'bg-terracotta text-pearl',
  CASHIER: 'bg-sand text-espresso',
  STOCK_CLERK: 'bg-mist text-espresso',
};

const ASSIGNABLE_ROLES = ['OWNER', 'MANAGER', 'CASHIER', 'STOCK_CLERK'] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge className={`${ROLE_COLORS[role] ?? 'bg-mist text-espresso'} hover:opacity-90`}>
      {role.replace('_', ' ')}
    </Badge>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set('search', debouncedSearch);

  const { data, isLoading } = useQuery<{ success: boolean; data: StaffMember[] }>({
    queryKey: ['staff', debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/store/staff?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch staff');
      return res.json();
    },
  });

  const staff = data?.data ?? [];

  // ── Toggle Active ──────────────────────────────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/store/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message ?? 'Failed to update status');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Staff status updated');
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // ── Create Staff ───────────────────────────────────────────────────────────

  const form = useForm<CreateStaffInput>({
    resolver: standardSchemaResolver(CreateStaffSchema),
    defaultValues: {
      email: '',
      role: 'CASHIER' as const,
      commissionRate: undefined,
    },
  });

  const selectedRole = form.watch('role');

  const createMutation = useMutation({
    mutationFn: async (data: CreateStaffInput) => {
      const res = await fetch('/api/store/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message ?? 'Failed to create staff member');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Staff member created');
      form.reset();
      setDialogOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const onSubmit = useCallback(
    (data: CreateStaffInput) => createMutation.mutate(data),
    [createMutation],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-espresso">Staff</h1>
          <p className="text-sm text-sand mt-1">
            {isLoading ? '...' : `${staff.length} team member${staff.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Staff Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Create Staff Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="staff@example.com"
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-terracotta">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={form.watch('role')}
                  onValueChange={(val) => form.setValue('role', val as AssignableRole)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.role && (
                  <p className="text-sm text-terracotta">{form.formState.errors.role.message}</p>
                )}
              </div>

              {selectedRole === 'CASHIER' && (
                <div className="space-y-2">
                  <Label htmlFor="commissionRate">Commission Rate (%)</Label>
                  <Input
                    id="commissionRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="e.g. 5.00"
                    {...form.register('commissionRate')}
                  />
                  {form.formState.errors.commissionRate && (
                    <p className="text-sm text-terracotta">
                      {form.formState.errors.commissionRate.message}
                    </p>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Staff Member'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Table */}
      <div className="rounded-lg border border-sand/30 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Commission Rate</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-sand">
                  No staff members found
                </TableCell>
              </TableRow>
            ) : (
              staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={member.isActive}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: member.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {member.commissionRate !== null
                      ? `${Number(member.commissionRate).toFixed(2)}%`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/staff/${member.id}`}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
