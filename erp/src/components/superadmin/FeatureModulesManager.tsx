'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MODULE_DEFINITIONS } from '@/lib/feature-guard';

type Props = {
  tenantId: string;
  initialEnabledModules: string[];
};

export default function FeatureModulesManager({ tenantId, initialEnabledModules }: Props) {
  const [enabledModules, setEnabledModules] = useState<string[]>(initialEnabledModules);
  const [loading, setLoading] = useState<string | null>(null);

  const toggleModule = useCallback(
    async (moduleName: string, currentlyEnabled: boolean) => {
      setLoading(moduleName);
      const newModules = currentlyEnabled
        ? enabledModules.filter((m) => m !== moduleName)
        : [...enabledModules, moduleName];

      try {
        const res = await fetch(`/api/superadmin/tenants/${tenantId}/feature-modules`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modules: newModules }),
        });

        const json = (await res.json()) as { success: boolean; error?: { message: string } };

        if (!res.ok || !json.success) {
          toast.error(json.error?.message ?? 'Failed to update feature modules');
          return;
        }

        setEnabledModules(newModules);
        toast.success(
          `${MODULE_DEFINITIONS.find((m) => m.name === moduleName)?.label ?? moduleName} ${currentlyEnabled ? 'disabled' : 'enabled'}`,
        );
      } catch {
        toast.error('Network error — could not update feature modules');
      } finally {
        setLoading(null);
      }
    },
    [enabledModules, tenantId],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Feature Modules</CardTitle>
        <CardDescription>
          Enable or disable feature modules for this business. Changes take effect immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {MODULE_DEFINITIONS.map((mod) => {
          const isEnabled = enabledModules.includes(mod.name);
          const isLoading = loading === mod.name;

          return (
            <div key={mod.name} className="flex items-start gap-4 rounded-lg border border-espresso/10 p-4">
              <Switch
                id={`module-${mod.name}`}
                checked={isEnabled}
                onCheckedChange={() => toggleModule(mod.name, isEnabled)}
                disabled={isLoading}
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor={`module-${mod.name}`} className="text-sm font-medium cursor-pointer">
                  {mod.label}
                </Label>
                <p className="text-sm text-espresso/60">{mod.description}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
