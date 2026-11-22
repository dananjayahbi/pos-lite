/**
 * Customer master-data audit snapshots (ARGUS #315).
 *
 * Customer create/update/delete/import had no audit rows. The service writes a
 * before/after snapshot; keeping the snapshot builder pure lets the field set
 * and date serialisation be tested without a database.
 */

export interface CustomerAuditActor {
  id: string;
  role?: string | undefined;
}

export interface CustomerAuditRecord {
  name: string;
  phone: string;
  phone2: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  gender: string | null;
  birthday: Date | null;
  tags: string[];
  notes: string | null;
  isActive: boolean;
}

export function customerAuditSnapshot(customer: CustomerAuditRecord) {
  return {
    name: customer.name,
    phone: customer.phone,
    phone2: customer.phone2,
    email: customer.email,
    address: customer.address,
    city: customer.city,
    gender: customer.gender,
    birthday: customer.birthday ? customer.birthday.toISOString() : null,
    tags: customer.tags,
    notes: customer.notes,
    isActive: customer.isActive,
  };
}
