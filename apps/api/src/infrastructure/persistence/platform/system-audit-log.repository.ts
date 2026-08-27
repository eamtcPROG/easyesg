import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { SystemAuditEvent, SystemAuditLog } from '@api/contracts/system-audit-log.port';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `audit.system_audit_log`'s writer (FR-81, FR-159; task 28.4).
 *
 * **It takes its own connection, and that is the port's contract rather than this adapter's
 * preference.** Every interesting sign-in event is a *failure*, and a failure throws — so a write
 * enlisted in the caller's transaction would be rolled back by the very refusal it exists to
 * record. It is the shape `SignIn`'s throttle counters already take, and the reason the port states
 * it: an adapter that later "tidied" this onto the request's runner would erase exactly the rows an
 * operator opens the log for, while every test asserting a *successful* sign-in stayed green.
 *
 * **`organization_id` is never set**, so the row is a platform event and the table's own
 * `system_audit_log_platform_insert` policy — `organization_id IS NULL AND app.current_org IS NULL`
 * — is what refuses a tenant request forging one. A fresh connection has no organization bound, so
 * this adapter satisfies the second conjunct by construction; that is a property worth knowing
 * before anyone routes it through the request's runner to save a checkout.
 *
 * **No `RETURNING`.** `esg_app` holds `INSERT, SELECT` here, so it *could* — but the outbox writer's
 * lesson applies: a `RETURNING` clause makes a SELECT grant load-bearing for a write path, and the
 * caller has nothing to do with the id.
 */
@Injectable()
export class SystemAuditLogRepository implements SystemAuditLog {
  private readonly logger = new Logger(SystemAuditLogRepository.name);

  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async record(event: SystemAuditEvent): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO audit.system_audit_log (action, actor_id, subject) VALUES ($1, $2, $3)`,
        [event.action, event.actorId ?? null, event.subject ?? null],
      );
    } catch (error) {
      /**
       * **A failed audit write must not turn a refusal into a 500**, and this is the one place that
       * judgement is made rather than inherited.
       *
       * The caller is usually already throwing — a wrong password, a spent window — and replacing
       * that answer with an internal error would tell the caller something false about their own
       * request and hand a prober a way to distinguish states by breaking the log. The event is
       * logged at `error` so the loss is visible to an operator and to whatever watches the log
       * stream (NFR-92's alerting is task 71's).
       *
       * The opposite choice belongs to a *ledger*: DR-6 makes the billing ledger's write part of
       * the transaction it records, and there a failure must take the transaction with it. An
       * access log is not a ledger, and conflating the two is how a sign-in page starts returning
       * 500s because a partition is missing.
       */
      this.logger.error(
        `Failed to record a system audit event (${event.action}); the action itself was not affected`,
        error as Error,
      );
    }
  }
}
