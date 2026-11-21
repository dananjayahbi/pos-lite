/**
 * Remove QA/fixture appointment data (ARGUS #122).
 *
 * The live tenant accumulated QA appointments, DeleteMe services and pending
 * reminders that make the appointment module look like a test environment.
 * This CLI is conservative and never runs automatically:
 *
 *   npx tsx scripts/cleanup-appointment-fixtures.ts                  # dry run
 *   npx tsx scripts/cleanup-appointment-fixtures.ts --apply          # delete safe fixtures
 *   npx tsx scripts/cleanup-appointment-fixtures.ts --tenant=<id>    # one tenant
 *   npx tsx scripts/cleanup-appointment-fixtures.ts --include-active # also scheduled fixtures
 *
 * Safety:
 * - Appointments linked to a sale are never deleted.
 * - Only fixture-titled/booked rows are touched, and only CANCELLED / NO_SHOW
 *   rows unless --include-active is passed.
 * - Reminders are deleted first (no cascade on that relation), then the slot is
 *   freed and the appointment deleted.
 * - Fixture services are soft-deleted only when no remaining appointment uses
 *   them. Ambiguous rows are listed for a human.
 */
import { prisma } from '@/lib/prisma';
import { isFixtureAppointment, isFixtureServiceName } from '@/lib/appointments/fixtures.core';

const apply = process.argv.includes('--apply');
const includeActive = process.argv.includes('--include-active');
const tenantArg = process.argv.find((arg) => arg.startsWith('--tenant='));
const tenantId = tenantArg?.slice('--tenant='.length).trim() || undefined;

const SAFE_STATUSES = new Set(['CANCELLED', 'NO_SHOW']);

async function main() {
  const appointments = await prisma.appointment.findMany({
    where: { ...(tenantId ? { tenantId } : {}) },
    include: { service: { select: { name: true } } },
  });

  const fixtures = appointments.filter((appointment) =>
    isFixtureAppointment({
      title: appointment.title,
      walkInName: appointment.walkInName,
    }),
  );

  const deletable = fixtures.filter(
    (appointment) =>
      !appointment.saleId &&
      (includeActive || SAFE_STATUSES.has(appointment.status)),
  );
  const skipped = fixtures.filter((appointment) => !deletable.includes(appointment));

  console.log(
    `Found ${fixtures.length} fixture appointment(s) across ${appointments.length} total; ` +
      `${deletable.length} ${apply ? 'will be deleted' : 'safe to delete'}.`,
  );

  for (const appointment of deletable) {
    console.log(
      `  ${apply ? 'DELETE' : 'would delete'} ${appointment.id} [${appointment.status}] ` +
        `${appointment.title.slice(0, 80)} (${appointment.startTime.toISOString().slice(0, 10)})`,
    );
  }
  for (const appointment of skipped) {
    const reason = appointment.saleId
      ? 'linked sale'
      : `status ${appointment.status}`;
    console.log(`  SKIP ${appointment.id} (${reason}) ${appointment.title.slice(0, 80)}`);
  }

  if (apply) {
    for (const appointment of deletable) {
      await prisma.$transaction(async (tx) => {
        await tx.appointmentReminder.deleteMany({ where: { appointmentId: appointment.id } });
        if (appointment.slotId) {
          await tx.appointmentSlot.update({
            where: { id: appointment.slotId },
            data: { isBooked: false, appointmentId: null },
          });
        }
        await tx.appointment.delete({ where: { id: appointment.id } });
      });
    }
  }

  // Fixture services: soft-delete only when nothing still references them.
  const services = await prisma.appointmentService.findMany({
    where: { ...(tenantId ? { tenantId } : {}), deletedAt: null },
    include: { _count: { select: { appointments: true } } },
  });
  const fixtureServices = services.filter((service) => isFixtureServiceName(service.name));
  for (const service of fixtureServices) {
    if (service._count.appointments > 0) {
      console.log(`  SKIP service ${service.name} (${service._count.appointments} appointment(s))`);
      continue;
    }
    console.log(`  ${apply ? 'SOFT-DELETE' : 'would soft-delete'} service ${service.name}`);
    if (apply) {
      await prisma.appointmentService.update({
        where: { id: service.id },
        data: { deletedAt: new Date(), isActive: false },
      });
    }
  }

  console.log('Done.');
  if (!apply) console.log('Re-run with --apply to make these changes.');
}

main()
  .catch((error) => {
    console.error('cleanup-appointment-fixtures failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
