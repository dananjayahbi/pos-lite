# Orphaned courier waybills on dispatch rollback

Dispatch uploads to the courier before the local transaction (stock/packaging
checks, shipment row, status flip). If the transaction fails after the upload,
the courier already has a waybill while the delivery stayed `PENDING_DISPATCH`.

The courier adapter has no cancel/void operation, so the fix makes the orphan
explicit and durable:

- the transaction failure is caught;
- a `DELIVERY_DISPATCH_ORPHANED` audit row records the waybill id, courier order
  id and the rollback reason (written through the durable audit writer);
- the caller receives `DISPATCH_ROLLED_BACK_WITH_WAYBILL:<waybillId>` so the
  operator can cancel the waybill with the courier.

The audit write is best-effort so a missing audit ledger cannot hide the original
failure. A full reservation-first or cancel-on-rollback flow needs a courier
cancel API and is a separate change.
