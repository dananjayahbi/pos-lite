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
  ALL_PERMISSIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type PermissionKey,
} from '@/lib/constants/permissions';

type AssignableRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'STOCK_CLERK';

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
};

const ASSIGNABLE_ROLES: AssignableRole[] = ['OWNER', 'MANAGER', 'CASHIER', 'STOCK_CLERK'];

const GROUP_LABELS: Record<keyof typeof PERMISSIONS, string> = {
  SALE: 'Sales',
  DISCOUNT: 'Discounts',
  PRODUCT: 'Products',
  CUSTOMER: 'Customers',
  STOCK: 'Stock',
  SUPPLIER: 'Suppliers',
  STAFF: 'Staff',
  REPORT: 'Reports',
  SETTINGS: 'Settings',
  PROMOTION: 'Promotions',
  BILLING: 'Billing',
  EXPENSE: 'Expenses',
};

function formatPermissionLabel(permission: string) {
  return permission.split(':').slice(1).join(' ').replace(/_/g, ' ');
}

function RoleBadge({ role }: { role: AssignableRole }) {
  return <Badge className={ROLE_COLORS[role]}>{role.replace(/_/g, ' ')}</Badge>;
}

export default function UserPermissionsSettingsClient() {
  const queryClient = useQueryClient();
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [draftRole, setDraftRole] = useState<AssignableRole>('CASHIER');
  const [draftIsActive, setDraftIsActive] = useState(true);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);

  const { data, isLoading } = useQuery<{ success: boolean; data: StaffMember[] }>({
    queryKey: ['staff', 'settings-users'],
    queryFn: async () => {
      const res = await fetch('/api/store/staff');
      if (!res.ok) throw new Error('Failed to fetch team members');
      return res.json();
    },
  });

  const staff = data?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingMember) {
        throw new Error('No team member selected');
      }

      const inherited = new Set(ROLE_PERMISSIONS[draftRole]);
      const explicitPermissions = draftPermissions.filter(
        (permission) => !inherited.has(permission as PermissionKey),
      );

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
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const inheritedPermissions = new Set(ROLE_PERMISSIONS[draftRole]);

  function openEditor(member: StaffMember) {
    setEditingMember(member);
    setDraftRole(member.role);
    setDraftIsActive(member.isActive);
    setDraftPermissions(Array.isArray(member.permissions) ? member.permissions : []);
  }

  function togglePermission(permission: string) {
    if (inheritedPermissions.has(permission as PermissionKey)) {
      return;
    }

    setDraftPermissions((current) =>
      current.includes(permission)
        ? current.filter((entry) => entry !== permission)
        : [...current, permission],
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Team &amp; permissions</h1>
        <p className="mt-1 text-sm text-sand">
          Adjust roles, keep accounts active, and grant extra permissions on top of each role’s defaults.
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
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Extra permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-espresso">{member.email}</p>
                        <p className="text-xs text-sand">{ROLE_PERMISSIONS[member.role].length} inherited defaults</p>
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
                      {Array.isArray(member.permissions) ? member.permissions.length : 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEditor(member)}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editingMember !== null} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">
              {editingMember ? `Manage ${editingMember.email}` : 'Manage user'}
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
                    {ASSIGNABLE_ROLES.map((role) => (
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
                  <p className="text-xs text-sand">Inactive users cannot operate the store.</p>
                </div>
                <Switch checked={draftIsActive} onCheckedChange={setDraftIsActive} />
              </div>

              <div className="rounded-md border border-mist bg-white p-3 text-xs text-sand">
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

                        return (
                          <label
                            key={permission}
                            className={`flex items-start gap-3 rounded-md border p-3 ${
                              inherited ? 'border-espresso/20 bg-pearl/50' : 'border-mist bg-white'
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={inherited}
                              onCheckedChange={() => togglePermission(permission)}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-espresso">{formatPermissionLabel(permission)}</p>
                                {inherited ? (
                                  <Badge variant="secondary" className="bg-espresso text-pearl">Inherited</Badge>
                                ) : checked ? (
                                  <Badge variant="secondary">Explicit</Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 font-mono text-[11px] text-sand">{permission}</p>
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
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
