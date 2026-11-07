'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { ASSIGNABLE_ROLES, type AssignableRole } from '@/lib/constants/permissions';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { staffDisplayName } from '@/lib/utils/staff-name';

// ── Types ────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  fullName: string | null;
  contactNumber: string | null;
  commissionRate: string | null;
  clockedInAt: string | null;
  createdAt: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sand-ink">{children}</p>
  );
}

// ── Role Badge ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-espresso text-pearl',
  MANAGER: 'bg-terracotta text-pearl',
  CASHIER: 'bg-sand text-espresso',
  STOCK_CLERK: 'bg-mist text-espresso',
  // M03-01 (BUG-3): DISPATCH_STAFF was missing here — the badge fell back to
  // the default while the role itself was rejected by the API validator.
  DISPATCH_STAFF: 'bg-pearl text-espresso',
  FACTORY_MANAGER: 'bg-mist text-espresso',
};

// M03-01 (BUG-3): single source of truth — the same constant the API
// validator and the settings editor use, so the two screens cannot disagree.
// (SUPER_ADMIN stays excluded — escalation guard, tests/03 8.7/8.8.)

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
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  // M03-08 (GAP-2): optional initial password for the create dialog.
  const [initialPassword, setInitialPassword] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set('search', debouncedSearch);
  if (roleFilter !== 'ALL') queryParams.set('role', roleFilter);

  const { data, isLoading } = useQuery<{ success: boolean; data: StaffMember[] }>({
    queryKey: ['staff', debouncedSearch, roleFilter],
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
      return res.json() as Promise<{ success: boolean; data: { id: string } }>;
    },
    onSuccess: async (created) => {
      // M03-08 (GAP-2): created accounts get an unusable random password
      // server-side; if the operator supplied an initial password, set it
      // through the dedicated route (bumps sessionVersion + audits).
      const password = initialPassword.trim();
      if (password && created?.data?.id) {
        const pwRes = await fetch(`/api/store/staff/${created.data.id}/password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword: password }),
        });
        if (!pwRes.ok) {
          const err = await pwRes.json().catch(() => null);
          toast.warning(
            'Staff created, but the initial password was NOT set: ' +
              (err?.error?.message ?? 'unknown error'),
          );
        } else {
          toast.success('Staff member created with an initial password');
        }
      } else {
        toast.success('Staff member created (no password set — set one before first sign-in)');
      }
      setInitialPassword('');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
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
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-espresso">Staff</h1>
          <p className="text-sm text-sand-ink mt-1">
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
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-display">Create Staff Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Personal & access */}
              <div className="space-y-3">
                <SectionLabel>Personal &amp; access</SectionLabel>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="e.g. Nimal Perera"
                    {...form.register('fullName')}
                  />
                  {form.formState.errors.fullName && (
                    <p className="text-sm text-terracotta">
                      {form.formState.errors.fullName.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="staff@example.com"
                      {...form.register('email')}
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-terracotta">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={form.watch('role')}
                      onValueChange={(val) => form.setValue('role', val as AssignableRole)}
                    >
                      <SelectTrigger id="role">
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
                      <p className="text-sm text-terracotta">
                        {form.formState.errors.role.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nic">NIC</Label>
                    <Input
                      id="nic"
                      placeholder="e.g. 912345678V / 199912345678"
                      {...form.register('nic')}
                    />
                    {form.formState.errors.nic && (
                      <p className="text-sm text-terracotta">{form.formState.errors.nic.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactNumber">Contact Number</Label>
                    <Input
                      id="contactNumber"
                      placeholder="+94XXXXXXXXX"
                      {...form.register('contactNumber')}
                    />
                    {form.formState.errors.contactNumber && (
                      <p className="text-sm text-terracotta">
                        {form.formState.errors.contactNumber.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    placeholder="Street, city, postal code"
                    rows={2}
                    {...form.register('address')}
                  />
                  {form.formState.errors.address && (
                    <p className="text-sm text-terracotta">
                      {form.formState.errors.address.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="initialPassword">System Access Password</Label>
                    <Input
                      id="initialPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                    />
                    <p className="text-xs text-sand-ink">
                      Optional now; the account cannot sign in until a password is set.
                    </p>
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
                </div>
              </div>

              {/* Salary & allowances */}
              <div className="space-y-3 border-t border-mist pt-4">
                <SectionLabel>Salary &amp; allowances</SectionLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="basicSalary">Basic Salary (LKR)</Label>
                    <Input
                      id="basicSalary"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 45000.00"
                      {...form.register('basicSalary')}
                    />
                    <p className="text-xs text-sand-ink">Used for ETF/EPF calculations.</p>
                    {form.formState.errors.basicSalary && (
                      <p className="text-sm text-terracotta">
                        {form.formState.errors.basicSalary.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="allowances">Allowances (LKR)</Label>
                    <Input
                      id="allowances"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 5000.00"
                      {...form.register('allowances')}
                    />
                    {form.formState.errors.allowances && (
                      <p className="text-sm text-terracotta">
                        {form.formState.errors.allowances.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Banking & statutory */}
              <div className="space-y-3 border-t border-mist pt-4">
                <SectionLabel>Banking &amp; statutory</SectionLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input id="bankName" placeholder="e.g. Commercial Bank" {...form.register('bankName')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankBranch">Branch</Label>
                    <Input id="bankBranch" placeholder="e.g. Colombo 03" {...form.register('bankBranch')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAccountNumber">Account Number</Label>
                    <Input
                      id="bankAccountNumber"
                      placeholder="Bank account number"
                      {...form.register('bankAccountNumber')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="etfNumber">ETF Number</Label>
                    <Input id="etfNumber" placeholder="ETF number" {...form.register('etfNumber')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="epfNumber">EPF Number</Label>
                    <Input id="epfNumber" placeholder="EPF number" {...form.register('epfNumber')} />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Staff Member'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            {ASSIGNABLE_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {role.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || roleFilter !== 'ALL') && (
          <Button
            variant="ghost"
            size="sm"
            className="text-sand-ink hover:text-espresso"
            onClick={() => {
              setSearch('');
              setRoleFilter('ALL');
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <ErrorBoundary>
      <div className="rounded-lg border border-sand/30 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Number</TableHead>
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
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-sand-ink">
                  No staff members found
                </TableCell>
              </TableRow>
            ) : (
              staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.fullName ?? staffDisplayName(member.email)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {member.contactNumber ?? '—'}
                  </TableCell>
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
      </ErrorBoundary>
    </div>
  );
}
