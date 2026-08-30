'use client';

import React from 'react';
import type { PublicAppointmentService } from '@/lib/api/website';

interface AppointmentServiceSelectProps {
  services: PublicAppointmentService[];
  value: string;
  onChange: (serviceId: string) => void;
}

/**
 * "Ayurvedic Service" select — styled as a reference `.booking-select`.
 * Native select with a custom chevron so it matches the glassmorphic terminal.
 */
export function AppointmentServiceSelect({
  services,
  value,
  onChange,
}: AppointmentServiceSelectProps) {
  return (
    <select
      id="select-service"
      name="service"
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="booking-input booking-select"
    >
      <option value="" disabled>
        Select Consultation Service
      </option>
      {services.map((service) => (
        <option key={service.id} value={service.id}>
          {service.name}
        </option>
      ))}
    </select>
  );
}
