'use client';

import React from 'react';

interface AppointmentSuccessModalProps {
  open: boolean;
  patientName: string;
  doctorName: string;
  dateLabel: string;
  slotLabel: string;
  onClose: () => void;
}

/**
 * Success confirmation modal — mirrors the reference `#booking-success-modal`.
 * Shows a summary of the reserved appointment and a "Return to Sanctuary" CTA.
 */
export function AppointmentSuccessModal({
  open,
  patientName,
  doctorName,
  dateLabel,
  slotLabel,
  onClose,
}: AppointmentSuccessModalProps) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300 ${
        open
          ? 'opacity-100 visible pointer-events-auto'
          : 'opacity-0 invisible pointer-events-none'
      }`}
      aria-hidden={!open}
    >
      <div className="relative w-full max-w-lg bg-[#082017] border border-[#97c93e]/40 rounded-[32px] p-8 sm:p-10 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-[#97c93e]/20 border border-[#97c93e]/50 flex items-center justify-center text-[#97c93e] text-3xl mx-auto mb-5 shadow-lg">
          <i className="fa-solid fa-check" />
        </div>
        <h3 className="font-cinzel text-2xl font-bold text-white mb-2">
          Appointment Reserved!
        </h3>
        <p id="booking-summary-text" className="text-sm text-gray-300 leading-relaxed mb-8">
          Thank you, <strong className="text-white">{patientName}</strong>. Your
          consultation with{' '}
          <strong className="text-white">{doctorName || 'our physician'}</strong> has
          been provisionally recorded for{' '}
          <strong className="text-white">{dateLabel}</strong>
          {slotLabel ? (
            <>
              {' '}
              at <strong className="text-white">{slotLabel}</strong>
            </>
          ) : null}
          . Our sanctuary care desk will contact you via WhatsApp to confirm.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="px-8 py-3 rounded-full bg-[#97c93e] text-black font-cinzel font-bold text-sm tracking-wider uppercase hover:bg-[#b2db58] transition-colors"
        >
          RETURN TO SANCTUARY
        </button>
      </div>
    </div>
  );
}
