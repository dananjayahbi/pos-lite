'use client';

import React from 'react';

interface AppointmentSlotPickerProps {
  slots: string[];
  value: string;
  onChange: (slot: string) => void;
}

/**
 * "Available Time Slots" button grid — mirrors the reference `.time-slot-btn`
 * behaviour: a row of pill buttons where exactly one is active.
 */
export function AppointmentSlotPicker({
  slots,
  value,
  onChange,
}: AppointmentSlotPickerProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
      {slots.map((slot) => {
        const isActive = value === slot;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onChange(isActive ? '' : slot)}
            className={`time-slot-btn ${isActive ? 'active' : ''}`}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}
