'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ASSIGNABLE_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type AssignableRole,
  type PermissionKey,
} from '@/lib/constants/permissions';
import { grantablePermissions, canAssignRole, canManageStaffRole } from '@/lib/auth/staff-authorization';
import {
  effectivePermissions,
  extraPermissions,
  isStaffPermissionDraftUnchanged,
} from '@/lib/services/permissionSet.core';
import {
  getPermissionRisk,
  newHighRiskGrants,
} from '@/lib/services/permissionRisk.core';
import { resolveStaffRosterState } from '@/lib/services/staffRosterState.core';
import { staffDisplayName } from '@/lib/utils/staff-name';

/**
 * Team & Permissions editor.
 *
 * ARGUS #459: the table and editor show EXPLICIT extras (stored permissions
 * minus role defaults), and Save is a no-op when the normalized extras and the
 * role/status are unchanged - no sessionVersion bump, audit row or logout.
 * ARGUS #460: controls only render when the actor holds the same keys the PATCH
 * route requires.
 * ARGUS #461: high-risk keys are badged, non-grantable keys are disabled, and
 * newly granted high-risk keys need an explicit confirmation.
 * ARGUS #462: loading/error/empty/ready are distinct; error is never "empty".
 */

interface StaffMember {
  id: string;
  email: string;
  role: AssignableRole;
  isActive: boolean;
  permissions: string[];
}

const ROLE_COLORS: Record<AssignableRole, string> = {
  OWNER: 'bg-espresso text-pearl',
  MANAGER: 'bg-terracotta text-pearl',
  CASHIER: 'bg-sand text-espresso',
  STOCK_CLERK: 'bg-mist text-espresso',
  DISPATCH_STAFF: 'bg-pearl text-espresso',
  FACTORY_MANAGER: 'bg-mist text-espresso',
};

const GROUP_LABELS: Record<keyof typeof PERMISSIONS, string> = {
  SALE: 'Sales',
  DISCOUNT: 'Discounts',
  PRODUCT: 'Products',
  CUSTOMER: 'Customers',
  BROADCAST: 'Broadcast',
  STOCK: 'Stock',
  SUPPLIER: 'Suppliers',
  STAFF: 'Staff',
  PAYROLL: 'Payroll',
  REPORT: 'Reports',
  SETTINGS: 'Settings',
  PROMOTION: 'Promotions',
  BILLING: 'Billing',
  EXPENSE: 'Expenses',
  PETTY_CASH: 'Petty Cash',
  PAYMENT_ACCOUNT: 'Payment Accounts',
  APPOINTMENT: 'Appointments',
  DELIVERY: 'Delivery & Courier',
  RAW_MATERIAL: 'Raw Materials',
  FACTORY: 'Factory',
  BOM: 'Bill of Materials',
  RAW_MATERIAL_ALERT: 'Raw Material Alerts',
  BATCH: 'Batches & Expiry',
};

function formatPermissionLabel(permission: string) {
  return permission.split(':').slice(1).join(' ').replace(/_/g, ' ');
}

function RoleBadge({ role }: { role: AssignableRole }) {
  return <Badge className={ROLE_COLORS[role]}>{role.replace(/_/g, ' ')}</Badge>;
}

interface UserPermissionsSettingsClientProps {
  canManage: boolean;
  canAssignPermissions: boolean;
  canSave: boolean;
  actorRole: string;
}

export default function UserPermissionsSettingsClient({
  canManage,
  canAssignPermissions,
  canSave,
  actorRole,
}: UserPermissionsSettingsClientProps) {
  const queryClient = useQueryClient();
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [draftRole, setDraftRole] = useState<AssignableRole>('CASHIER');
  const [draftIsActive, setDraftIsActive] = useState(true);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [pendingHighRisk, setPendingHighRisk] = useState<
    Array<{ permission: string; reason: string }>
  >([]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    success: boolean;
    data: StaffMember[];
  }>({
    queryKey: ['staff', 'settings-users'],
    queryFn: async () => {
      const res = await fetch('/api/store/staff');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Failed to fetch team members (${res.status})`);
      }
      return res.json();
    },
  });

  const staff = data?.data ?? [];
  const rosterState = resolveStaffRosterState({
    isLoading,
    isError,
    rowCount: staff.length,
  });

  const grantable = grantablePermissions(actorRole);
  const assignableRoles = ASSIGNABLE_ROLES.filter((role) => canAssignRole(actorRole, role));

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingMember) {
        throw new Error('No team member selected');
      }

      // ARGUS #459: persist only the explicit extras relative to the new role.
      const explicitPermissions = extraPermissions(draftPermissions, draftRole);

      const res = await fetch(`/api/store/staff/${editingMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: draftRole,
          isActive: draftIsActive,
          permissions: explicitPermissions,
        }),
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to update permissions');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('User permissions updated');
      setEditingMember(null);
      setPendingHighRisk([]);
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message);
      setPendingHighRisk([]);
    },
  });

  const inheritedPermissions = new Set(ROLE_PERMISSIONS[draftRole]);

  function openEditor(member: StaffMember) {
    setEditingMember(member);
    setDraftRole(member.role);
    setDraftIsActive(member.isActive);
    // Normalize on open: legacy rows may store inherited permissions too.
    setDraftPermissions(extraPermissions(member.permissions, member.role));
    setPendingHighRisk([]);
  }

  function togglePermission(permission: string) {
    if (inheritedPermissions.has(permission as PermissionKey)) {
      return;
    }
    if (!canAssignPermissions || !grantable.has(permission)) {
      return;
    }

    setDraftPermissions((current) =>
      current.includes(permission)
        ? current.filter((entry) => entry !== permission)
        : [...current, permission],
    );
  }

  function requestSave() {
    if (!editingMember) return;

    // ARGUS #459: no-op saves must not PATCH (which bumps sessionVersion and
    // writes an audit row even when nothing changed).
    if (
      isStaffPermissionDraftUnchanged(
        {
          role: editingMember.role,
          isActive: editingMember.isActive,
          permissions: editingMember.permissions,
        },
        {
          role: draftRole,
          isActive: draftIsActive,
          permissions: draftPermissions,
        },
      )
    ) {
      toast.info('No changes to save.');
      setEditingMember(null);
      return;
    }

    // Compare EFFECTIVE permissions: promoting a role can implicitly grant a
    // high-risk inherited key even when the explicit extras do not change.
    const existingEffective = effectivePermissions(
      editingMember.role,
      editingMember.permissions,
    );
    const nextEffective = effectivePermissions(draftRole, draftPermissions);
    const highRisk = newHighRiskGrants(existingEffective, nextEffective);
    if (highRisk.length > 0) {
      setPendingHighRisk(highRisk);
      return;
    }

    updateMutation.mutate();
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Team &amp; permissions</h1>
        <p className="mt-1 text-sm text-sand-ink">
          Adjust roles, keep accounts active, and grant extra permissions on top of each role's defaults.
        </p>
      </div>

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Permission model</CardTitle>
          <CardDescription>
            Role permissions stay inherited automatically. The controls below only add explicit overrides when someone needs a little extra firepower.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-mist">
        <CardContent className="p-0">
          {rosterState === 'loading' ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : rosterState === 'error' ? (
            <div className="p-6">
              <p className="text-sm text-[#9B2226]">
                Team members could not be loaded.{' '}
                {error instanceof Error ? error.message : 'Try again.'}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? 'Retrying...' : 'Retry'}
              </Button>
            </div>
          ) : rosterState === 'empty' ? (
            <div className="p-8 text-center text-sm text-sand-ink">
              No team members yet. Create a staff member from the Staff page.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Extra permissions</TableHead>
                  {canSave && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-espresso" title={member.email}>{staffDisplayName(member.email)}</p>
                        <p className="text-xs text-sand-ink">{ROLE_PERMISSIONS[member.role].length} inherited defaults</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={member.role} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? 'default' : 'secondary'}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-espresso">
                      {extraPermissions(member.permissions, member.role).length}
                    </TableCell>
                    {canSave && (
                      <TableCell className="text-right">
                        {canManageStaffRole(actorRole, member.role) ? (
                          <Button variant="outline" size="sm" onClick={() => openEditor(member)}>
                            Manage
                          </Button>
                        ) : (
                          <span className="text-xs text-sand-ink">Above your role</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!canSave && (
        <p className="text-sm text-sand-ink">
          You can view the team directory. Changing roles, status or permissions requires
          {canManage ? ' the permission-assignment key.' : ' staff management and permission-assignment keys.'}
        </p>
      )}

      <Dialog open={editingMember !== null} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">
              {editingMember ? `Manage ${staffDisplayName(editingMember.email)}` : 'Manage user'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="space-y-4 rounded-lg border border-mist bg-pearl/50 p-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={draftRole} onValueChange={(value) => setDraftRole(value as AssignableRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-md border border-mist bg-white px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-espresso">Active account</p>
                  <p className="text-xs text-sand-ink">Inactive users cannot operate the store.</p>
                </div>
                <Switch checked={draftIsActive} onCheckedChange={setDraftIsActive} />
              </div>

              <div className="rounded-md border border-mist bg-white p-3 text-xs text-sand-ink">
                <p className="font-semibold text-espresso">Inherited permissions</p>
                <p className="mt-1">{ROLE_PERMISSIONS[draftRole].length} permissions come from the selected role automatically.</p>
                <p className="mt-2">Explicit overrides are stored separately so you can keep the role clean and only sprinkle extras where necessary.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
                {Object.entries(PERMISSIONS).map(([groupName, groupPermissions]) => (
                  <div key={groupName} className="rounded-lg border border-mist p-4">
                    <h3 className="font-display text-lg text-espresso">{GROUP_LABELS[groupName as keyof typeof PERMISSIONS]}</h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {Object.values(groupPermissions).map((permission) => {
                        const inherited = inheritedPermissions.has(permission as PermissionKey);
                        const checked = inherited || draftPermissions.includes(permission);
                        const risk = getPermissionRisk(permission);
                        const grantableHere = canAssignPermissions && grantable.has(permission);
                        const disabled = inherited || !grantableHere;

                        return (
                          <label
                            key={permission}
                            title={risk.reason ?? undefined}
                            className={`flex items-start gap-3 rounded-md border p-3 ${
                              inherited
                                ? 'border-espresso/20 bg-pearl/50'
                                : risk.highRisk
                                  ? 'border-[#9B2226]/40 bg-[#9B2226]/5'
                                  : 'border-mist bg-white'
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={() => togglePermission(permission)}
                            />
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-espresso">{formatPermissionLabel(permission)}</p>
                                {inherited ? (
                                  <Badge variant="secondary" className="bg-espresso text-pearl">Inherited</Badge>
                                ) : checked ? (
                                  <Badge variant="secondary">Explicit</Badge>
                                ) : null}
                                {risk.highRisk && (
                                  <Badge className="bg-[#9B2226] text-white hover:bg-[#9B2226]">
                                    High risk
                                  </Badge>
                                )}
                                {!inherited && !grantableHere && (
                                  <Badge variant="secondary">Not grantable by your role</Badge>
                                )}
                              </div>
                              <p className="mt-1 font-mono text-[11px] text-sand-ink">{permission}</p>
                              {risk.highRisk && risk.reason && (
                                <p className="mt-1 text-[11px] text-[#9B2226]">{risk.reason}</p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingMember(null)}>
                  Cancel
                </Button>
                <Button onClick={requestSave} disabled={updateMutation.isPending || !canSave}>
                  {updateMutation.isPending ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingHighRisk.length > 0}
        onOpenChange={(open) => {
          if (!open) setPendingHighRisk([]);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">
              Confirm high-risk permission{pendingHighRisk.length === 1 ? '' : 's'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-sand-ink">
            You are about to grant {pendingHighRisk.length} high-risk permission
            {pendingHighRisk.length === 1 ? '' : 's'} to {editingMember ? staffDisplayName(editingMember.email) : 'this user'}:
          </p>
          <ul className="space-y-2">
            {pendingHighRisk.map((entry) => (
              <li key={entry.permission} className="rounded-md border border-[#9B2226]/30 bg-[#9B2226]/5 p-3">
                <p className="font-mono text-xs text-espresso">{entry.permission}</p>
                <p className="mt-1 text-xs text-sand-ink">{entry.reason}</p>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingHighRisk([])}>
              Cancel
            </Button>
            <Button
              className="bg-[#9B2226] text-white hover:bg-[#9B2226]/90"
              onClick={() => {
                setPendingHighRisk([]);
                updateMutation.mutate();
              }}
              disabled={updateMutation.isPending}
            >
              Grant and save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
