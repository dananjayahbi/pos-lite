import { create } from 'zustand';

export type CalendarView = 'day' | 'week' | 'month';

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

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

export const useAppointmentStore = create<AppointmentStore>((set, get) => ({
  currentDate: new Date(),
  calendarView: 'day',
  setCurrentDate: (date) => set({ currentDate: date }),
  setCalendarView: (view) => set({ calendarView: view }),

  selectedAppointmentId: null,
  selectedStaffId: null,
  selectedServiceId: null,
  setSelectedAppointmentId: (id) => set({ selectedAppointmentId: id }),
  setSelectedStaffId: (id) => set({ selectedStaffId: id }),
  setSelectedServiceId: (id) => set({ selectedServiceId: id }),

  isFormOpen: false,
  isDetailOpen: false,
  editingAppointmentId: null,
  openCreateForm: () => set({ isFormOpen: true, editingAppointmentId: null, isDetailOpen: false }),
  openEditForm: (id) => set({ isFormOpen: true, editingAppointmentId: id, isDetailOpen: false }),
  openDetail: (id) => set({ isDetailOpen: true, selectedAppointmentId: id, isFormOpen: false }),
  closeForm: () => set({ isFormOpen: false, editingAppointmentId: null }),
  closeDetail: () => set({ isDetailOpen: false, selectedAppointmentId: null }),

  next: () => {
    const { currentDate, calendarView } = get();
    if (calendarView === 'day') set({ currentDate: addDays(currentDate, 1) });
    else if (calendarView === 'week') set({ currentDate: addDays(currentDate, 7) });
    else set({ currentDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1) });
  },
  previous: () => {
    const { currentDate, calendarView } = get();
    if (calendarView === 'day') set({ currentDate: addDays(currentDate, -1) });
    else if (calendarView === 'week') set({ currentDate: addDays(currentDate, -7) });
    else set({ currentDate: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1) });
  },
  goToToday: () => set({ currentDate: new Date() }),
}));
