'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock3, Plus, RefreshCw, Scissors, Search, Tags, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { ServiceCard } from './ServiceCard';
import { ServiceFormDialog } from './ServiceFormDialog';
import { EmptyState } from '../shared/EmptyState';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppointmentServices } from '@/hooks/appointments';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { formatRupee } from '@/lib/format';
import {
  filterAppointmentServices,
  summarizeAppointmentServices,
  toServicePrice,
  type AppointmentServiceRecord,
  type ServiceStatusFilter,
} from '@/lib/appointments/service-catalog';

export function ServiceList() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canManage =
    !permissionsLoading && hasPermission(PERMISSIONS.APPOINTMENT.manageServices);

  const { data, isLoading, isError, refetch } = useAppointmentServices();
  const services = useMemo(
    () => (data ?? []) as AppointmentServiceRecord[],
    [data],
  );

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ServiceStatusFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<AppointmentServiceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppointmentServiceRecord | null>(null);

  const filtered = useMemo(
    () => filterAppointmentServices(services, { search, status }),
    [services, search, status],
  );
  const summary = useMemo(() => summarizeAppointmentServices(services), [services]);
  const isFiltering = search.trim() !== '' || status !== 'all';

  const deleteMutation = useMutation({
    mutationFn: async (service: AppointmentServiceRecord) => {
      const res = await fetch(`/api/store/appointments/services/${service.id}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'Failed to delete the service');
      }
      return service.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-services'] });
      toast.success('Service removed');
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const openCreate = () => {
    setEditingService(null);
    setFormOpen(true);
  };

  const openEdit = (service: AppointmentServiceRecord) => {
    setEditingService(service);
    setFormOpen(true);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-espresso">
            Appointment Services
          </h1>
          <p className="mt-1 text-sm text-mist-ink">
            Manage what customers can book, how long it takes and what it costs.
          </p>
        </div>
        {canManage ? (
          <Button
            className="bg-espresso text-pearl hover:bg-espresso/90"
            onClick={openCreate}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add service
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <ServicesSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-red-700">Failed to load appointment services.</p>
          <Button variant="outline" className="border-red-200 text-red-700" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      ) : (
        <>
          <SummaryStrip summary={summary} />

          <div className="flex flex-col gap-3 rounded-xl border border-mist/70 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-ink"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search services…"
                className="pl-9"
                aria-label="Search services"
              />
            </div>
            <div className="flex items-center gap-3">
              <Select value={status} onValueChange={(value) => setStatus(value as ServiceStatusFilter)}>
                <SelectTrigger className="w-[150px]" aria-label="Filter by status">
                  <SelectValue placeholder="All services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All services</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                </SelectContent>
              </Select>
              <p className="whitespace-nowrap text-sm text-mist-ink">
                {filtered.length} of {services.length}
              </p>
            </div>
          </div>

          {services.length === 0 ? (
            <EmptyState
              icon={<Scissors className="h-12 w-12" />}
              title="No services yet"
              description="Add your first bookable service so customers can start booking appointments."
              action={
                canManage ? (
                  <Button
                    className="bg-espresso text-pearl hover:bg-espresso/90"
                    onClick={openCreate}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add service
                  </Button>
                ) : null
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-12 w-12" />}
              title="No services match your filters"
              description="Try a different search term or clear the status filter."
              action={
                <Button variant="outline" className="border-sand text-espresso" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((service) => (
                  <ServiceCard
                    key={service.id}
                    name={service.name}
                    description={service.description}
                    durationMins={service.durationMins}
                    price={toServicePrice(service.price)}
                    color={service.color}
                    isActive={service.isActive}
                    canManage={canManage}
                    onEdit={() => openEdit(service)}
                    onDelete={() => setDeleteTarget(service)}
                  />
                ))}
              </div>
              {isFiltering ? (
                <p className="text-center text-xs text-mist-ink">
                  Showing {filtered.length} of {services.length} services.{' '}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="underline underline-offset-2 hover:text-espresso"
                  >
                    Clear filters
                  </button>
                </p>
              ) : null}
            </>
          )}
        </>
      )}

      {canManage ? (
        <ServiceFormDialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditingService(null);
          }}
          service={editingService}
        />
      ) : null}

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Remove service"
        description={
          deleteTarget
            ? `Remove "${deleteTarget.name}" from the appointment catalogue? Existing appointments keep their history.`
            : ''
        }
        detail="Services used by upcoming appointments cannot be removed."
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
        confirmLabel="Remove service"
      />
    </div>
  );
}

function SummaryStrip({
  summary,
}: {
  summary: ReturnType<typeof summarizeAppointmentServices>;
}) {
  const priceRange =
    summary.lowestPrice === null || summary.highestPrice === null
      ? '-'
      : summary.lowestPrice === summary.highestPrice
        ? formatRupee(summary.lowestPrice)
        : `${formatRupee(summary.lowestPrice)} – ${formatRupee(summary.highestPrice)}`;

  const cards = [
    {
      label: 'Services',
      value: String(summary.total),
      hint: `${summary.active} active · ${summary.inactive} inactive`,
      icon: <Tags className="h-4 w-4" />,
    },
    {
      label: 'Active',
      value: String(summary.active),
      hint: summary.inactive > 0 ? `${summary.inactive} hidden from booking` : 'All bookable',
      icon: <Scissors className="h-4 w-4" />,
    },
    {
      label: 'Average duration',
      value: summary.total > 0 ? `${summary.averageDurationMins} min` : '-',
      hint: 'Across all services',
      icon: <Clock3 className="h-4 w-4" />,
    },
    {
      label: 'Price range',
      value: priceRange,
      hint: 'Lowest and highest service price',
      icon: <Wallet className="h-4 w-4" />,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-mist/70 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-mist-ink">
            <span>{card.label}</span>
            <span className="text-sand-ink" aria-hidden>
              {card.icon}
            </span>
          </div>
          <p className="mt-2 truncate font-display text-xl font-semibold text-espresso" title={card.value}>
            {card.value}
          </p>
          <p className="mt-0.5 text-xs text-mist-ink">{card.hint}</p>
        </div>
      ))}
    </div>
  );
}

function ServicesSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-14 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
