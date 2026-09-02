'use client';

import React, { useState } from 'react';
import { Calendar, Clock, User, Phone, Loader2, CheckCircle2 } from 'lucide-react';
import type {
  PublicAppointmentService,
  PublicAppointmentSlot,
} from '@/lib/api/website';
import { getPublicAppointmentSlots, createPublicAppointment } from '@/lib/api/website';

interface AppointmentBookingFormProps {
  tenantSlug: string;
  services: PublicAppointmentService[];
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
 * Customer-facing booking form for an Ayurvedic doctor channelling.
 *
 * Flow: pick a service → pick a date → pick an available slot → enter
 * name + phone → submit. Submits a walk-in appointment via the public API.
 */
export function AppointmentBookingForm({
  tenantSlug,
  services,
  intro,
}: AppointmentBookingFormProps) {
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [slots, setSlots] = useState<PublicAppointmentSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SubmittableSlot | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Derive today's date in local yyyy-mm-dd for the `min` of the date picker.
  const [today] = useState(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  });

  const activeService =
    services.find((s) => s.id === selectedServiceId) ?? null;

  async function handleDateChange(nextDate: string) {
    setDate(nextDate);
    setSelectedSlot(null);
    setSlots([]);
    if (!nextDate) return;
    setLoadingSlots(true);
    try {
      const result = await getPublicAppointmentSlots(
        tenantSlug,
        nextDate,
        selectedServiceId || undefined,
      );
      setSlots(result);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

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
        serviceId: selectedServiceId || null,
        slotId: selectedSlot.id,
        staffId: selectedSlot.staffId ?? null,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        durationMins: activeService?.durationMins ?? selectedSlot.durationMins,
        price: Number(activeService?.price ?? 0),
        notes: null,
      });
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      setStatus('error');
    }
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDateLabel(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16">
        <CheckCircle2 className="h-14 w-14 text-green-600 mb-4" />
        <h2 className="text-2xl font-medium text-[var(--site-primary,#0a0a0a)]">
          Appointment Requested
        </h2>
        <p className="mt-2 text-sm text-gray-500 max-w-md">
          Thank you, {name}. Your appointment request has been received. We will
          confirm your channelling shortly. You can also call us to confirm.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus('idle');
            setSelectedSlot(null);
            setSlots([]);
            setDate('');
          }}
          className="mt-6 text-sm font-medium text-[var(--site-accent,#b4946e)] hover:underline"
        >
          Book another appointment
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {intro && (
        <p className="text-sm text-gray-500 text-center max-w-xl mx-auto">{intro}</p>
      )}

      {/* Step 1 — Service */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-[var(--site-primary,#0a0a0a)]">
          Choose a service
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {services.length === 0 ? (
            <p className="text-sm text-gray-400 col-span-full py-4 text-center">
              No booking services are available right now.
            </p>
          ) : (
            services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => {
                  setSelectedServiceId(service.id);
                  setSelectedSlot(null);
                  if (date) handleDateChange(date);
                }}
                className={`rounded-xl border p-4 text-left transition-all duration-200 ${
                  selectedServiceId === service.id
                    ? 'border-[var(--site-accent,#b4946e)] bg-[var(--site-accent,#b4946e)]/5 ring-1 ring-[var(--site-accent,#b4946e)]'
                    : 'border-gray-200 bg-white hover:border-[var(--site-accent,#b4946e)] hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="h-3 w-3 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: service.color || '#b4946e' }}
                  />
                  <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                    {service.durationMins} min
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--site-primary,#0a0a0a)]">
                  {service.name}
                </p>
                {service.description && (
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                    {service.description}
                  </p>
                )}
                <p className="mt-2 text-sm font-medium text-[var(--site-accent,#b4946e)]">
                  {Number(service.price).toFixed(2)} LKR
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Step 2 — Date + slots */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-[var(--site-primary,#0a0a0a)]">
          Pick a date
        </label>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative max-w-[280px]">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-10 py-2.5 text-sm text-gray-700 outline-none focus:border-[var(--site-accent,#b4946e)]"
            />
          </div>
          <button
            type="button"
            onClick={() => setDate('')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        </div>

        {loadingSlots && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking availability…
          </div>
        )}

        {!loadingSlots && date && slots.length > 0 && (
          <div className="pt-2">
            <p className="text-xs text-gray-400 mb-2">
              Available slots on {formatDateLabel(slots[0]?.startTime ?? date)}
            </p>
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => {
                const isActive = selectedSlot?.id === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() =>
                      setSelectedSlot({
                        id: slot.id,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        durationMins:
                          activeService?.durationMins ?? 30,
                        staffId: slot.staffId ?? null,
                      })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm transition-all ${
                      isActive
                        ? 'border-[var(--site-accent,#b4946e)] bg-[var(--site-accent,#b4946e)] text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--site-accent,#b4946e)]'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(slot.startTime)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!loadingSlots && date && slots.length === 0 && (
          <p className="text-sm text-gray-400 py-3">
            No available slots for this day. Please try another date.
          </p>
        )}
      </div>

      {/* Step 3 — Contact details */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-[var(--site-primary,#0a0a0a)]">
          Your details
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-lg border border-gray-200 bg-white px-10 py-2.5 text-sm text-gray-700 outline-none focus:border-[var(--site-accent,#b4946e)]"
            />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-lg border border-gray-200 bg-white px-10 py-2.5 text-sm text-gray-700 outline-none focus:border-[var(--site-accent,#b4946e)]"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center bg-red-50 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'loading' || !selectedSlot || !name.trim() || !phone.trim()}
        className="w-full sm:w-auto mx-auto flex items-center justify-center gap-2 rounded-full bg-[var(--site-accent,#b4946e)] px-8 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Booking…
          </>
        ) : (
          'Confirm Appointment'
        )}
      </button>
    </form>
  );
}
