'use client';

import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Loader2, ExternalLink, X } from 'lucide-react';
import { DeferredMediaUploader } from '@/components/shared/DeferredMediaUploader';
import { cn } from '@/lib/utils';
import type { WebsiteConfigData, WebsiteAppointmentsConfig } from '@/types/website.types';

interface AppointmentsTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  durationMins: number;
}

const DEFAULT_APPOINTMENTS: WebsiteAppointmentsConfig = {
  enabled: false,
  navLabel: 'Appointments',
  title: 'Book a Channeling',
  subtitle: '',
  serviceIds: [],
};

/**
 * Owner control for the customer-facing Appointments (channelling) booking page.
 *
 * Lets the owner:
 *  - show/hide the booking page + nav link
 *  - edit the nav label, page title, subtitle, intro and hero image
 *  - choose which appointment services are offered to customers
 */
export function AppointmentsTab({ config, onChange }: AppointmentsTabProps) {
  const appointments: WebsiteAppointmentsConfig =
    (config.appointments as WebsiteAppointmentsConfig) ?? DEFAULT_APPOINTMENTS;

  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceError, setServiceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchServices() {
      try {
        setLoadingServices(true);
        const res = await fetch('/api/store/appointments/services');
        if (!res.ok) throw new Error('Failed to load services');
        const json = await res.json();
        if (!cancelled) {
          setServices(json.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setServiceError(err instanceof Error ? err.message : 'Failed to load services');
        }
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    }
    fetchServices();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedIds = appointments.serviceIds ?? [];
  const selectedIdSet = new Set(selectedIds);

  function toggleService(id: string) {
    const next = selectedIdSet.has(id)
      ? selectedIds.filter((sid) => sid !== id)
      : [...selectedIds, id];
    onChange({ appointments: { ...appointments, serviceIds: next } });
  }

  function updateAppointments(patch: Partial<WebsiteAppointmentsConfig>) {
    onChange({ appointments: { ...appointments, ...patch } });
  }

  // Derive the customer-facing appointments URL. In production the ERP is
  // served from an `admin.` subdomain while the storefront is on the bare
  // host, so strip the "admin." prefix. In local dev the ERP runs on 3003 and
  // the storefront on 3002, so remap the port.
  const previewUrl = (() => {
    if (typeof window === 'undefined') return '';
    const { host, protocol } = window.location;
    let h = host.replace(/^admin\./i, '');
    h = h.replace(/:3003$/, ':3002');
    return `${protocol}//${h}/appointments`;
  })();

  return (
    <div className="space-y-6">
      {/* Sync status + live page preview */}
      <div className="rounded-lg border border-cream/40 bg-cream/20 px-3 py-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-espresso">Appointments (Channelling)</h3>
            <p className="mt-0.5 text-xs text-sand">
              Reference layout: a parallax hero above a glassmorphic booking
              terminal (patient details, service, physician, time slots, notes)
              with a success confirmation modal.
            </p>
          </div>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/40 px-3 py-1.5 text-xs font-medium text-terracotta hover:bg-terracotta hover:text-white transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View live page
            </a>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-sand">
          <span
            className={cn(
              'inline-flex h-2 w-2 rounded-full',
              appointments.enabled ? 'bg-green-500' : 'bg-sand/50',
            )}
          />
          {appointments.enabled
            ? `Public — ${selectedIds.length > 0 ? selectedIds.length : 'all'} service${
                selectedIds.length === 1 ? '' : 's'
              } offered, synced with ERP /appointments`
            : 'Hidden — booking page is not publicly accessible'}
        </div>
      </div>

      {/* Enable / disable */}
      <div>
        <div className="flex items-center justify-between rounded-lg border border-mist bg-white p-4">
          <div>
            <p className="text-sm font-medium text-espresso">Show booking page</p>
            <p className="text-xs text-sand mt-0.5">
              When enabled, an Appointments link appears in the website menu and the booking
              page becomes publicly accessible.
            </p>
          </div>
          <Switch
            checked={appointments.enabled}
            onCheckedChange={(checked) => updateAppointments({ enabled: checked })}
          />
        </div>
      </div>

      <Separator />

      {/* Content / copy */}
      <div>
        <h3 className="text-sm font-semibold text-espresso mb-3">Page Content</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="appt-nav-label">Navigation Label</Label>
            <Input
              id="appt-nav-label"
              value={appointments.navLabel ?? ''}
              onChange={(e) => updateAppointments({ navLabel: e.target.value })}
              placeholder="Appointments"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="appt-title">Page Title</Label>
            <Input
              id="appt-title"
              value={appointments.title ?? ''}
              onChange={(e) => updateAppointments({ title: e.target.value })}
              placeholder="Book a Channeling"
            />
          </div>
        </div>
        <div className="mt-4">
          <Label htmlFor="appt-subtitle">Page Subtitle</Label>
          <Textarea
            id="appt-subtitle"
            value={appointments.subtitle ?? ''}
            onChange={(e) => updateAppointments({ subtitle: e.target.value })}
            placeholder="Reserve your appointment with our Ayurvedic doctor."
            rows={2}
          />
        </div>
        <div className="mt-4">
          <Label htmlFor="appt-intro">Intro Text</Label>
          <Textarea
            id="appt-intro"
            value={appointments.intro ?? ''}
            onChange={(e) => updateAppointments({ intro: e.target.value })}
            placeholder="Optional short helper text shown above the booking form."
            rows={2}
          />
        </div>
      </div>

      <Separator />

      {/* Hero image */}
      <div>
        <h3 className="text-sm font-semibold text-espresso mb-3">Hero Image</h3>
        <div className="max-w-md">
          <DeferredMediaUploader
            value={appointments.heroImageUrl ?? ''}
            onChange={(url) => updateAppointments({ heroImageUrl: url })}
            uploadKey="appointments_hero"
            accept="image/*"
            maxSizeMB={5}
            label="Upload Hero Image"
            placeholder="Upload a hero image for the booking page"
            previewHeight="h-32"
            currentRealUrl={appointments.heroImageUrl ?? ''}
          />
        </div>
      </div>

      <Separator />

      {/* Service picker */}
      <div>
        <h3 className="text-sm font-semibold text-espresso mb-3">Available Services</h3>
        <p className="text-xs text-sand mb-3">
          Choose which appointment services customers can book. Leave empty to offer all
          active services.
        </p>

        {loadingServices ? (
          <div className="flex items-center gap-2 text-sm text-sand py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading services…
          </div>
        ) : serviceError ? (
          <p className="text-sm text-red-600 py-4">{serviceError}</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-sand py-4">
            No appointment services yet. Add them in the Appointments → Services page.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {services.map((service) => {
              const isSelected = selectedIdSet.has(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.id)}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all',
                    isSelected
                      ? 'border-terracotta bg-white shadow-sm'
                      : 'border-mist bg-white hover:border-terracotta/50',
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-espresso">{service.name}</p>
                    <p className="text-xs text-sand mt-0.5">
                      {service.durationMins} min
                      {service.description ? ` · ${service.description}` : ''}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-terracotta text-white shrink-0 mt-0.5">
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
