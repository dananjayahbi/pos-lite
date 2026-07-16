'use client';

import { useState, useCallback, useEffect, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { ArrowLeft, LogOut, Pencil, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { UpdateStaffSchema } from '@/lib/validators/staff.validators';
import { PinSchema } from '@/lib/validators/pin.validators';
import { formatRupee } from '@/lib/format';
import { TimeClockHistoryPanel } from '@/components/staff/TimeClockHistoryPanel';
import type { UpdateStaffInput } from '@/lib/validators/staff.validators';
import type { PinInput } from '@/lib/validators/pin.validators';


// ── Types ────────────────────────────────────────────────────────────────────

interface StaffDetail {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  commissionRate: string | null;
  clockedInAt: string | null;
  createdAt: string;
  hasPinSet: boolean;
}

type Tab = 'profile' | 'pin' | 'commission' | 'timeclock';

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

// ── PIN Management Section ───────────────────────────────────────────────────

function PinManagement({
  staffId,
  hasPinSet,
  sessionRole,
}: {
  staffId: string;
  hasPinSet: boolean;
  sessionRole: string;
}) {
  const queryClient = useQueryClient();

  if (sessionRole !== 'MANAGER' && sessionRole !== 'OWNER') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display text-espresso">PIN Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sand text-sm">
            Only Managers and Owners can manage staff PINs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-display text-espresso">PIN Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {hasPinSet ? (
            <>
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                PIN is set
              </Badge>
            </>
          ) : (
            <>
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                No PIN assigned
              </Badge>
            </>
          )}
        </div>

        <PinForm staffId={staffId} onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
        }} />
      </CardContent>
    </Card>
  );
}

function PinForm({ staffId, onSuccess }: { staffId: string; onSuccess: () => void }) {
  const form = useForm<PinInput>({
    resolver: standardSchemaResolver(PinSchema),
    defaultValues: { newPin: '', confirmPin: '' },
  });

  const mutation = useMutation({
    mutationFn: async (data: PinInput) => {
      const res = await fetch(`/api/store/staff/${staffId}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin: data.newPin }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message ?? 'Failed to update PIN');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('PIN updated successfully');
      form.reset();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4 max-w-sm">
      <div className="space-y-2">
        <Label htmlFor="newPin">New PIN</Label>
        <Input
          id="newPin"
          type="password"
          inputMode="numeric"
          placeholder="Enter 4–8 digit PIN"
          maxLength={8}
          {...form.register('newPin')}
        />
        {form.formState.errors.newPin && (
          <p className="text-sm text-terracotta">{form.formState.errors.newPin.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPin">Confirm PIN</Label>
        <Input
          id="confirmPin"
          type="password"
          inputMode="numeric"
          placeholder="Re-enter PIN"
          maxLength={8}
          {...form.register('confirmPin')}
        />
        {form.formState.errors.confirmPin && (
          <p className="text-sm text-terracotta">{form.formState.errors.confirmPin.message}</p>
        )}
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Updating...' : 'Set PIN'}
      </Button>
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StaffDetailPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const { staffId } = use(params);
  const queryClient = useQueryClient();
  const { data: sessionData } = useSession();

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; data: StaffDetail }>({
    queryKey: ['staff-detail', staffId],
    queryFn: async () => {
      const res = await fetch(`/api/store/staff/${staffId}`);
      if (!res.ok) throw new Error('Failed to fetch staff member');
      return res.json();
    },
  });

  const staffMember = data?.data;

  const handleSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
    queryClient.invalidateQueries({ queryKey: ['staff'] });
  }, [queryClient, staffId]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'pin', label: 'PIN Management' },
    { key: 'commission', label: 'Commission History' },
    { key: 'timeclock', label: 'Time Clock' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!staffMember) {
    return (
      <div className="text-center py-20 text-sand">
        <p>Staff member not found</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/staff">Back to Staff</Link>
        </Button>
      </div>
    );
  }

  const sessionRole = (sessionData?.user?.role as string) ?? '';
  const sessionUserId = sessionData?.user?.id ?? '';

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Breadcrumb */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/staff">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Staff
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold text-espresso truncate">
              {staffMember.email}
            </h1>
            <RoleBadge role={staffMember.role} />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-sand/30">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.key
                ? 'border-terracotta text-terracotta'
                : 'border-transparent text-sand hover:text-espresso'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <ProfileTab
          staffMember={staffMember}
          editOpen={editOpen}
          setEditOpen={setEditOpen}
          onSuccess={handleSuccess}
          canForceLogout={sessionRole === 'OWNER' && sessionUserId !== staffMember.id}
        />
      )}

      {activeTab === 'pin' && (
        <PinManagement
          staffId={staffId}
          hasPinSet={staffMember.hasPinSet}
          sessionRole={sessionRole}
        />
      )}

      {activeTab === 'commission' && (
        <CommissionHistory staffId={staffId} />
      )}

      {activeTab === 'timeclock' && (
        <TimeClockHistoryPanel staffId={staffId} title="Time Clock" />
      )}
    </div>
  );
}

// ── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({
  staffMember,
  editOpen,
  setEditOpen,
  onSuccess,
  canForceLogout,
}: {
  staffMember: StaffDetail;
  editOpen: boolean;
  setEditOpen: (open: boolean) => void;
  onSuccess: () => void;
  canForceLogout: boolean;
}) {
  const [forceLogoutOpen, setForceLogoutOpen] = useState(false);
  const [isForceLoggingOut, setIsForceLoggingOut] = useState(false);

  const handleForceLogout = useCallback(async () => {
    setIsForceLoggingOut(true);
    try {
      const res = await fetch(`/api/admin/users/${staffMember.id}/force-logout`, {
        method: 'POST',
      });
      const json = (await res.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      if (!res.ok) {
        toast.error(json?.error ?? 'Failed to force logout user');
        return;
      }

      toast.success(json?.message ?? 'User sessions have been invalidated.');
      setForceLogoutOpen(false);
    } catch {
      toast.error('Failed to force logout user');
    } finally {
      setIsForceLoggingOut(false);
    }
  }, [staffMember.id]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {canForceLogout && (
          <Button
            variant="outline"
            size="sm"
            className="border-terracotta/40 text-terracotta hover:text-terracotta"
            onClick={() => setForceLogoutOpen(true)}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Force Logout
          </Button>
        )}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit Profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Edit Staff Member</DialogTitle>
            </DialogHeader>
            <EditStaffForm
              staffMember={staffMember}
              onSuccess={() => {
                setEditOpen(false);
                onSuccess();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-body text-sand uppercase tracking-wide">
              Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-espresso font-medium">{staffMember.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-body text-sand uppercase tracking-wide">
              Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RoleBadge role={staffMember.role} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-body text-sand uppercase tracking-wide">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={staffMember.isActive ? 'default' : 'secondary'}>
              {staffMember.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-body text-sand uppercase tracking-wide">
              Commission Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-espresso font-mono">
              {staffMember.commissionRate !== null
                ? `${Number(staffMember.commissionRate).toFixed(2)}%`
                : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-body text-sand uppercase tracking-wide">
              Clocked In
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staffMember.clockedInAt ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                Since{' '}
                {new Date(staffMember.clockedInAt).toLocaleTimeString('en-LK', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Badge>
            ) : (
              <span className="text-sand text-sm">Not clocked in</span>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={forceLogoutOpen} onOpenChange={setForceLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Force Logout User</DialogTitle>
            <DialogDescription>
              This will immediately invalidate all active sessions for {staffMember.email}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setForceLogoutOpen(false)}
              disabled={isForceLoggingOut}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleForceLogout();
              }}
              disabled={isForceLoggingOut}
            >
              {isForceLoggingOut ? 'Invalidating…' : 'Force Logout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Edit Staff Form ──────────────────────────────────────────────────────────

function EditStaffForm({
  staffMember,
  onSuccess,
}: {
  staffMember: StaffDetail;
  onSuccess: () => void;
}) {
  const form = useForm<UpdateStaffInput>({
    resolver: standardSchemaResolver(UpdateStaffSchema),
    defaultValues: {
      email: staffMember.email,
      role: staffMember.role as AssignableRole,
      isActive: staffMember.isActive,
      commissionRate: staffMember.commissionRate ?? undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: UpdateStaffInput) => {
      const res = await fetch(`/api/store/staff/${staffMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message ?? 'Failed to update staff member');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Staff member updated');
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-email">Email</Label>
        <Input id="edit-email" type="email" {...form.register('email')} />
        {form.formState.errors.email && (
          <p className="text-sm text-terracotta">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-role">Role</Label>
        <Select
          value={form.watch('role') ?? ''}
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-commission">Commission Rate (%)</Label>
        <Input
          id="edit-commission"
          type="number"
          step="0.01"
          min="0"
          max="100"
          placeholder="e.g. 5.00"
          {...form.register('commissionRate')}
        />
      </div>

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  );
}

// ── Commission History ───────────────────────────────────────────────────────

interface CommissionRecord {
  id: string;
  saleId: string;
  baseAmount: string;
  commissionRate: string;
  earnedAmount: string;
  isPaid: boolean;
  createdAt: string;
  sale: { id: string; totalAmount: string; createdAt: string };
  payout: { id: string; paidAt: string } | null;
}

interface CommissionData {
  records: CommissionRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function CommissionHistory({ staffId }: { staffId: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery<{ success: boolean; data: CommissionData }>({
    queryKey: ['staff-commissions', staffId, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/store/staff/${staffId}/commissions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch commissions');
      return res.json();
    },
  });

  const commissions = data?.data;

  // Summary calculations
  const totalEarned = commissions?.records.reduce(
    (sum, r) => sum + Number(r.earnedAmount),
    0,
  ) ?? 0;
  const totalPaid = commissions?.records
    .filter((r) => r.isPaid)
    .reduce((sum, r) => sum + Number(r.earnedAmount), 0) ?? 0;
  const unpaid = totalEarned - totalPaid;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display text-espresso">Commission History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary" className="gap-1 text-xs">
              Total Earned: {formatRupee(totalEarned)}
            </Badge>
            <Badge variant="secondary" className="gap-1 text-xs bg-green-100 text-green-800">
              Total Paid: {formatRupee(totalPaid)}
            </Badge>
            <Badge variant="secondary" className="gap-1 text-xs bg-amber-100 text-amber-800">
              Unpaid: {formatRupee(unpaid)}
            </Badge>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !commissions?.records.length ? (
            <p className="text-sand text-sm py-4 text-center">No commission records found.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Base Amount</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Earned</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">
                        {r.saleId.slice(0, 8)}…
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(r.createdAt).toLocaleDateString('en-LK')}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatRupee(r.baseAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(r.commissionRate).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatRupee(r.earnedAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            Number(r.earnedAmount) >= 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {Number(r.earnedAmount) >= 0 ? 'Credit' : 'Debit'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            r.isPaid
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }
                        >
                          {r.isPaid ? 'Paid' : 'Unpaid'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {commissions.totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-sand self-center">
                    Page {page} of {commissions.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= commissions.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Time Clock History ───────────────────────────────────────────────────────

