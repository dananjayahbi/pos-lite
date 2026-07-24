"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";

// ── Date helpers ────────────────────────────────────────────────

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function subDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function subMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() - n);
  return r;
}

// ── Presets ─────────────────────────────────────────────────────

type Preset = {
  label: string;
  range: () => { from: string; to: string };
};

function getPresets(): Preset[] {
  const today = startOfDay(new Date());
  return [
    {
      label: "Today",
      range: () => ({ from: toYMD(today), to: toYMD(today) }),
    },
    {
      label: "Yesterday",
      range: () => {
        const y = subDays(today, 1);
        return { from: toYMD(y), to: toYMD(y) };
      },
    },
    {
      label: "Last 7 Days",
      range: () => ({ from: toYMD(subDays(today, 6)), to: toYMD(today) }),
    },
    {
      label: "Last 30 Days",
      range: () => ({ from: toYMD(subDays(today, 29)), to: toYMD(today) }),
    },
    {
      label: "This Month",
      range: () => ({
        from: toYMD(startOfMonth(today)),
        to: toYMD(today),
      }),
    },
    {
      label: "Last Month",
      range: () => {
        const prev = subMonths(today, 1);
        return {
          from: toYMD(startOfMonth(prev)),
          to: toYMD(endOfMonth(prev)),
        };
      },
    },
  ];
}

// ── Component ───────────────────────────────────────────────────

interface DateRangePickerProps {
  from: string;
  to: string;
  onRangeChange: (range: { from: string; to: string }) => void;
}

export default function DateRangePicker({
  from,
  to,
  onRangeChange,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const presets = getPresets();

  function applyPreset(preset: Preset) {
    setShowCustom(false);
    onRangeChange(preset.range());
    setOpen(false);
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      onRangeChange({ from: customFrom, to: customTo });
      setOpen(false);
    }
  }

  const displayText = `${formatDateDisplay(from)} – ${formatDateDisplay(to)}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-2 border-mist bg-white font-body text-sm text-espresso"
        >
          <CalendarIcon className="h-4 w-4 text-terracotta" />
          <span className="hidden sm:inline">{displayText}</span>
          <span className="sm:hidden">Date Range</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex flex-col">
          {/* Preset buttons */}
          <div className="flex flex-col gap-0.5 p-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-md px-3 py-1.5 text-left font-body text-sm text-espresso hover:bg-linen transition-colors"
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setShowCustom(true);
                setCustomFrom(from);
                setCustomTo(to);
              }}
              className="rounded-md px-3 py-1.5 text-left font-body text-sm text-espresso hover:bg-linen transition-colors"
            >
              Custom Range
            </button>
          </div>

          {/* Custom range inputs */}
          {showCustom && (
            <div className="border-t border-mist p-3">
              <div className="flex flex-col gap-2">
                <label className="font-body text-xs text-terracotta">
                  From
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-mist bg-white px-2 py-1.5 font-body text-sm text-espresso"
                  />
                </label>
                <label className="font-body text-xs text-terracotta">
                  To
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-mist bg-white px-2 py-1.5 font-body text-sm text-espresso"
                  />
                </label>
                <Button
                  size="sm"
                  onClick={applyCustom}
                  disabled={!customFrom || !customTo || customFrom > customTo}
                  className="mt-1"
                >
                  Apply
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
