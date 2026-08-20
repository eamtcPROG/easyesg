/**
 * One queue, named once.
 *
 * AD-10 says "**A** BullMQ queue on Redis carries PDF generation, Excel template population,
 * e-Factura transmission, email dispatch, dunning runs, reconciliation imports, taxonomy migration
 * runs, trial and invitation expiry, metering rollups and backup verification" — singular. The kind
 * of work is the **job name**, which is the outbox row's `event_type`, so a consumer registers for
 * the names it handles rather than for a queue of its own.
 *
 * A queue name is durable in Redis and consumers bind to it, so splitting later is a migration
 * rather than a refactor. NFR-46's wording ("flooding the export queue") reads as though export
 * might want its own; that is a capacity question for task 44, when there is a consumer to measure.
 */
export const OUTBOX_QUEUE = 'easyesg';
