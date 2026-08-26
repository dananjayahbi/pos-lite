import { z } from 'zod';

// ── Appointment Service ───────────────────────────────────────────────────────

export const AppointmentServiceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  durationMins: z.number().int().min(5, 'Minimum 5 minutes').max(480, 'Maximum 8 hours'),
  price: z.number().min(0, 'Price cannot be negative'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const UpdateAppointmentServiceSchema = AppointmentServiceSchema.partial();

// ── Appointment ───────────────────────────────────────────────────────────────

export const CreateAppointmentSchema = z
  .object({
    customerId: z.string().optional().nullable(),
    walkInName: z.string().max(100).optional().nullable(),
    walkInPhone: z.string().max(20).optional().nullable(),
    serviceId: z.string().optional().nullable(),
    staffId: z.string().optional().nullable(),
    startTime: z.string().datetime({ message: 'Start time must be a valid ISO datetime' }),
    endTime: z.string().datetime({ message: 'End time must be a valid ISO datetime' }),
    durationMins: z.number().int().min(5),
    price: z.number().min(0),
    depositAmount: z.number().min(0).optional().nullable(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    customerNotes: z.string().max(1000).optional().nullable(),
    recurrenceType: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM']).optional().nullable(),
    recurrenceEndDate: z.string().datetime().optional().nullable(),
  })
  .refine(
    (data) => data.customerId || (data.walkInName && data.walkInPhone),
    { message: 'Either an existing customer or walk-in name + phone is required', path: ['customerId'] },
  )
  .refine(
    (data) => new Date(data.endTime) > new Date(data.startTime),
    { message: 'End time must be after start time', path: ['endTime'] },
  );

export const UpdateAppointmentSchema = z
  .object({
    customerId: z.string().optional().nullable(),
    walkInName: z.string().max(100).optional().nullable(),
    walkInPhone: z.string().max(20).optional().nullable(),
    serviceId: z.string().optional().nullable(),
    staffId: z.string().optional().nullable(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    durationMins: z.number().int().min(5).optional(),
    price: z.number().min(0).optional(),
    depositAmount: z.number().min(0).optional().nullable(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    customerNotes: z.string().max(1000).optional().nullable(),
    status: z.enum(['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED']).optional(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return new Date(data.endTime) > new Date(data.startTime);
      }
      return true;
    },
    { message: 'End time must be after start time', path: ['endTime'] },
  );

// ── Cancel Appointment ───────────────────────────────────────────────────────

export const CancelAppointmentSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ── Staff Availability ────────────────────────────────────────────────────────

export const StaffAvailabilityEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
  isAvailable: z.boolean().optional(),
  slotDurationMins: z.number().int().min(5).max(120).optional(),
});

export const StaffAvailabilityBulkSchema = z.object({
  staffId: z.string().min(1),
  entries: z.array(StaffAvailabilityEntrySchema).min(1),
});

// ── Staff Time Off ────────────────────────────────────────────────────────────

export const StaffTimeOffSchema = z.object({
  staffId: z.string().min(1),
  date: z.string().datetime(),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

export const ApproveTimeOffSchema = z.object({
  isApproved: z.boolean(),
});

// ── Slot Generation ──────────────────────────────────────────────────────────

export const SlotGenerationSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  staffIds: z.array(z.string()).optional(),
});

// ── Appointment Filters ──────────────────────────────────────────────────────

export const AppointmentFiltersSchema = z.object({
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED']).optional(),
  staffId: z.string().optional(),
  serviceId: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

// ── Feature Module Toggle ────────────────────────────────────────────────────

export const FeatureModuleToggleSchema = z.object({
  modules: z.array(z.string()),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;
export type AppointmentServiceInput = z.infer<typeof AppointmentServiceSchema>;
export type UpdateAppointmentServiceInput = z.infer<typeof UpdateAppointmentServiceSchema>;
export type StaffAvailabilityEntryInput = z.infer<typeof StaffAvailabilityEntrySchema>;
export type StaffAvailabilityBulkInput = z.infer<typeof StaffAvailabilityBulkSchema>;
export type StaffTimeOffInput = z.infer<typeof StaffTimeOffSchema>;
export type SlotGenerationInput = z.infer<typeof SlotGenerationSchema>;
export type AppointmentFilters = z.infer<typeof AppointmentFiltersSchema>;
