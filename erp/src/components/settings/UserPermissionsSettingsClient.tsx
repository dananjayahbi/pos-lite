'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
  deniedPermissions,
  effectivePermissions,
  extraPermissions,
  isStaffPermissionDraftUnchanged,
  permissionPayloadToSave,
} from '@/lib/services/permissionSet.core';
import {
  getPermissionRisk,
  newHighRiskGrants,
} from '@/lib/services/permissionRisk.core';
import {
  filterPermissionGroups,
  grantGroupExtras,
  permissionLabel,
  resetGroupPermissions,
  summarizePermissionOverrides,
  type PermissionGridGroup,
} from '@/lib/services/permissionGrid.core';
import { resolveStaffRosterState } from '@/lib/services/staffRosterState.core';
import {
  filterStaffRoster,
  paginateStaffRoster,
} from '@/lib/services/staffRosterFilter.core';
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
  fullName?: string | null;
  role: AssignableRole;
  isActive: boolean;
  permissions: string[];
}

const ROSTER_PAGE_SIZE = 10;

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
  return permissionLabel(permission);
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
  // ARGUS #465: identity/scale - search, role/status filters and paging.
  const [rosterSearch, setRosterSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [rosterPage, setRosterPage] = useState(1);
  const [draftRole, setDraftRole] = useState<AssignableRole>('CASHIER');
  const [draftIsActive, setDraftIsActive] = useState(true);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  // ARGUS #464: role defaults the operator has revoked for this user.
  const [draftDenied, setDraftDenied] = useState<string[]>([]);
  // ARGUS #466: permission grid search and group collapse.
  const [permissionSearch, setPermissionSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
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

  // ARGUS #465: filter on the loaded roster. The list endpoint is small (one
  // tenant's staff), so local filtering keeps search instant and lets the same
  // view filter by status, which the API does not expose.
  const filteredStaff = filterStaffRoster(staff, {
    search: rosterSearch,
    role: roleFilter,
    status: statusFilter,
  });
  const rosterPageResult = paginateStaffRoster(filteredStaff, rosterPage, ROSTER_PAGE_SIZE);
  const pagedStaff = rosterPageResult.rows;
  const rosterPageCount = rosterPageResult.pageCount;
  const currentRosterPage = rosterPageResult.page;

  const grantable = grantablePermissions(actorRole);
  const assignableRoles = ASSIGNABLE_ROLES.filter((role) => canAssignRole(actorRole, role));

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingMember) {
        throw new Error('No team member selected');
      }

      // ARGUS #459/#464: persist the explicit extras and revokes relative to
      // the new role.
      const permissionEntries = permissionPayloadToSave(
        draftPermissions,
        draftRole,
        draftDenied,
      );

      const res = await fetch(`/api/store/staff/${editingMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: draftRole,
          isActive: draftIsActive,
          permissions: permissionEntries,
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

  // ARGUS #466: grouped grid, filtered by the search box, with a single dirty
  // decision shared by the Save button, the dirty badge and the close warning.
  const permissionGroups = useMemo<PermissionGridGroup[]>(
    () =>
      (Object.entries(PERMISSIONS) as Array<[string, Record<string, string>]>).map(
        ([group, entries]) => ({
          group,
          label: GROUP_LABELS[group as keyof typeof PERMISSIONS],
          permissions: Object.values(entries),
        }),
      ),
    [],
  );
  const visibleGroups = useMemo(
    () => filterPermissionGroups(permissionGroups, permissionSearch),
    [permissionGroups, permissionSearch],
  );
  const draftPayload = permissionPayloadToSave(draftPermissions, draftRole, draftDenied);
  const draftDirty =
    editingMember !== null &&
    !isStaffPermissionDraftUnchanged(
      {
        role: editingMember.role,
        isActive: editingMember.isActive,
        permissions: editingMember.permissions,
      },
      { role: draftRole, isActive: draftIsActive, permissions: draftPayload },
    );

  function toggleGroup(group: string) {
    setCollapsedGroups((current) =>
      current.includes(group)
        ? current.filter((entry) => entry !== group)
        : [...current, group],
    );
  }

  function applyGroupGrant(groupPermissions: readonly string[]) {
    const next = grantGroupExtras({
      permissions: draftPermissions,
      denied: draftDenied,
      groupPermissions,
      inherited: inheritedPermissions,
      grantable,
    });
    if (!next.changed) return;
    setDraftPermissions(next.permissions);
    setDraftDenied(next.denied);
  }

  function applyGroupReset(groupPermissions: readonly string[]) {
    const next = resetGroupPermissions({
      permissions: draftPermissions,
      denied: draftDenied,
      groupPermissions,
    });
    if (!next.changed) return;
    setDraftPermissions(next.permissions);
    setDraftDenied(next.denied);
  }

  function closeEditor() {
    if (draftDirty && !window.confirm('Discard unsaved permission changes?')) {
      return;
    }
    setEditingMember(null);
    setPendingHighRisk([]);
  }

  function openEditor(member: StaffMember) {
    setEditingMember(member);
    setDraftRole(member.role);
    setDraftIsActive(member.isActive);
    // Normalize on open: legacy rows may store inherited permissions too.
    setDraftPermissions(extraPermissions(member.permissions, member.role));
    setDraftDenied(deniedPermissions(member.permissions, member.role));
    setPermissionSearch('');
    setCollapsedGroups([]);
    setPendingHighRisk([]);
  }

  function togglePermission(permission: string) {
    if (!canAssignPermissions || !grantable.has(permission)) {
      return;
    }

    if (inheritedPermissions.has(permission as PermissionKey)) {
      // Inherited by the role: toggling writes/clears a revoke instead of a
      // grant, so one capability can be removed without changing the role.
      setDraftDenied((current) =>
        current.includes(permission)
          ? current.filter((entry) => entry !== permission)
          : [...current, permission],
      );
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
          permissions: permissionPayloadToSave(draftPermissions, draftRole, draftDenied),
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
      deniedPermissions(editingMember.permissions, editingMember.role),
    );
    const nextEffective = effectivePermissions(draftRole, draftPermissions, draftDenied);
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
            Role permissions stay inherited automatically. Add explicit extras for extra firepower, or revoke a single inherited capability for one user without changing the whole role.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Label htmlFor="roster-search" className="text-sm text-sand-ink">Search team</Label>
          <Input
            id="roster-search"
            type="search"
            value={rosterSearch}
            onChange={(event) => {
              setRosterSearch(event.target.value);
              setRosterPage(1);
            }}
            placeholder="Search by name or email..."
            className="mt-1 border-mist"
          />
        </div>
        <div className="w-44">
          <Label htmlFor="roster-role" className="text-sm text-sand-ink">Role</Label>
          <Select
            value={roleFilter}
            onValueChange={(value) => {
              setRoleFilter(value);
              setRosterPage(1);
            }}
          >
            <SelectTrigger id="roster-role" className="mt-1 border-mist">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              {ASSIGNABLE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Label htmlFor="roster-status" className="text-sm text-sand-ink">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setRosterPage(1);
            }}
          >
            <SelectTrigger id="roster-status" className="mt-1 border-mist">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

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
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Extra permissions</TableHead>
                  {canSave && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canSave ? 6 : 5} className="py-8 text-center text-sand-ink">
                      No team members match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-espresso" title={member.email}>
                          {member.fullName?.trim() || staffDisplayName(member.email)}
                        </p>
                        <p className="text-xs text-sand-ink">{ROLE_PERMISSIONS[member.role].length} inherited defaults</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-espresso">{member.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={member.role} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? 'default' : 'secondary'}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="max-w-56 text-xs text-espresso"
                      title={summarizePermissionOverrides(
                        member.permissions,
                        ROLE_PERMISSIONS[member.role],
                        50,
                      ).text}
                    >
                      {(() => {
                        const summary = summarizePermissionOverrides(
                          member.permissions,
                          ROLE_PERMISSIONS[member.role],
                        );
                        return (
                          <>
                            <span className="font-mono">
                              {summary.explicit.length} extra
                              {summary.revoked.length > 0 && (
                                <span className="text-terracotta">
                                  {' '}
                                  · {summary.revoked.length} revoked
                                </span>
                              )}
                            </span>
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-sand-ink">
                              {summary.text}
                            </p>
                          </>
                        );
                      })()}
                    </TableCell>
                    {canSave && (
                      <TableCell className="text-right">
                        {canManageStaffRole(actorRole, member.role) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Manage ${member.email}`}
                            onClick={() => openEditor(member)}
                          >
                            Manage
                          </Button>
                        ) : (
                          <span className="text-xs text-sand-ink">Above your role</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {rosterState === 'ready' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-sand-ink">
          <p>
            Showing {pagedStaff.length} of {filteredStaff.length} team member
            {filteredStaff.length === 1 ? '' : 's'}
            {filteredStaff.length !== staff.length ? ` (of ${staff.length})` : ''}
          </p>
          {rosterPageCount > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-mist"
                disabled={currentRosterPage <= 1}
                onClick={() => setRosterPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <span>
                Page {currentRosterPage} of {rosterPageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="border-mist"
                disabled={currentRosterPage >= rosterPageCount}
                onClick={() => setRosterPage((page) => Math.min(rosterPageCount, page + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {!canSave && (
        <p className="text-sm text-sand-ink">
          You can view the team directory. Changing roles, status or permissions requires
          {canManage ? ' the permission-assignment key.' : ' staff management and permission-assignment keys.'}
        </p>
      )}

      <Dialog open={editingMember !== null} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">
              {editingMember ? `Manage ${editingMember.email}` : 'Manage user'}
            </DialogTitle>
            <DialogDescription>
              {editingMember
                ? `${editingMember.fullName?.trim() || staffDisplayName(editingMember.email)} · role and explicit permission overrides`
                : 'Role and explicit permission overrides'}
            </DialogDescription>
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
                <p className="mt-2">Uncheck an inherited permission to revoke it for this user only. Extras and revokes are stored separately so the role stays clean.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-48 flex-1">
                    <Label htmlFor="permission-search" className="text-sm text-sand-ink">
                      Search permissions
                    </Label>
                    <Input
                      id="permission-search"
                      type="search"
                      value={permissionSearch}
                      onChange={(event) => setPermissionSearch(event.target.value)}
                      placeholder="Search by name or key..."
                      className="mt-1 border-mist"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-mist"
                    onClick={() =>
                      setCollapsedGroups(
                        collapsedGroups.length === permissionGroups.length
                          ? []
                          : permissionGroups.map((group) => group.group),
                      )
                    }
                  >
                    {collapsedGroups.length === permissionGroups.length
                      ? 'Expand all'
                      : 'Collapse all'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-mist"
                    disabled={!canAssignPermissions}
                    onClick={() => {
                      setDraftPermissions([]);
                      setDraftDenied([]);
                    }}
                  >
                    Reset extras
                  </Button>
                </div>

                <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
                  {visibleGroups.length === 0 ? (
                    <p className="rounded-md border border-mist p-4 text-sm text-sand-ink">
                      No permissions match “{permissionSearch}”.
                    </p>
                  ) : (
                    visibleGroups.map((group) => {
                      const collapsed = collapsedGroups.includes(group.group);
                      return (
                        <div key={group.group} className="rounded-lg border border-mist p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.group)}
                              aria-expanded={!collapsed}
                              className="flex items-center gap-1.5 font-display text-lg text-espresso"
                            >
                              <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
                              {group.label}
                              <span className="text-xs font-normal text-sand-ink">
                                ({group.permissions.length})
                              </span>
                            </button>
                            {canAssignPermissions && (
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-espresso"
                                  onClick={() => applyGroupGrant(group.permissions)}
                                >
                                  Grant all
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-sand-ink"
                                  onClick={() => applyGroupReset(group.permissions)}
                                >
                                  Reset
                                </Button>
                              </div>
                            )}
                          </div>
                          {!collapsed && (
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              {group.permissions.map((permission) => {
                        const inherited = inheritedPermissions.has(permission as PermissionKey);
                        const revoked = inherited && draftDenied.includes(permission);
                        const explicit = !inherited && draftPermissions.includes(permission);
                        const checked = inherited ? !revoked : explicit;
                        const risk = getPermissionRisk(permission);
                        const grantableHere = canAssignPermissions && grantable.has(permission);
                        const disabled = !grantableHere;

                        return (
                          <label
                            key={permission}
                            title={risk.reason ?? undefined}
                            className={`flex items-start gap-3 rounded-md border p-3 ${
                              revoked
                                ? 'border-terracotta/40 bg-terracotta/5'
                                : inherited
                                  ? 'border-espresso/20 bg-pearl/50'
                                  : risk.highRisk
                                    ? 'border-[#9B2226]/40 bg-[#9B2226]/5'
                                    : 'border-mist bg-white'
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              aria-label={`${formatPermissionLabel(permission)} (${permission})`}
                              onCheckedChange={() => togglePermission(permission)}
                            />
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-espresso">{formatPermissionLabel(permission)}</p>
                                {revoked ? (
                                  <Badge variant="secondary" className="bg-terracotta text-pearl">
                                    Revoked
                                  </Badge>
                                ) : inherited ? (
                                  <Badge variant="secondary" className="bg-espresso text-pearl">Inherited</Badge>
                                ) : explicit ? (
                                  <Badge variant="secondary">Explicit</Badge>
                                ) : null}
                                {risk.highRisk && (
                                  <Badge className="bg-[#9B2226] text-white hover:bg-[#9B2226]">
                                    High risk
                                  </Badge>
                                )}
                                {!grantableHere && (
                                  <Badge variant="secondary">Not grantable by your role</Badge>
                                )}
                              </div>
                              <p className="mt-1 font-mono text-[11px] text-sand-ink">{permission}</p>
                              {inherited && !revoked && (
                                <p className="mt-1 text-[11px] text-sand-ink">
                                  Inherited from the role - uncheck to revoke just this capability.
                                </p>
                              )}
                              {revoked && (
                                <p className="mt-1 text-[11px] text-terracotta">
                                  Revoked for this user only; the role itself is unchanged.
                                </p>
                              )}
                              {risk.highRisk && risk.reason && (
                                <p className="mt-1 text-[11px] text-[#9B2226]">{risk.reason}</p>
                              )}
                            </div>
                          </label>
                        );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {draftDirty && (
                    <Badge variant="secondary" className="bg-sand text-espresso">
                      Unsaved changes
                    </Badge>
                  )}
                  <Button variant="outline" onClick={closeEditor}>
                    Cancel
                  </Button>
                  <Button
                    onClick={requestSave}
                    disabled={updateMutation.isPending || !canSave || !draftDirty}
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
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
            {pendingHighRisk.length === 1 ? '' : 's'} to {editingMember ? editingMember.email : 'this user'}:
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
