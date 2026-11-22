/**
 * Conservative classifier for QA/fixture appointment data (ARGUS #122).
 *
 * The live tenant accumulated QA appointments ("QA ...", "Test ...", "F1 ...",
 * "Module 27 ..."), DeleteMe services and a far-future 200-character title.
 * Only obvious fixture markers are matched so a real booking is never removed
 * by the cleanup script; anything ambiguous is listed for a human.
 */
const APPOINTMENT_PATTERNS: RegExp[] = [
  /^\s*qa\b/i,
  /\bqa\s*[-_#]/i,
  /^\s*test\b/i,
  /^\s*f\d+/i,
  /^\s*module\s*\d+/i,
  /\bdeleteme\b/i,
];

const SERVICE_PATTERNS: RegExp[] = [/^\s*qa\b/i, /^\s*test\b/i, /\bdeleteme\b/i];

export function isFixtureAppointmentTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const trimmed = title.trim();
  if (trimmed.length > 120) return true; // the reported 200-char fixture title
  return APPOINTMENT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isFixtureServiceName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  return SERVICE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export interface FixtureAppointmentLike {
  title: string | null;
  walkInName?: string | null;
  customerName?: string | null;
}

export function isFixtureAppointment(appointment: FixtureAppointmentLike): boolean {
  if (isFixtureAppointmentTitle(appointment.title)) return true;
  const walkIn = appointment.walkInName?.trim() ?? '';
  if (walkIn && APPOINTMENT_PATTERNS.some((pattern) => pattern.test(walkIn))) return true;
  return false;
}
