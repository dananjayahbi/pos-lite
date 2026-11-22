/**
 * ARGUS #306 - the label-template audit trail only recorded that something
 * changed. These pure helpers extract the printable sender snapshot from an
 * audit row and describe each changed field so the designer can show a
 * reviewable before/after history.
 */

export interface LabelSenderSnapshot {
  brandName?: string | null | undefined;
  fromContact?: string | null | undefined;
  pickupAddress?: string | null | undefined;
}

export interface LabelSenderChange {
  field: 'Sender name' | 'Sender contact' | 'Pickup address';
  from: string;
  to: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Read a sender snapshot from a Prisma JSON audit value. */
export function toLabelSenderSnapshot(value: unknown): LabelSenderSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return {
    brandName: text(raw.brandName),
    fromContact: text(raw.fromContact),
    pickupAddress: text(raw.pickupAddress),
  };
}

/** Only the sender fields that actually changed, in label order. */
export function labelSenderChanges(
  before: LabelSenderSnapshot | null | undefined,
  after: LabelSenderSnapshot | null | undefined,
): LabelSenderChange[] {
  const fields: Array<{
    key: keyof LabelSenderSnapshot;
    field: LabelSenderChange['field'];
  }> = [
    { key: 'brandName', field: 'Sender name' },
    { key: 'fromContact', field: 'Sender contact' },
    { key: 'pickupAddress', field: 'Pickup address' },
  ];

  return fields
    .map(({ key, field }) => ({
      field,
      from: text(before?.[key]),
      to: text(after?.[key]),
    }))
    .filter((change) => change.from !== change.to);
}
