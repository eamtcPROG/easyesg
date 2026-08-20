import { Injectable, type CanActivate } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { CORE_DATA_SOURCE } from '../../infrastructure/persistence/data-source';
import { openTenantTransaction } from '../../infrastructure/persistence/tenant-transaction';

/**
 * §6.2's second obligation: open the request's transaction and bind the tenant to it (AD-2).
 *
 * **It is a guard and not the interceptor §6.2's table originally named**, because NestJS runs
 * every guard before any interceptor and `EntitlementGuard` reads per-organization subscription
 * state — which needs `app.current_org` already bound. An interceptor cannot open a transaction
 * that a guard running earlier depends on. §6.2 records this; the ordering it specifies —
 * auth → tenant context → entitlement → audit — is what is normative, not the component kind.
 *
 * It returns `true` unconditionally. It authorizes nothing: `CanActivate` is the only hook that
 * runs in the right place, and a guard that denied here would be making an access decision that
 * belongs to `AuthGuard`.
 *
 * The `core` DataSource holds the transaction even for a billing request, and that is deliberate.
 * DR-1 gives the two contexts separate connections precisely so they cannot share a transaction;
 * tenancy is bound on the one the compliance core uses, and billing's own tenant binding is its
 * concern when its tables arrive.
 */
@Injectable()
export class TenantTransactionGuard implements CanActivate {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async canActivate(): Promise<boolean> {
    await openTenantTransaction(this.dataSource);
    return true;
  }
}
