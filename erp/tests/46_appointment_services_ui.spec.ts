/**
 * Issue #26 — Appointment services catalogue UI.
 *
 * Pins the rebuilt /appointments/services screen: the header/summary strip
 * renders, and a manager can create, edit and remove a service from the UI
 * (previously the Add button opened nothing, Edit had no data and Delete was a
 * no-op). The test cleans up after itself through the API so repeated runs do
 * not accumulate services.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const SERVICES_API = `${BASE}/api/store/appointments/services`;
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const RUN = `qa-svc-ui-${Date.now()}`;

async function loginOwner(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', OWNER.email);
  await page.fill('input[name="password"]', OWNER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|pos)/i, { timeout: 30_000 });
}

async function removeRunServices(page: Page): Promise<void> {
  try {
    const res = await page.request.get(SERVICES_API);
    if (!res.ok()) return;
    const body = await res.json();
    const services = (body?.data ?? []) as Array<{ id: string; name: string }>;
    for (const service of services) {
      if (service.name.startsWith(RUN)) {
        await page.request.delete(`${SERVICES_API}/${service.id}`);
      }
    }
  } catch {
    /* best-effort cleanup */
  }
}

test.describe('Appointment services catalogue UI', () => {
  test('F1 — create, edit and remove a service through the services page', async ({ page }) => {
    test.setTimeout(120_000);
    await loginOwner(page);

    try {
      await page.goto(`${BASE}/appointments/services`);
      await expect(
        page.getByRole('heading', { name: 'Appointment Services', level: 1 }),
      ).toBeVisible();
      await expect(page.getByText('PRICE RANGE')).toBeVisible();

      // ── Create ──
      const createdName = `${RUN} Consultation`;
      await page.getByRole('button', { name: 'Add service' }).click();
      let dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'New service' })).toBeVisible();

      await dialog.getByLabel('Service name').fill(createdName);
      await dialog.getByLabel('Description').fill('Created by the services UI smoke test');
      await dialog.getByLabel('Price (LKR)').fill('1234.50');
      await dialog.getByRole('button', { name: '60 min' }).click();
      await dialog.getByRole('button', { name: 'Create service' }).click();
      await expect(dialog).toBeHidden();

      let card = page.locator('article').filter({ hasText: createdName });
      await expect(card).toBeVisible();
      await expect(card.getByText('Rs. 1,234.50')).toBeVisible();
      await expect(card.getByText('60 min')).toBeVisible();

      // ── Edit (the dialog must be pre-filled) ──
      await card.getByRole('button', { name: 'Edit' }).click();
      dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Edit service' })).toBeVisible();
      await expect(dialog.getByLabel('Service name')).toHaveValue(createdName);
      await expect(dialog.getByLabel('Price (LKR)')).toHaveValue('1234.5');

      const editedName = `${createdName} Edited`;
      await dialog.getByLabel('Service name').fill(editedName);
      await dialog.getByLabel('Price (LKR)').fill('1500');
      await dialog.getByRole('button', { name: 'Save changes' }).click();
      await expect(dialog).toBeHidden();

      card = page.locator('article').filter({ hasText: editedName });
      await expect(card).toBeVisible();
      await expect(card.getByText('Rs. 1,500.00')).toBeVisible();

      // ── Delete with confirmation ──
      await card.getByRole('button', { name: 'Delete' }).click();
      const confirm = page.getByRole('dialog');
      await expect(confirm.getByRole('heading', { name: 'Remove service' })).toBeVisible();
      await expect(confirm.getByText(editedName)).toBeVisible();
      await confirm.getByRole('button', { name: 'Remove service' }).click();

      await expect(page.locator('article').filter({ hasText: editedName })).toHaveCount(0);
    } finally {
      await removeRunServices(page);
    }
  });
});
