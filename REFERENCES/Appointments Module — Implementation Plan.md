# Appointments Module — Implementation Plan

**Date:** 2026-07-29  
**System:** AyurPOS (ERP)  
**Status:** Planned — Not Yet Implemented

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Feature Toggle — Superadmin Control](#2-feature-toggle--superadmin-control)
3. [Database Schema — New Models & Enums](#3-database-schema--new-models--enums)
4. [Permissions Model](#4-permissions-model)
5. [Route Structure — Pages & API](#5-route-structure--pages--api)
6. [Component Tree — Modular Breakdown](#6-component-tree--modular-breakdown)
7. [Service Layer — Business Logic](#7-service-layer--business-logic)
8. [Validator Schemas](#8-validator-schemas)
9. [Custom Hooks](#9-custom-hooks)
10. [State Management (Zustand)](#10-state-management-zustand)
11. [Calendar Views & UI Patterns](#11-calendar-views--ui-patterns)
12. [Staff Scheduling & Availability](#12-staff-scheduling--availability)
13. [Reminders & Notifications](#13-reminders--notifications)
14. [POS Integration — Convert Appointment to Sale](#14-pos-integration--convert-appointment-to-sale)
15. [Customer-Facing Features (Future)](#15-customer-facing-features-future)
16. [Reporting & Analytics](#16-reporting--analytics)
17. [Implementation Phases](#17-implementation-phases)
18. [File Inventory — Complete List of Files to Create](#18-file-inventory--complete-list-of-files-to-create)

---

## 1. Overview & Goals

### Purpose
Provide a fully integrated appointment scheduling system within AyurPOS, allowing businesses (tenants) to manage staff schedules, book customer appointments, track attendance, and optionally convert appointments into POS sales.

### Target Users
| Role | Access |
|------|--------|
| **SUPER_ADMIN** | Enable/disable the feature per tenant |
| **OWNER** | Full access — manage services, staff schedules, all appointments |
| **MANAGER** | Full access — same as OWNER for appointments |
| **CASHIER** | View & create appointments (self + customer-facing) |
| **STOCK_CLERK** | No access (unless explicitly granted via permissions) |

### Key Design Principles
- Follow existing modular patterns (services, validators, hooks, components)
- Every model scoped by `tenantId` — multi-tenant safe
- Feature toggled via superadmin — stored in `Tenant.settings` JSON
- Calendar as the primary UI metaphor, with list view as secondary
- Integrate with existing: Customers, Staff (Users), Notifications, Sales

---

## 2. Feature Toggle — Superadmin Control

### Approach
Since there is **no existing feature flag infrastructure**, we will extend the existing `Tenant.settings` JSON field to include an `enabledModules` array.

### Storage

```json
// Tenant.settings — extended structure
{
  "currency": "LKR",
  "timezone": "Asia/Colombo",
  "vatRate": 0,
  "ssclRate": 0,
  "receiptFooter": "...",
  "address": "...",
  "phoneNumber": "...",
  "enabledModules": ["appointments"]
}
```

### Superadmin UI

**New Section on Tenant Detail Page** (`tenants/[tenantId]/page.tsx`):

```
┌─────────────────────────────────────┐
│  Feature Modules                    │
│                                     │
│  ☑ Appointments                    │
│  └─ Enable appointment scheduling   │
│                                     │
│  ☐ Online Orders (Future)          │
│  └─ Enable e-commerce checkout      │
│                                     │
│  ☐ Courier Integration (Future)    │
│  └─ Enable courier dispatch         │
└─────────────────────────────────────┘
```

**New Component:** `FeatureModulesManager.tsx`
- Renders a list of available modules with toggle switches
- Each toggle calls `PATCH /api/superadmin/tenants/[id]/feature-modules`
- Stores `enabledModules` array in `Tenant.settings`

**New API Route:** `api/superadmin/tenants/[id]/feature-modules/route.ts`
- `PATCH` — accepts `{ modules: string[] }`
- Validates module names against known list
- Updates `Tenant.settings` JSON, merging with existing settings

### Feature Guard Hook

```typescript
// src/lib/feature-guard.ts
const KNOWN_MODULES = ['appointments'] as const;
export type ModuleName = (typeof KNOWN_MODULES)[number];

export function isModuleEnabled(settings: Record<string, unknown>, module: ModuleName): boolean {
  const enabledModules = (settings as any)?.enabledModules ?? [];
  return enabledModules.includes(module);
}
```

### Route & Component Guarding

- Store layout checks `isModuleEnabled()` for the appointments section
- If disabled: hide nav item, return 404 or "Feature not available" on page
- API routes check `isModuleEnabled()` and return 403 if disabled

---

## 3. Database Schema — New Models & Enums

### New Enums to Add to `prisma/schema.prisma`

```prisma
enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  CHECKED_IN
  IN_PROGRESS
  COMPLETED
  NO_SHOW
  CANCELLED
}

enum AppointmentRecurrenceType {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
  CUSTOM
}

enum AppointmentReminderChannel {
  WHATSAPP
  EMAIL
  BOTH
}

enum AppointmentReminderStatus {
  PENDING
  SENT
  FAILED
  SKIPPED
}
```

> **Note:** `AppointmentReminderChannel` and `AppointmentReminderStatus` do NOT conflict with existing `PaymentReminder*` enums (different prefix) — but to avoid confusion, consider prefixing with `APPOINTMENT_` or keeping separate enum names.

### New Models

#### 1. `AppointmentService` — Services offered for booking

```prisma
model AppointmentService {
  id            String    @id @default(cuid())
  tenantId      String
  tenant        Tenant    @relation(fields: [tenantId], references: [id])
  name          String
  description   String?
  durationMins  Int       // Duration in minutes
  price         Decimal   @db.Decimal(10, 2)
  color         String?   // Hex color for calendar display
  isActive      Boolean   @default(true)
  sortOrder     Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  appointments  Appointment[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("appointment_services")
}
```

#### 2. `AppointmentSlot` — Time slot per staff per day (auto-generated or manual)

```prisma
model AppointmentSlot {
  id             String    @id @default(cuid())
  tenantId       String
  tenant         Tenant    @relation(fields: [tenantId], references: [id])
  staffId        String
  staff          User      @relation(fields: [staffId], references: [id])
  date           DateTime  @db.Date
  startTime      DateTime  // e.g., 2026-07-29T09:00:00Z
  endTime        DateTime  // e.g., 2026-07-29T17:00:00Z
  isBooked       Boolean   @default(false)
  isBlocked      Boolean   @default(false) // blocked for break/offline
  appointmentId  String?   // Link to appointment when booked
  appointment    Appointment? @relation(fields: [appointmentId], references: [id])
  createdAt      DateTime  @default(now())

  @@unique([staffId, date, startTime])
  @@index([tenantId, date])
  @@index([staffId, date])
  @@map("appointment_slots")
}
```

#### 3. `Appointment` — Core booking record

```prisma
model Appointment {
  id                String                     @id @default(cuid())
  tenantId          String
  tenant            Tenant                     @relation(fields: [tenantId], references: [id])
  customerId        String?
  customer          Customer?                  @relation(fields: [customerId], references: [id])
  serviceId         String?
  service           AppointmentService?        @relation(fields: [serviceId], references: [id])
  staffId           String?
  staff             User?                      @relation(fields: [staffId], references: [id])
  slotId            String?                    @unique
  slot              AppointmentSlot?           @relation(fields: [slotId], references: [id])

  // Core fields
  title             String                     // Auto-generated or custom
  description       String?
  startTime         DateTime
  endTime           DateTime
  durationMins      Int
  status            AppointmentStatus          @default(SCHEDULED)

  // Pricing
  price             Decimal                    @db.Decimal(10, 2)
  depositAmount     Decimal?                   @default(0) @db.Decimal(10, 2)
  isPaid            Boolean                    @default(false)

  // Customer info (denormalized for walk-ins without existing customer record)
  walkInName        String?
  walkInPhone       String?

  // Notes
  notes             String?                    // Internal staff notes
  customerNotes     String?                    // Customer-provided notes
  cancellationReason String?
  cancelledAt       DateTime?
  cancelledById     String?
  cancelledBy       User?                      @relation("AppointmentCanceller", fields: [cancelledById], references: [id])

  // Check-in tracking
  checkedInAt       DateTime?
  checkedInById     String?
  checkedInBy       User?                      @relation("AppointmentCheckIn", fields: [checkedInById], references: [id])
  completedAt       DateTime?

  // Recurrence
  recurrenceType    AppointmentRecurrenceType?
  recurrenceEndDate DateTime?
  parentAppointmentId String?
  parentAppointment   Appointment?             @relation("RecurringAppointments", fields: [parentAppointmentId], references: [id])
  childAppointments   Appointment[]            @relation("RecurringAppointments")

  // POS link
  saleId            String?
  sale              Sale?                      @relation(fields: [saleId], references: [id])

  // Audit
  createdById       String
  createdBy         User                       @relation("AppointmentCreator", fields: [createdById], references: [id])
  updatedAt         DateTime                   @updatedAt
  createdAt         DateTime                   @default(now())

  reminders         AppointmentReminder[]

  @@index([tenantId, startTime])
  @@index([tenantId, customerId])
  @@index([tenantId, staffId])
  @@index([tenantId, status])
  @@index([tenantId, startTime, status])
  @@map("appointments")
}
```

#### 4. `AppointmentReminder` — Reminder tracking

```prisma
model AppointmentReminder {
  id              String                      @id @default(cuid())
  appointmentId   String
  appointment     Appointment                 @relation(fields: [appointmentId], references: [id])
  tenantId        String
  scheduledFor    DateTime                    // When to send
  sentAt          DateTime?
  channel         AppointmentReminderChannel
  status          AppointmentReminderStatus   @default(PENDING)
  errorMessage    String?
  createdAt       DateTime                    @default(now())

  @@index([appointmentId])
  @@index([tenantId, status])
  @@map("appointment_reminders")
}
```

#### 5. `StaffAvailability` — Recurring weekly schedule template per staff

```prisma
model StaffAvailability {
  id            String   @id @default(cuid())
  tenantId      String
  staffId       String
  staff         User     @relation(fields: [staffId], references: [id])
  dayOfWeek     Int      // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime     String   // "09:00" — HH:mm format
  endTime       String   // "17:00" — HH:mm format
  isAvailable   Boolean  @default(true)
  slotDurationMins Int   @default(15) // Slot granularity (15, 30, 60)

  @@unique([staffId, dayOfWeek])
  @@index([tenantId])
  @@map("staff_availability")
}
```

#### 6. `StaffTimeOff` — Date-specific blocks / time-off requests

```prisma
model StaffTimeOff {
  id          String    @id @default(cuid())
  tenantId    String
  staffId     String
  staff       User      @relation(fields: [staffId], references: [id])
  date        DateTime  @db.Date
  startTime   DateTime? // If part-day
  endTime     DateTime? // If part-day
  reason      String?
  isApproved  Boolean   @default(false)
  approvedById String?
  approvedBy  User?     @relation(fields: [approvedById], references: [id])
  createdAt   DateTime  @default(now())

  @@index([staffId, date])
  @@index([tenantId])
  @@map("staff_time_offs")
}
```

### Entity Relationship Diagram

```
Tenant (1) ──< AppointmentService
Tenant (1) ──< AppointmentSlot
Tenant (1) ──< Appointment ──< AppointmentReminder
Tenant (1) ──< StaffAvailability
Tenant (1) ──< StaffTimeOff

User (Staff) (1) ──< AppointmentSlot
User (Staff) (1) ──< Appointment (staffId)
User (Staff) (1) ──< Appointment (createdById)
User (Staff) (1) ──< Appointment (cancelledById)
User (Staff) (1) ──< Appointment (checkedInById)
User (Staff) (1) ──< StaffAvailability
User (Staff) (1) ──< StaffTimeOff

Customer (1) ──< Appointment

AppointmentService (1) ──< Appointment

Sale (1) ──< Appointment (saleId)
```

---

## 4. Permissions Model

### New Permission Group — Add to `PERMISSIONS` in `permissions.ts`

```typescript
APPOINTMENT: {
  viewAppointment: 'appointment:view',
  createAppointment: 'appointment:create',
  editAppointment: 'appointment:edit',
  cancelAppointment: 'appointment:cancel',
  checkInAppointment: 'appointment:checkin',
  manageServices: 'appointment:services:manage',
  manageSchedule: 'appointment:schedule:manage',
  manageSettings: 'appointment:settings:manage',
},
```

### Role Defaults

| Permission | OWNER | MANAGER | CASHIER | STOCK_CLERK |
|---|---|---|---|---|
| appointment:view | ✅ | ✅ | ✅ | ❌ |
| appointment:create | ✅ | ✅ | ✅ | ❌ |
| appointment:edit | ✅ | ✅ | ❌ | ❌ |
| appointment:cancel | ✅ | ✅ | ❌ | ❌ |
| appointment:checkin | ✅ | ✅ | ✅ | ❌ |
| appointment:services:manage | ✅ | ✅ | ❌ | ❌ |
| appointment:schedule:manage | ✅ | ✅ | ❌ | ❌ |
| appointment:settings:manage | ✅ | ✅ | ❌ | ❌ |

---

## 5. Route Structure — Pages & API

### Page Routes

```
(store)/
└── appointments/
    ├── page.tsx                              # Main appointments page (default: Calendar view)
    ├── calendar/
    │   └── page.tsx                          # Calendar view (day/week/month tabs)
    ├── list/
    │   └── page.tsx                          # List view with filters
    ├── new/
    │   └── page.tsx                          # New appointment booking form
    ├── [appointmentId]/
    │   └── page.tsx                          # Appointment detail/edit view
    ├── services/
    │   ├── page.tsx                          # Manage appointment services (CRUD)
    │   ├── new/
    │   │   └── page.tsx                      # New service form
    │   └── [serviceId]/
    │       └── edit/
    │           └── page.tsx                  # Edit service form
    └── settings/
        └── page.tsx                          # Appointment module settings
```

### API Routes

```
api/store/
└── appointments/
    ├── route.ts                              # GET (list with filters), POST (create)
    ├── [id]/
    │   ├── route.ts                          # GET, PATCH, DELETE
    │   ├── check-in/
    │   │   └── route.ts                      # POST — mark as checked in
    │   ├── complete/
    │   │   └── route.ts                      # POST — mark as completed
    │   ├── no-show/
    │   │   └── route.ts                      # POST — mark as no-show
    │   ├── cancel/
    │   │   └── route.ts                      # POST — cancel with reason
    │   └── convert-to-sale/
    │       └── route.ts                      # POST — convert to POS sale
    ├── services/
    │   ├── route.ts                          # GET, POST
    │   └── [id]/
    │       └── route.ts                      # GET, PATCH, DELETE
    ├── slots/
    │   ├── route.ts                          # GET — available slots (date, staffId, serviceId)
    │   └── generate/
    │       └── route.ts                      # POST — generate slots for a date range
    ├── availability/
    │   ├── route.ts                          # GET, POST (staff weekly schedule)
    │   └── [id]/
    │       └── route.ts                      # PATCH, DELETE
    ├── time-off/
    │   ├── route.ts                          # GET, POST
    │   └── [id]/
    │       └── route.ts                      # PATCH, DELETE
    ├── reminders/
    │   └── route.ts                          # GET, POST (trigger reminder send)
    └── stats/
        └── route.ts                          # GET — dashboard stats
```

---

## 6. Component Tree — Modular Breakdown

### Directory Structure

```
src/components/appointments/
├── index.ts                                  # Barrel exports
│
├── AppointmentsLayout.tsx                    # Layout wrapper (tabs: Calendar | List | Services | Settings)
│
├── calendar/
│   ├── CalendarView.tsx                      # Main calendar container (day/week/month toggle)
│   ├── DayView.tsx                           # Day view (hourly columns)
│   ├── WeekView.tsx                          # Week view
│   ├── MonthView.tsx                         # Month grid view
│   ├── CalendarHeader.tsx                    # Navigation (prev/next/today/ view toggle)
│   ├── CalendarAppointmentCard.tsx           # Appointment card in calendar (color-coded by status)
│   ├── AppointmentPopover.tsx                # Hover/click popover with quick actions
│   └── StaffColumn.tsx                       # Staff column in day/week view
│
├── list/
│   ├── AppointmentListView.tsx               # Table/list view with sort & filters
│   ├── AppointmentFilters.tsx                # Filter bar (status, staff, service, date range)
│   ├── AppointmentTable.tsx                  # Data table with sortable columns
│   └── AppointmentTableRow.tsx               # Single row with actions
│
├── form/
│   ├── AppointmentFormDialog.tsx             # Modal dialog for create/edit
│   ├── AppointmentForm.tsx                   # Full form (inline or dialog content)
│   ├── CustomerSelector.tsx                  # Search & select existing customer, or walk-in
│   ├── ServiceSelector.tsx                   # Select service (durations, prices)
│   ├── StaffSelector.tsx                     # Select staff member
│   ├── DateTimePicker.tsx                    # Date + time slot picker
│   ├── TimeSlotGrid.tsx                      # Visual grid of available time slots
│   ├── NotesField.tsx                        # Notes textarea
│   └── RecurrenceOptions.tsx                 # Recurring appointment configuration
│
├── detail/
│   ├── AppointmentDetailPanel.tsx            # Slide-over or side panel for appointment detail
│   ├── AppointmentStatusTimeline.tsx         # Visual timeline: Scheduled → Confirmed → Checked-in → Completed
│   ├── AppointmentActions.tsx                # Action buttons (Check-in, Complete, No-Show, Cancel, Convert to Sale)
│   ├── CancelAppointmentDialog.tsx           # Cancel with reason dialog
│   └── ConvertToSaleDialog.tsx               # Convert completed appointment to POS sale
│
├── services/
│   ├── ServiceList.tsx                       # List of appointment services
│   ├── ServiceCard.tsx                       # Service card (name, duration, price, status)
│   └── ServiceFormDialog.tsx                 # Create/edit service dialog
│
├── availability/
│   ├── StaffAvailabilityManager.tsx          # Manage weekly schedule templates
│   ├── WeeklyScheduleGrid.tsx                # Day-of-week grid with time ranges
│   ├── TimeOffRequestForm.tsx                # Request time off
│   ├── TimeOffList.tsx                       # List of time-off requests
│   └── SlotGenerator.tsx                     # Generate time slots from availability
│
├── calendar-components/
│   ├── CalendarCell.tsx                      # Individual day cell in month view
│   ├── TimeColumn.tsx                        # Time column labels (hourly)
│   └── CurrentTimeIndicator.tsx              # Red line showing current time
│
├── settings/
│   ├── AppointmentSettingsForm.tsx           # Module-level settings (reminder timing, slot defaults)
│   └── ReminderConfiguration.tsx             # Configure reminder templates & timing
│
├── stats/
│   ├── AppointmentStats.tsx                  # Dashboard widgets
│   ├── AppointmentSummaryCards.tsx           # Cards: Today's count, No-shows, Revenue
│   └── StaffUtilizationChart.tsx             # Staff booking rate chart
│
└── shared/
    ├── StatusBadge.tsx                       # Color-coded status badge
    ├── StatusSelect.tsx                      # Dropdown for changing status
    └── EmptyState.tsx                        # Empty state for no appointments
```

### Key Component Details

#### `CalendarView.tsx`
- **State**: `view` (day/week/month), `currentDate` (Date)
- **Sub-views**:
  - DayView: Hourly timeline with staff columns
  - WeekView: 7-day grid with hourly rows
  - MonthView: Traditional month calendar
- **Interaction**: Click slot → open create dialog; Click appointment → open detail popover
- **Navigation**: prev/next, today button, view toggle

#### `AppointmentFormDialog.tsx`
- Uses existing shadcn `Dialog` component
- Dynamic fields based on selection:
  1. Customer: search existing or walk-in fields
  2. Service: dropdown → auto-fills duration & price
  3. Staff: filtered by availability on selected date
  4. Date & Time: visual slot grid
  5. Notes & recurrence (optional)
- Save calls `POST /api/store/appointments` or `PATCH /api/store/appointments/[id]`

#### `AppointmentActions.tsx`
- Conditional action buttons based on current status:
  | Current Status | Available Actions |
  |---|---|
  | SCHEDULED | Confirm, Cancel, Reschedule |
  | CONFIRMED | Check In, Cancel |
  | CHECKED_IN | Start (mark In Progress) |
  | IN_PROGRESS | Complete |
  | COMPLETED | Convert to Sale |
  | NO_SHOW | Reschedule |
  | CANCELLED | (none) |

---

## 7. Service Layer — Business Logic

### New File: `src/lib/services/appointment.service.ts`

| Function | Purpose |
|---|---|
| `getAppointments(tenantId, filters)` | List appointments with filtering (status, date range, staff, service) |
| `getAppointmentById(tenantId, id)` | Single appointment with relations |
| `createAppointment(tenantId, userId, input)` | Create appointment + slot booking in transaction |
| `updateAppointment(tenantId, id, input)` | Update appointment fields |
| `cancelAppointment(tenantId, id, userId, reason)` | Cancel + free slot + create audit log |
| `checkInAppointment(tenantId, id, userId)` | Mark as checked-in + record timestamp |
| `completeAppointment(tenantId, id)` | Mark as completed |
| `markNoShow(tenantId, id)` | Mark as no-show |
| `convertToSale(tenantId, appointmentId, userId)` | Create Sale from appointment |
| `getAppointmentStats(tenantId, dateRange)` | Aggregated stats for dashboard |
| `getAvailableSlots(tenantId, date, staffId?, serviceId?)` | Compute available time slots |
| `generateSlots(tenantId, startDate, endDate)` | Generate slots from availability templates |
| `getAppointmentServices(tenantId)` | List all services |
| `createAppointmentService(tenantId, input)` | Create service |
| `updateAppointmentService(tenantId, id, input)` | Update service |
| `deleteAppointmentService(tenantId, id)` | Soft-delete service |

### New File: `src/lib/services/appointment-availability.service.ts`

| Function | Purpose |
|---|---|
| `getStaffAvailability(tenantId, staffId)` | Get weekly schedule template |
| `upsertStaffAvailability(tenantId, staffId, entries)` | Create/update weekly availability |
| `getStaffTimeOff(tenantId, staffId, dateRange)` | Get time-off records |
| `requestTimeOff(tenantId, staffId, input)` | Create time-off request |
| `approveTimeOff(tenantId, id, approverId)` | Approve time-off |
| `getAvailableStaffForSlot(tenantId, date, time, durationMins)` | Find available staff |
| `generateSlotsForRange(tenantId, staffIds, startDate, endDate)` | Batch generate slots |

### New File: `src/lib/services/appointment-reminder.service.ts`

| Function | Purpose |
|---|---|
| `scheduleReminders(appointmentId)` | Create reminder records based on config |
| `processPendingReminders()` | Cron job: send pending reminders via WhatsApp/Email |
| `getReminderHistory(appointmentId)` | Get sent reminders for an appointment |

---

## 8. Validator Schemas

### New File: `src/lib/validators/appointment.validators.ts`

```typescript
// ── Appointment Service ──
export const AppointmentServiceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  durationMins: z.number().int().min(5).max(480),
  price: z.number().min(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// ── Appointment ──
export const CreateAppointmentSchema = z.object({
  customerId: z.string().optional(),
  walkInName: z.string().max(100).optional(),
  walkInPhone: z.string().max(20).optional(),
  serviceId: z.string().optional(),
  staffId: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  durationMins: z.number().int().min(5),
  price: z.number().min(0),
  depositAmount: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
  customerNotes: z.string().max(1000).optional(),
  recurrenceType: z.nativeEnum(AppointmentRecurrenceType).optional(),
  recurrenceEndDate: z.string().datetime().optional(),
}).refine(
  (data) => data.customerId || (data.walkInName && data.walkInPhone),
  { message: 'Either customerId or walkInName + walkInPhone is required' }
);

export const UpdateAppointmentSchema = CreateAppointmentSchema.partial().omit({
  recurrenceType: true,
  recurrenceEndDate: true,
});

// ── Staff Availability ──
export const StaffAvailabilityEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isAvailable: z.boolean().optional(),
  slotDurationMins: z.number().int().min(5).max(120).optional(),
});

export const StaffAvailabilityBulkSchema = z.object({
  entries: z.array(StaffAvailabilityEntrySchema),
});

// ── Staff Time Off ──
export const StaffTimeOffSchema = z.object({
  staffId: z.string(),
  date: z.string().datetime(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
});

// ── Appointment Slot Generation ──
export const SlotGenerationSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  staffIds: z.array(z.string()).optional(), // empty = all staff
});

// ── Appointment Filters (Query params) ──
export const AppointmentFiltersSchema = z.object({
  status: z.nativeEnum(AppointmentStatus).optional(),
  staffId: z.string().optional(),
  serviceId: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().optional().default(1),
  limit: z.coerce.number().int().optional().default(50),
});

// ── Types ──
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentSchema>;
export type AppointmentServiceInput = z.infer<typeof AppointmentServiceSchema>;
export type StaffAvailabilityEntry = z.infer<typeof StaffAvailabilityEntrySchema>;
```

---

## 9. Custom Hooks

### New Directory: `src/hooks/appointments/`

```
src/hooks/appointments/
├── useAppointments.ts             # useQuery with filters (GET /api/store/appointments)
├── useAppointment.ts              # useQuery single (GET /api/store/appointments/[id])
├── useAppointmentServices.ts      # useQuery (GET /api/store/appointments/services)
├── useAppointmentService.ts       # useQuery single service
├── useAvailableSlots.ts           # useQuery (GET /api/store/appointments/slots?date=...)
├── useCreateAppointment.ts        # useMutation (POST /api/store/appointments)
├── useUpdateAppointment.ts        # useMutation (PATCH /api/store/appointments/[id])
├── useCancelAppointment.ts        # useMutation (POST .../cancel)
├── useCheckInAppointment.ts       # useMutation (POST .../check-in)
├── useCompleteAppointment.ts      # useMutation (POST .../complete)
├── useMarkNoShow.ts               # useMutation (POST .../no-show)
├── useConvertToSale.ts            # useMutation (POST .../convert-to-sale)
├── useStaffAvailability.ts        # useQuery (GET /api/store/appointments/availability)
├── useStaffTimeOff.ts             # useQuery (GET /api/store/appointments/time-off)
├── useUpsertAvailability.ts       # useMutation (POST /api/store/appointments/availability)
├── useGenerateSlots.ts            # useMutation (POST /api/store/appointments/slots/generate)
├── useAppointmentStats.ts         # useQuery (GET /api/store/appointments/stats)
└── index.ts                       # Barrel exports
```

### Hook Pattern (Example)

```typescript
// useAppointments.ts
import { useQuery } from '@tanstack/react-query';
import type { AppointmentStatus } from '@/generated/prisma/client';

interface AppointmentFilters {
  status?: AppointmentStatus;
  staffId?: string;
  serviceId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export function useAppointments(filters: AppointmentFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });

  return useQuery({
    queryKey: ['appointments', filters],
    queryFn: async () => {
      const res = await fetch(`/api/store/appointments?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as { appointments: Appointment[]; total: number };
    },
    staleTime: 30_000,
  });
}
```

---

## 10. State Management (Zustand)

### New File: `src/stores/appointmentStore.ts`

```typescript
import { create } from 'zustand';

type CalendarView = 'day' | 'week' | 'month';

interface AppointmentStore {
  // Calendar state
  currentDate: Date;
  calendarView: CalendarView;
  setCurrentDate: (date: Date) => void;
  setCalendarView: (view: CalendarView) => void;

  // Selection state
  selectedAppointmentId: string | null;
  selectedStaffId: string | null;
  selectedServiceId: string | null;
  setSelectedAppointmentId: (id: string | null) => void;
  setSelectedStaffId: (id: string | null) => void;
  setSelectedServiceId: (id: string | null) => void;

  // Dialog state
  isFormOpen: boolean;
  isDetailOpen: boolean;
  editingAppointmentId: string | null;
  openCreateForm: () => void;
  openEditForm: (id: string) => void;
  openDetail: (id: string) => void;
  closeForm: () => void;
  closeDetail: () => void;

  // Navigation
  next: () => void;
  previous: () => void;
  goToToday: () => void;
}
```

---

## 11. Calendar Views & UI Patterns

### Day View Layout

```
┌─────────────────────────────────────────────────────┐
│  < Mon, Jul 29, 2026 >    [Day] [Week] [Month]     │
├──────┬──────────┬──────────┬──────────┬──────────────┤
│ Time │ Staff A  │ Staff B  │ Staff C  │ (More cols)  │
├──────┼──────────┼──────────┼──────────┼──────────────┤
│ 8:00 │          │          │          │              │
│ 8:15 │ [───Appt───]        │          │              │
│ 8:30 │ (John D. -Consult)  │          │              │
│ 8:45 │          │          │          │              │
│ 9:00 │          │ [───Appt──]         │              │
│ 9:15 │          │ (Jane - Therapy)    │              │
│ 9:30 │          │          │          │              │
└──────┴──────────┴──────────┴──────────┴──────────────┘
```

### Week View Layout

```
┌────────────────────────────────────────────────────────┐
│  < Jul 28 - Aug 3, 2026 >   [Day] [Week] [Month]      │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┤
│ Time │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │ Sun  │
│      │ 28   │ 29   │ 30   │ 31   │ Aug1 │ Aug2 │ Aug3 │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ 8:00 │      │      │      │      │      │      │      │
│ 9:00 │ Appt │      │ Appt │      │      │      │      │
│ 10:00│      │ Appt │      │ Appt │      │      │      │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

### Month View Layout

```
┌────────────────────────────────────────────────────────┐
│  < July 2026 >              [Day] [Week] [Month]       │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┤
│ Sun  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│      │      │      │  1   │  2   │  3   │  4   │      │
│      │      │      │ •2   │ •1   │ •3   │      │      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│  5   │  6   │  7   │  8   │  9   │  10  │  11  │      │
│ •4   │ •2   │      │ •1   │ •5   │ •2   │      │      │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
  (•N = Number of appointments that day, color-coded dots)
```

### Color Coding by Status

| Status | Color |
|---|---|
| SCHEDULED | Blue (`#3B82F6`) |
| CONFIRMED | Indigo (`#6366F1`) |
| CHECKED_IN | Amber (`#F59E0B`) |
| IN_PROGRESS | Violet (`#8B5CF6`) |
| COMPLETED | Green (`#22C55E`) |
| NO_SHOW | Red (`#EF4444`) |
| CANCELLED | Gray (`#6B7280`) |

---

## 12. Staff Scheduling & Availability

### How It Works

1. **Weekly Template**: Each staff member has a `StaffAvailability` record per day-of-week (e.g., Mon-Fri 9:00-17:00, Sat 9:00-13:00)
2. **Time Off**: `StaffTimeOff` records override weekly template for specific dates
3. **Slot Generation**: A scheduled job or manual action generates `AppointmentSlot` records for a date range
4. **Slot Occupancy**: When an appointment is created, the corresponding slot is marked `isBooked: true`

### Availability Management UI

```
┌─── Staff Availability ─────────────────────────────┐
│ Staff: [Dropdown ▼]                                 │
│                                                     │
│ Day        | Available | Start | End | Slot Duration│
│ ─────────────────────────────────────────────────── │
│ Monday     |    ☑     | 09:00 | 17:00 | 15 min    │
│ Tuesday    |    ☑     | 09:00 | 17:00 | 15 min    │
│ Wednesday  |    ☑     | 09:00 | 17:00 | 15 min    │
│ Thursday   |    ☑     | 09:00 | 17:00 | 15 min    │
│ Friday     |    ☑     | 09:00 | 17:00 | 15 min    │
│ Saturday   |    ☐     | 09:00 | 13:00 | 30 min    │
│ Sunday     |    ☐     |  —    |  —    | —         │
│                                                     │
│ [Save Availability]  [Generate Slots for Next Week] │
└─────────────────────────────────────────────────────┘
```

---

## 13. Reminders & Notifications

### Reminder Schedule

| Reminder | When | Channel |
|---|---|---|
| Confirmation | Immediately after booking | WhatsApp / In-app |
| Reminder #1 | 24 hours before | WhatsApp |
| Reminder #2 | 2 hours before | WhatsApp |
| Follow-up | After completion (no-show or completed) | WhatsApp |

### Integration with Existing Systems

- **WhatsApp**: Use existing WhatsApp Business API integration (`src/lib/services/whatsapp.service.ts`)
- **In-App Notifications**: Use existing `NotificationRecord` model and notification infrastructure
- **Email**: Use existing `sendEmail()` service (`src/lib/services/email.service.ts`)

### Background Processing

- A cron job or serverless function runs every 15 minutes
- Queries `AppointmentReminder` where `status = PENDING` and `scheduledFor <= NOW()`
- Sends reminder via the configured channel
- Updates `AppointmentReminder.status` to `SENT` or `FAILED`

---

## 14. POS Integration — Convert Appointment to Sale

### Flow

1. Appointment status must be `COMPLETED`
2. Staff clicks "Convert to Sale"
3. System loads appointment details:
   - Customer (from `customerId` or creates walk-in as customer)
   - Service price as the sale amount
4. Opens POS with pre-populated cart:
   - Service name as a line item
   - Customer pre-selected
5. Staff completes payment normally
6. On completion:
   - `Appointment.saleId` linked to the new Sale
   - Audit log created

### API Endpoint

```
POST /api/store/appointments/:id/convert-to-sale
→ Creates a Sale record, links appointment
→ Returns sale ID
→ Opens POS with pre-populated cart
```

---

## 15. Customer-Facing Features (Future)

These features are scoped for a **future phase** and rely on the website/ customer-facing app:

- **Online Booking Widget**: Customers book appointments via the website
- **Self-Service Reschedule/Cancel**: Customers manage their own appointments
- **Appointment History in Customer Portal**: Customers view past appointments
- **Automated WhatsApp Booking Confirmation**: Two-way WhatsApp interaction

---

## 16. Reporting & Analytics

### Dashboard Widgets (Appointments Tab)

| Widget | Data Source |
|---|---|
| **Today's Appointments** | Count of appointments for today, grouped by status |
| **Appointment Revenue** | Sum of prices for completed appointments (period) |
| **No-Show Rate** | `(no_show_count / total_appointments) * 100` |
| **Staff Utilization** | `(booked_slots / total_slots) * 100` per staff |
| **Popular Services** | Service booking frequency ranking |
| **Appointment Trends** | Daily/weekly booking volume chart |

### New Report: `src/app/(store)/appointments/reports/page.tsx`

### Stats API

```
GET /api/store/appointments/stats?dateFrom=...&dateTo=...
→ { total, byStatus, noShowRate, revenue, staffUtilization, popularServices }
```

---

## 17. Implementation Phases

### Phase 1 — Foundation (Week 1)
1. Add new enums and models to `prisma/schema.prisma`
2. Run Prisma migration
3. Add `APPOINTMENT` permission group to `permissions.ts`
4. Create feature toggle: `FeatureModulesManager.tsx` + API route
5. Create service layer: `appointment.service.ts`, `appointment-availability.service.ts`
6. Create validators: `appointment.validators.ts`
7. Create basic API routes: `appointments/route.ts`, `appointments/[id]/route.ts`
8. Create `feature-guard.ts`

### Phase 2 — Calendar & Booking UI (Week 2)
1. Create Zustand store: `appointmentStore.ts`
2. Create hooks: `useAppointments`, `useAppointment`, `useCreateAppointment`, etc.
3. Build calendar components: `CalendarView`, `DayView`, `WeekView`, `MonthView`
4. Build form components: `AppointmentFormDialog`, `CustomerSelector`, `ServiceSelector`, etc.
5. Build detail components: `AppointmentDetailPanel`, `AppointmentActions`
6. Build list view: `AppointmentListView`, `AppointmentFilters`
7. Create main page: `appointments/page.tsx`
8. Add navigation entry to `StoreSidebar.tsx`

### Phase 3 — Staff Management & Scheduling (Week 3)
1. Create availability API routes
2. Build availability UI components
3. Build slot generation logic
4. Create time-off management
5. Build `StaffAvailabilityManager` component

### Phase 4 — Services Management (Week 3)
1. Create services API routes (CRUD)
2. Build services UI: `ServiceList`, `ServiceCard`, `ServiceFormDialog`
3. Create services pages
4. Wire service selector into appointment form

### Phase 5 — Reminders & Notifications (Week 4)
1. Create `appointment-reminder.service.ts`
2. Create reminder models and API routes
3. Build reminder configuration UI in settings
4. Implement background reminder processing
5. Integrate with WhatsApp notification system

### Phase 6 — POS Integration & Reports (Week 4)
1. Build convert-to-sale flow
2. Create stats API endpoint
3. Build reporting widgets
4. Create appointments reports page
5. Add dashboard summary cards

### Phase 7 — Settings & Polish (Week 4)
1. Build settings page: `AppointmentSettingsForm`
2. Add module-level configuration
3. Error handling & edge cases
4. Loading states & skeletons
5. Responsive design refinements

---

## 18. File Inventory — Complete List of Files to Create

### Prisma
| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Add enums + 6 new models (modify existing file) |

### Feature Toggle (Superadmin)
| File | Purpose |
|---|---|
| `src/lib/feature-guard.ts` | Feature toggle utility (isModuleEnabled) |
| `src/components/superadmin/FeatureModulesManager.tsx` | UI for enabling modules per tenant |
| `src/app/api/superadmin/tenants/[id]/feature-modules/route.ts` | API for toggling modules |

### Permissions
| File | Purpose |
|---|---|
| `src/lib/constants/permissions.ts` | Add APPOINTMENT group (modify existing file) |

### Services
| File | Purpose |
|---|---|
| `src/lib/services/appointment.service.ts` | Core appointment business logic |
| `src/lib/services/appointment-availability.service.ts` | Staff availability & slot generation |
| `src/lib/services/appointment-reminder.service.ts` | Reminder scheduling & processing |

### Validators
| File | Purpose |
|---|---|
| `src/lib/validators/appointment.validators.ts` | All Zod schemas for appointments |

### Hooks
| File | Purpose |
|---|---|
| `src/hooks/appointments/useAppointments.ts` | List query |
| `src/hooks/appointments/useAppointment.ts` | Single query |
| `src/hooks/appointments/useAppointmentServices.ts` | Services list query |
| `src/hooks/appointments/useAppointmentService.ts` | Single service query |
| `src/hooks/appointments/useAvailableSlots.ts` | Available slots query |
| `src/hooks/appointments/useCreateAppointment.ts` | Create mutation |
| `src/hooks/appointments/useUpdateAppointment.ts` | Update mutation |
| `src/hooks/appointments/useCancelAppointment.ts` | Cancel mutation |
| `src/hooks/appointments/useCheckInAppointment.ts` | Check-in mutation |
| `src/hooks/appointments/useCompleteAppointment.ts` | Complete mutation |
| `src/hooks/appointments/useMarkNoShow.ts` | No-show mutation |
| `src/hooks/appointments/useConvertToSale.ts` | Convert to sale mutation |
| `src/hooks/appointments/useStaffAvailability.ts` | Staff availability query |
| `src/hooks/appointments/useStaffTimeOff.ts` | Staff time-off query |
| `src/hooks/appointments/useUpsertAvailability.ts` | Upsert availability mutation |
| `src/hooks/appointments/useGenerateSlots.ts` | Generate slots mutation |
| `src/hooks/appointments/useAppointmentStats.ts` | Stats query |
| `src/hooks/appointments/index.ts` | Barrel exports |

### Zustand Store
| File | Purpose |
|---|---|
| `src/stores/appointmentStore.ts` | Appointments UI state |

### Components
| File | Purpose |
|---|---|
| `src/components/appointments/index.ts` | Barrel exports |
| `src/components/appointments/AppointmentsLayout.tsx` | Layout wrapper |
| `src/components/appointments/calendar/CalendarView.tsx` | Calendar container |
| `src/components/appointments/calendar/DayView.tsx` | Day view |
| `src/components/appointments/calendar/WeekView.tsx` | Week view |
| `src/components/appointments/calendar/MonthView.tsx` | Month view |
| `src/components/appointments/calendar/CalendarHeader.tsx` | Calendar navigation |
| `src/components/appointments/calendar/CalendarAppointmentCard.tsx` | Appointment card |
| `src/components/appointments/calendar/AppointmentPopover.tsx` | Quick actions popover |
| `src/components/appointments/calendar/StaffColumn.tsx` | Staff column |
| `src/components/appointments/list/AppointmentListView.tsx` | List view |
| `src/components/appointments/list/AppointmentFilters.tsx` | Filter bar |
| `src/components/appointments/list/AppointmentTable.tsx` | Data table |
| `src/components/appointments/list/AppointmentTableRow.tsx` | Table row |
| `src/components/appointments/form/AppointmentFormDialog.tsx` | Create/edit dialog |
| `src/components/appointments/form/AppointmentForm.tsx` | Form content |
| `src/components/appointments/form/CustomerSelector.tsx` | Customer search |
| `src/components/appointments/form/ServiceSelector.tsx` | Service picker |
| `src/components/appointments/form/StaffSelector.tsx` | Staff picker |
| `src/components/appointments/form/DateTimePicker.tsx` | Date + time picker |
| `src/components/appointments/form/TimeSlotGrid.tsx` | Slot grid |
| `src/components/appointments/form/NotesField.tsx` | Notes input |
| `src/components/appointments/form/RecurrenceOptions.tsx` | Recurrence config |
| `src/components/appointments/detail/AppointmentDetailPanel.tsx` | Detail slide-over |
| `src/components/appointments/detail/AppointmentStatusTimeline.tsx` | Status timeline |
| `src/components/appointments/detail/AppointmentActions.tsx` | Action buttons |
| `src/components/appointments/detail/CancelAppointmentDialog.tsx` | Cancel dialog |
| `src/components/appointments/detail/ConvertToSaleDialog.tsx` | Convert dialog |
| `src/components/appointments/services/ServiceList.tsx` | Services list |
| `src/components/appointments/services/ServiceCard.tsx` | Service card |
| `src/components/appointments/services/ServiceFormDialog.tsx` | Service form |
| `src/components/appointments/availability/StaffAvailabilityManager.tsx` | Availability manager |
| `src/components/appointments/availability/WeeklyScheduleGrid.tsx` | Weekly grid |
| `src/components/appointments/availability/TimeOffRequestForm.tsx` | Time-off form |
| `src/components/appointments/availability/TimeOffList.tsx` | Time-off list |
| `src/components/appointments/availability/SlotGenerator.tsx` | Slot generator |
| `src/components/appointments/settings/AppointmentSettingsForm.tsx` | Settings form |
| `src/components/appointments/settings/ReminderConfiguration.tsx` | Reminder config |
| `src/components/appointments/stats/AppointmentStats.tsx` | Stats container |
| `src/components/appointments/stats/AppointmentSummaryCards.tsx` | Summary cards |
| `src/components/appointments/stats/StaffUtilizationChart.tsx` | Utilization chart |
| `src/components/appointments/shared/StatusBadge.tsx` | Status badge |
| `src/components/appointments/shared/StatusSelect.tsx` | Status select |
| `src/components/appointments/shared/EmptyState.tsx` | Empty state |

### Pages
| File | Purpose |
|---|---|
| `src/app/(store)/appointments/page.tsx` | Main appointments page |
| `src/app/(store)/appointments/calendar/page.tsx` | Calendar view |
| `src/app/(store)/appointments/list/page.tsx` | List view |
| `src/app/(store)/appointments/new/page.tsx` | New appointment |
| `src/app/(store)/appointments/[appointmentId]/page.tsx` | Appointment detail |
| `src/app/(store)/appointments/services/page.tsx` | Services management |
| `src/app/(store)/appointments/services/new/page.tsx` | New service |
| `src/app/(store)/appointments/services/[serviceId]/edit/page.tsx` | Edit service |
| `src/app/(store)/appointments/settings/page.tsx` | Module settings |

### API Routes
| File | Purpose |
|---|---|
| `src/app/api/store/appointments/route.ts` | List + Create |
| `src/app/api/store/appointments/[id]/route.ts` | Get + Update + Delete |
| `src/app/api/store/appointments/[id]/check-in/route.ts` | Check-in |
| `src/app/api/store/appointments/[id]/complete/route.ts` | Complete |
| `src/app/api/store/appointments/[id]/no-show/route.ts` | No-show |
| `src/app/api/store/appointments/[id]/cancel/route.ts` | Cancel |
| `src/app/api/store/appointments/[id]/convert-to-sale/route.ts` | Convert to sale |
| `src/app/api/store/appointments/services/route.ts` | List + Create services |
| `src/app/api/store/appointments/services/[id]/route.ts` | Get + Update + Delete service |
| `src/app/api/store/appointments/slots/route.ts` | Get available slots |
| `src/app/api/store/appointments/slots/generate/route.ts` | Generate slots |
| `src/app/api/store/appointments/availability/route.ts` | Get + Upsert availability |
| `src/app/api/store/appointments/availability/[id]/route.ts` | Update + Delete availability |
| `src/app/api/store/appointments/time-off/route.ts` | List + Create time-off |
| `src/app/api/store/appointments/time-off/[id]/route.ts` | Update + Delete time-off |
| `src/app/api/store/appointments/reminders/route.ts` | Get + Send reminders |
| `src/app/api/store/appointments/stats/route.ts` | Dashboard stats |

### Files to Modify (Existing)
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add enums + 6 new models |
| `src/lib/constants/permissions.ts` | Add APPOINTMENT group |
| `src/components/layout/StoreSidebar.tsx` | Add Appointments nav item |
| `src/app/(superadmin)/superadmin/tenants/[tenantId]/page.tsx` | Add FeatureModulesManager section |
| `src/lib/services/tenant.service.ts` | Add feature module update logic |

---

**Total: ~85 new files + 5 modified files**

---

*End of Plan*
