'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  getPublicAppointmentSlots,
  createPublicAppointment,
  type PublicAppointmentService,
  type PublicAppointmentSlot,
} from '@/lib/api/website';
import { AppointmentServiceSelect } from './AppointmentServiceSelect';
import { AppointmentDoctorSelect } from './AppointmentDoctorSelect';
import { AppointmentSlotPicker } from './AppointmentSlotPicker';
import { AppointmentSuccessModal } from './AppointmentSuccessModal';

interface BookingTerminalProps {
  tenantSlug: string;
  services: PublicAppointmentService[];
  /** Available doctors (staff with appointment slots) for the tenant. */
  doctors: { id: string; name: string; email?: string | null }[];
  intro?: string | null;
}

interface SubmittableSlot {
  id: string;
  startTime: string;
  endTime: string;
  durationMins: number;
  staffId?: string | null;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

/**
 * Glassmorphic "Booking Terminal" — the centrepiece of the appointments page.
 *
 * Mirrors the reference `#channeling-booking-form`: a two-column field grid
 * (name/phone, email/date, service/doctor), a time-slot button grid, a notes
 * textarea and a full-width confirm CTA. State flows into a success modal on
 * submit.
 */
export function BookingTerminal({
  tenantSlug,
  services,
  doctors,
  intro,
}: BookingTerminalProps) {
  const [serviceId, setServiceId] = useState<string>('');
  const [doctorId, setDoctorId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [slot, setSlot] = useState<string>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [slots, setSlots] = useState<PublicAppointmentSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SubmittableSlot | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }, []);

  const activeService = services.find((s) => s.id === serviceId) ?? null;
  const activeDoctor = doctors.find((d) => d.id === doctorId) ?? null;

  // Refresh slots whenever service, doctor or date change.
  const refreshSlots = useCallback(
    async (nextDate: string, nextServiceId: string, nextDoctorId: string) => {
      if (!nextDate) return;
      setLoadingSlots(true);
      try {
        const result = await getPublicAppointmentSlots(
          tenantSlug,
          nextDate,
          nextServiceId || undefined,
        );
        let list = result;
        if (nextDoctorId) {
          list = list.filter((s) => s.staffId === nextDoctorId);
        }
        setSlots(list);
      } catch {
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [tenantSlug],
  );

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate);
    setSlot('');
    setSelectedSlot(null);
    refreshSlots(nextDate, serviceId, doctorId);
  };

  const handleServiceChange = (next: string) => {
    setServiceId(next);
    setSlot('');
    setSelectedSlot(null);
    refreshSlots(date, next, doctorId);
  };

  const handleDoctorChange = (next: string) => {
    setDoctorId(next);
    setSlot('');
    setSelectedSlot(null);
    refreshSlots(date, serviceId, next);
  };

  const handleSlotChange = (label: string) => {
    setSlot(label);
    const match = slots.find(
      (s) => formatTime(s.startTime) === label,
    );
    if (match) {
      setSelectedSlot({
        id: match.id,
        startTime: match.startTime,
        endTime: match.endTime,
        durationMins: activeService?.durationMins ?? 30,
        staffId: match.staffId ?? null,
      });
    } else {
      setSelectedSlot(null);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Please select an available time slot.');
      setStatus('error');
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError('Please provide your name and phone number.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError('');
    try {
      await createPublicAppointment(tenantSlug, {
        walkInName: name.trim(),
        walkInPhone: phone.trim(),
        serviceId: serviceId || null,
        slotId: selectedSlot.id,
        staffId: selectedSlot.staffId ?? null,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        durationMins: activeService?.durationMins ?? selectedSlot.durationMins,
        price: Number(activeService?.price ?? 0),
        notes: notes.trim() || null,
      });
      setStatus('success');
      setModalOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      setStatus('error');
    }
  }

  const resetForm = () => {
    setModalOpen(false);
    setStatus('idle');
    setServiceId('');
    setDoctorId('');
    setDate('');
    setSlot('');
    setSelectedSlot(null);
    setSlots([]);
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setError('');
  };

  const slotLabels = useMemo(
    () =>
      Array.from(new Set(slots.map((s) => formatTime(s.startTime)))).sort(
        (a, b) => toMinutes(a) - toMinutes(b),
      ),
    [slots],
  );

  return (
    <>
      <form id="channeling-booking-form" onSubmit={handleSubmit} className="flex flex-col gap-6 sm:gap-8">
        {intro && (
          <p className="appointments-intro-text">{intro}</p>
        )}

        {/* Row 1: Patient Name & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="patient-name" className="booking-field-label">
              Full Name *
            </label>
            <input
              type="text"
              id="patient-name"
              name="patient-name"
              placeholder="e.g. Kasun Fernando"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="booking-input"
            />
          </div>
          <div>
            <label htmlFor="patient-phone" className="booking-field-label">
              Phone / WhatsApp *
            </label>
            <input
              type="tel"
              id="patient-phone"
              name="patient-phone"
              placeholder="+94 77 123 4567"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="booking-input"
            />
          </div>
        </div>

        {/* Row 2: Email & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="patient-email" className="booking-field-label">
              Email Address
            </label>
            <input
              type="email"
              id="patient-email"
              name="patient-email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="booking-input"
            />
          </div>
          <div>
            <label htmlFor="booking-date" className="booking-field-label">
              Preferred Date *
            </label>
            <input
              type="date"
              id="booking-date"
              name="booking-date"
              min={today}
              required
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="booking-input"
            />
          </div>
        </div>

        {/* Row 3: Service & Doctor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="select-service" className="booking-field-label">
              Ayurvedic Service *
            </label>
            <AppointmentServiceSelect
              services={services}
              value={serviceId}
              onChange={handleServiceChange}
            />
          </div>
          <div>
            <label htmlFor="select-doctor" className="booking-field-label">
              Specialist Physician *
            </label>
            <AppointmentDoctorSelect
              doctors={doctors}
              value={doctorId}
              onChange={handleDoctorChange}
            />
          </div>
        </div>

        {/* Row 4: Time Slot */}
        <div>
          <label className="booking-field-label mb-3">Available Time Slots *</label>
          <input type="hidden" id="selected-time-slot" name="time-slot" value={slot} />
          {loadingSlots ? (
            <p className="text-sm text-[#cbd5e1]/70 py-4 text-center">
              Checking availability…
            </p>
          ) : date && slotLabels.length > 0 ? (
            <AppointmentSlotPicker slots={slotLabels} value={slot} onChange={handleSlotChange} />
          ) : date ? (
            <p className="text-sm text-[#cbd5e1]/70 py-4 text-center">
              No available slots for this day. Please try another date.
            </p>
          ) : (
            <p className="text-sm text-[#cbd5e1]/70 py-4 text-center">
              Select a date to see available practice hours.
            </p>
          )}
        </div>

        {/* Row 5: Notes */}
        <div>
          <label htmlFor="booking-notes" className="booking-field-label">
            Health Concerns / Notes (Optional)
          </label>
          <textarea
            id="booking-notes"
            name="notes"
            rows={3}
            placeholder="Briefly describe your symptoms, health goals, or previous treatments..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="booking-input resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 text-center bg-red-500/10 rounded-lg px-4 py-2 border border-red-500/20">
            {error}
          </p>
        )}

        {/* Row 6: Submit */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={status === 'loading'}
            className="booking-submit-btn disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? 'RESERVING…' : 'CONFIRM APPOINTMENT'}
          </button>
        </div>
      </form>

      <AppointmentSuccessModal
        open={modalOpen}
        patientName={name}
        doctorName={activeDoctor?.name ?? ''}
        dateLabel={date ? formatDateLabel(date) : 'Upcoming Date'}
        slotLabel={slot}
        onClose={resetForm}
      />
    </>
  );
}

/** Format an ISO timestamp to a 12-hour clock label. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Convert a 12-hour "hh:mm AM" label to minutes-from-midnight for sorting. */
function toMinutes(label: string): number {
  const match = label.toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!match) return 0;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];
  if (meridiem === 'pm' && hours !== 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/** Format a yyyy-mm-dd date to a short weekday label. */
function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
