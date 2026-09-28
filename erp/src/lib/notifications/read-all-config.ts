/**
 * Shared operational limits for the notifications module.
 *
 * M32-02 (OBS-61) — `PATCH /api/notifications/read-all` used to issue a single
 * unbounded `updateMany`: one statement that takes row locks for the whole
 * unread set. Fine at the QA fixture's ~260 rows, a table-level hazard once a
 * tenant accumulates a real backlog. The route now sweeps in chunks of this
 * size, so the longest-held lock is bounded by one chunk.
 */
export const READ_ALL_CHUNK_SIZE = 500;