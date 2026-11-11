import type { z } from 'zod';
import type {
  CreateCustomerInput,
  CreateCustomerSchema,
} from '@/lib/validators/customer.validators';

/** The subset of a customer record the drawer form needs to pre-fill. */
export interface CustomerFormSource {
  id?: string;
  name: string;
  phone: string;
  phone2?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  gender?: string | null;
  birthday?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}

export type CustomerFormValues = z.input<typeof CreateCustomerSchema>;

/**
 * Map an API customer row to the editable drawer values.
 *
 * Nullable API columns become the empty strings/undefined the form controls
 * expect, `birthday` is reduced to the `YYYY-MM-DD` an `<input type="date">`
 * understands, and missing tags become an empty array. Keeping this pure makes
 * the edit-prefill contract unit-testable without mounting the drawer.
 */
export function customerToFormValues(customer?: CustomerFormSource): CustomerFormValues {
  return {
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    phone2: customer?.phone2 ?? '',
    email: customer?.email ?? undefined,
    address: customer?.address ?? '',
    city: customer?.city ?? '',
    gender: (customer?.gender as CreateCustomerInput['gender']) ?? undefined,
    birthday: customer?.birthday ? customer.birthday.split('T')[0] : undefined,
    tags: customer?.tags ? [...customer.tags] : [],
    notes: customer?.notes ?? undefined,
  };
}
