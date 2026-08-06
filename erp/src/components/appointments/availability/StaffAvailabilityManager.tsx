'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStaffAvailability, useUpsertAvailability } from '@/hooks/appointments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Entry = { startTime: string; endTime: string; isAvailable: boolean; slotDurationMins: number };

const DEFAULT_ENTRY: Entry = { startTime: '09:00', endTime: '17:00', isAvailable: false, slotDurationMins: 15 };

export function StaffAvailabilityManager() {
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-list'],
    queryFn: async () => {
      const res = await fetch('/api/store/staff');
      const json = await res.json();
      return json.success ? json.data as { id: string; email: string }[] : [];
    },
    staleTime: 60_000,
  });

  const { data: availability = [] } = useStaffAvailability(selectedStaffId || undefined);
  const upsertMutation = useUpsertAvailability();

  const getDefaultEntries = (): Record<number, Entry> => {
    const map: Record<number, Entry> = {};
    for (let i = 0; i < 7; i++) {
      const existing = availability.find((a: { dayOfWeek: number }) => a.dayOfWeek === i);
      map[i] = existing
        ? { startTime: existing.startTime, endTime: existing.endTime, isAvailable: existing.isAvailable, slotDurationMins: existing.slotDurationMins }
        : { ...DEFAULT_ENTRY, isAvailable: i !== 0 };
    }
    return map;
  };

  const [entries, setEntries] = useState<Record<number, Entry>>(getDefaultEntries);

  // Update entries when availability changes
  useEffect(() => {
    setEntries(getDefaultEntries());
  }, [availability]);

  const updateEntry = (i: number, patch: Partial<Entry>) => {
    setEntries((prev) => {
      const current = prev[i] ?? DEFAULT_ENTRY;
      return { ...prev, [i]: { ...current, ...patch } };
    });
  };

  const handleSave = () => {
    if (!selectedStaffId) return;
    const entriesList = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      ...entries[i],
    }));
    upsertMutation.mutate({ staffId: selectedStaffId, entries: entriesList });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff Availability Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Select Staff</Label>
          <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Choose staff member" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((s: { id: string; email: string }) => (
                <SelectItem key={s.id} value={s.id}>{s.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedStaffId && (
          <>
            <div className="rounded-lg border border-espresso/10">
              <div className="grid grid-cols-[80px_1fr_1fr_1fr_80px] gap-2 p-2 bg-espresso/5 text-xs font-medium text-espresso/60">
                <div /> <div>Available</div> <div>Start</div> <div>End</div> <div>Slot (min)</div>
              </div>
              {DAY_NAMES.map((day, i) => (
                <div key={day} className="grid grid-cols-[80px_1fr_1fr_1fr_80px] gap-2 p-2 border-t border-espresso/5 items-center">
                  <div className="text-sm text-espresso">{day}</div>
                  <div>
                    <Switch
                      checked={entries[i]?.isAvailable ?? false}
                      onCheckedChange={(v) => updateEntry(i, { isAvailable: v })}
                    />
                  </div>
                  <div>
                    <Input
                      type="time"
                      value={entries[i]?.startTime ?? '09:00'}
                      onChange={(e) => updateEntry(i, { startTime: e.target.value })}
                      disabled={!entries[i]?.isAvailable}
                    />
                  </div>
                  <div>
                    <Input
                      type="time"
                      value={entries[i]?.endTime ?? '17:00'}
                      onChange={(e) => updateEntry(i, { endTime: e.target.value })}
                      disabled={!entries[i]?.isAvailable}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={entries[i]?.slotDurationMins ?? 15}
                      onChange={(e) => updateEntry(i, { slotDurationMins: parseInt(e.target.value) || 15 })}
                      min={5}
                      max={120}
                      disabled={!entries[i]?.isAvailable}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? 'Saving...' : 'Save Availability'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
