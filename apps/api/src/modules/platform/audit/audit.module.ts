import { Module } from '@nestjs/common';
import { SYSTEM_AUDIT_LOG } from '@api/contracts/system-audit-log.port';
import { SystemAuditLogRepository } from '@api/infrastructure/persistence/platform/system-audit-log.repository';

/**
 * `platform/audit` — FR-79, FR-81, FR-151, FR-159
 *
 * System audit log and billing ledger. Append-only at database privilege level (DR-6).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * **The system audit log's writer is provided here since task 67.4**, and exported: `AdminModule`
 * writes sign-in events through it and `AuditInterceptor` — registered in `AppModule`'s pipeline —
 * writes every admin-realm change. Until then `AdminModule` provided its own copy, which this file
 * said would move when the interceptor arrived.
 */
@Module({
  providers: [{ provide: SYSTEM_AUDIT_LOG, useClass: SystemAuditLogRepository }],
  exports: [SYSTEM_AUDIT_LOG],
})
export class AuditModule {}
