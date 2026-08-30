'use client';

import React from 'react';

interface AppointmentDoctorSelectProps {
  doctors: { id: string; name: string; email?: string | null }[];
  value: string;
  onChange: (staffId: string) => void;
}

/**
 * "Specialist Physician" select — renders the available doctors (staff with
 * appointment slots) as a styled reference `.booking-select`.
 */
export function AppointmentDoctorSelect({
  doctors,
  value,
  onChange,
}: AppointmentDoctorSelectProps) {
  return (
    <select
      id="select-doctor"
      name="doctor"
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="booking-input booking-select"
    >
      <option value="" disabled>
        Select Ayurvedic Doctor
      </option>
      {doctors.map((doctor) => (
        <option key={doctor.id} value={doctor.id}>
          {doctor.name}
        </option>
      ))}
    </select>
  );
}
