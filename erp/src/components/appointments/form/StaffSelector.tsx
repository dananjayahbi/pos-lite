'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';

interface StaffSelectorProps {
  value: string | null;
  onChange: (staffId: string | null) => void;
}

export function StaffSelector({ value, onChange }: StaffSelectorProps) {
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-list'],
    queryFn: async () => {
      const res = await fetch('/api/store/staff');
      const json = await res.json();
      if (!json.success) return [];
      return json.data as { id: string; email: string }[];
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">Staff Member (optional)</Label>
      <Select value={value ?? ''} onValueChange={(v) => onChange(v || null)}>
        <SelectTrigger>
          <SelectValue placeholder="Select staff" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any available staff</SelectItem>
          {staff.map((s: { id: string; email: string }) => (
            <SelectItem key={s.id} value={s.id}>{s.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
