/**
 * The queues, each named once.
 *
 * AD-10 said "**A** BullMQ queue on Redis carries PDF generation, Excel template population, e-Factura transmission,
 * email dispatch, dunning runs, reconciliation imports, taxonomy migration runs, trial and invitation expiry, metering
 * rollups and backup verification" — singular — and the kind of work is the **job name**, the outbox row's
 * `event_type`, so a consumer registers for the names it handles rather than for a queue of its own.
 *
 * **Document generation has had a queue of its own since task 44.5** (project owner, 11 Oct 2026; `architecture.md`
 * §12.5.6's task-44 row (5), AD-10 as amended). Measured: on the one queue, eight exports held an email enqueued after
 * them for the whole burst, 17.2 s, where on a queue of their own it waited 4 ms — so a burst was not confined to
 * export latency (NFR-46), and a single hung render would hold every email for its 60 s deadline (NFR-106). A handler
 * declares its queue with `@OnQueue`; every job that declares none is on `OUTBOX_QUEUE`.
 *
 * A queue name is durable in Redis and consumers bind to it, so a further split is a migration rather than a refactor.
 */
export const OUTBOX_QUEUE = 'easyesg';

/** The queue documents are generated on (task 44.5) — the PDF export now, the Excel export with task 46. */
export const EXPORT_QUEUE = 'easyesg-export';
